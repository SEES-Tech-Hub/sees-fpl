-- =============================================================================
-- Analytics: page views, who's online, and the admin's numbers
-- Author: Tayo
--
-- What this adds
--   * analytics_visits: one row per browser (an anonymous id kept on the
--     device), with when it was first and last seen, the page it's on, phone
--     or computer, and whether it's the installed app. "Online now" is a
--     visit seen in the last two minutes (the app sends a heartbeat each
--     minute while it's open).
--   * analytics_page_views: one row per page shown. Ids in paths are folded
--     (/matches/:id) so pages group together. Kept 120 days.
--   * track_page_view() and track_heartbeat(): what the app calls. Anyone
--     may call them (they only write these two tables, with checks).
--   * admin_analytics(days): every number and series Admin → Analytics shows,
--     as one JSON document. Admin only.
--
-- No third parties, no cookies, no IP addresses. The privacy notice says so.
-- Safe to run twice.
-- =============================================================================

create table if not exists public.analytics_visits (
  session_id uuid primary key,
  user_id    uuid references public.profiles (id) on delete set null,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  last_path  text,
  device     text not null default 'computer' check (device in ('phone', 'tablet', 'computer')),
  standalone boolean not null default false
);
create index if not exists analytics_visits_last_seen_idx on public.analytics_visits (last_seen);
create index if not exists analytics_visits_user_id_idx on public.analytics_visits (user_id);
alter table public.analytics_visits enable row level security;

create table if not exists public.analytics_page_views (
  id         bigint generated always as identity primary key,
  session_id uuid not null references public.analytics_visits (session_id) on delete cascade,
  user_id    uuid references public.profiles (id) on delete set null,
  path       text not null,
  referrer   text,
  created_at timestamptz not null default now()
);
create index if not exists analytics_page_views_created_at_idx on public.analytics_page_views (created_at);
create index if not exists analytics_page_views_session_id_idx on public.analytics_page_views (session_id);
create index if not exists analytics_page_views_user_id_idx on public.analytics_page_views (user_id);
alter table public.analytics_page_views enable row level security;

-- Admins can read the raw rows (the page uses admin_analytics()).
drop policy if exists "Admins read visits" on public.analytics_visits;
create policy "Admins read visits" on public.analytics_visits for select to authenticated using (public.is_admin());
drop policy if exists "Admins read page views" on public.analytics_page_views;
create policy "Admins read page views" on public.analytics_page_views for select to authenticated using (public.is_admin());

-- -----------------------------------------------------------------------------
-- Writes from the app
-- -----------------------------------------------------------------------------
create or replace function public.analytics_clean_path(p_path text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(regexp_replace(split_part(coalesce(p_path, '/'), '?', 1),
                             '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', ':id', 'g'), 200);
$$;

create or replace function public.track_heartbeat(
  p_session uuid, p_path text, p_device text default 'computer', p_standalone boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_session is null or p_path is null or left(p_path, 1) <> '/' then
    return;
  end if;
  insert into public.analytics_visits as v (session_id, user_id, last_path, device, standalone)
  values (p_session, auth.uid(), public.analytics_clean_path(p_path),
          case when p_device in ('phone', 'tablet', 'computer') then p_device else 'computer' end,
          coalesce(p_standalone, false))
  on conflict (session_id) do update set
    last_seen  = now(),
    last_path  = excluded.last_path,
    user_id    = coalesce(auth.uid(), v.user_id),
    device     = excluded.device,
    standalone = excluded.standalone;
end;
$$;

create or replace function public.track_page_view(
  p_session uuid, p_path text, p_referrer text default null,
  p_device text default 'computer', p_standalone boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_session is null or p_path is null or left(p_path, 1) <> '/' then
    return;
  end if;
  perform public.track_heartbeat(p_session, p_path, p_device, p_standalone);
  insert into public.analytics_page_views (session_id, user_id, path, referrer)
  values (p_session, auth.uid(), public.analytics_clean_path(p_path),
          nullif(left(coalesce(p_referrer, ''), 100), ''));
  -- Keep 120 days (cheap: uses the created_at index, about once in 500 views).
  if random() < 0.002 then
    delete from public.analytics_page_views where created_at < now() - interval '120 days';
  end if;
end;
$$;

revoke all on function public.track_heartbeat(uuid, text, text, boolean) from public;
revoke all on function public.track_page_view(uuid, text, text, text, boolean) from public;
grant execute on function public.track_heartbeat(uuid, text, text, boolean) to anon, authenticated;
grant execute on function public.track_page_view(uuid, text, text, text, boolean) to anon, authenticated;
revoke all on function public.analytics_clean_path(text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- admin_analytics: everything Admin → Analytics shows (days: the window)
-- Days are WAT dates.
-- -----------------------------------------------------------------------------
create or replace function public.admin_analytics(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days  integer := least(greatest(coalesce(p_days, 30), 1), 120);
  v_from  date := (now() at time zone 'Africa/Lagos')::date - (v_days - 1);
  v_since timestamptz := (v_from::timestamp) at time zone 'Africa/Lagos';
  v_out   jsonb;
begin
  if not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'Only the admin can see analytics.', hint = 'admin.forbidden';
  end if;

  with days as (
    select d::date as day from generate_series(v_from, (now() at time zone 'Africa/Lagos')::date, interval '1 day') d
  ),
  views as (
    select (created_at at time zone 'Africa/Lagos')::date as day, count(*) as views, count(distinct session_id) as visitors
    from public.analytics_page_views where created_at >= v_since group by 1
  ),
  signups as (
    select (created_at at time zone 'Africa/Lagos')::date as day, count(*) as n
    from public.profiles where created_at >= v_since group by 1
  ),
  mgrs as (
    select (created_at at time zone 'Africa/Lagos')::date as day, count(*) as n
    from public.managers where created_at >= v_since group by 1
  ),
  evts as (
    select (recorded_at at time zone 'Africa/Lagos')::date as day, count(*) as n
    from public.match_events where recorded_at >= v_since and voided_at is null group by 1
  )
  select jsonb_build_object(
    'generatedAt', now(),
    'days', v_days,
    'online', jsonb_build_object(
      'now',      (select count(*) from public.analytics_visits where last_seen > now() - interval '2 minutes'),
      'signedIn', (select count(*) from public.analytics_visits where last_seen > now() - interval '2 minutes' and user_id is not null),
      'pages',    coalesce((select jsonb_agg(jsonb_build_object('path', last_path, 'people', n) order by n desc)
                            from (select last_path, count(*) as n from public.analytics_visits
                                  where last_seen > now() - interval '2 minutes' group by last_path order by 2 desc limit 8) p), '[]'::jsonb)
    ),
    'totals', jsonb_build_object(
      'users',           (select count(*) from public.profiles),
      'officials',       (select count(*) from public.profiles where role = 'official'),
      'admins',          (select count(*) from public.profiles where role = 'admin'),
      'managers',        (select count(*) from public.managers),
      'leagues',         (select count(*) from public.leagues),
      'transfers',       (select count(*) from public.transfers),
      'pushSubscribers', (select count(*) from public.push_subscriptions),
      'visitors',        (select count(*) from public.analytics_visits),
      'installed',       (select count(*) from public.analytics_visits where standalone),
      'pageViews',       (select count(*) from public.analytics_page_views),
      'matchEvents',     (select count(*) from public.match_events where voided_at is null),
      'fixturesPlayed',  (select count(*) from public.fixtures where status in ('full_time', 'walkover'))
    ),
    'before', jsonb_build_object(
      'users',    (select count(*) from public.profiles where created_at < v_since),
      'managers', (select count(*) from public.managers where created_at < v_since)
    ),
    'daily', (select jsonb_agg(jsonb_build_object(
                'day', d.day,
                'views', coalesce(v.views, 0),
                'visitors', coalesce(v.visitors, 0),
                'signups', coalesce(s.n, 0),
                'managers', coalesce(m.n, 0),
                'events', coalesce(e.n, 0)) order by d.day)
              from days d
              left join views v on v.day = d.day
              left join signups s on s.day = d.day
              left join mgrs m on m.day = d.day
              left join evts e on e.day = d.day),
    'hourly', coalesce((select jsonb_agg(jsonb_build_object('hour', h, 'views', coalesce(n, 0)) order by h)
               from generate_series(0, 23) h
               left join (select extract(hour from created_at at time zone 'Africa/Lagos')::int as hr, count(*) as n
                          from public.analytics_page_views where created_at > now() - interval '24 hours' group by 1) x on x.hr = h), '[]'::jsonb),
    'topPages', coalesce((select jsonb_agg(jsonb_build_object('path', path, 'views', n, 'visitors', u) order by n desc)
                 from (select path, count(*) as n, count(distinct session_id) as u from public.analytics_page_views
                       where created_at >= v_since group by path order by 2 desc limit 12) t), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('device', device, 'visitors', n) order by n desc)
                from (select device, count(*) as n from public.analytics_visits where last_seen >= v_since group by device) t), '[]'::jsonb),
    'installed', jsonb_build_object(
      'app',     (select count(*) from public.analytics_visits where last_seen >= v_since and standalone),
      'browser', (select count(*) from public.analytics_visits where last_seen >= v_since and not standalone)
    ),
    'referrers', coalesce((select jsonb_agg(jsonb_build_object('source', referrer, 'views', n) order by n desc)
                  from (select referrer, count(*) as n from public.analytics_page_views
                        where created_at >= v_since and referrer is not null group by referrer order by 2 desc limit 8) t), '[]'::jsonb),
    'managersByYear', coalesce((select jsonb_agg(jsonb_build_object('year', year_group, 'managers', n) order by year_group nulls last)
                       from (select year_group, count(*) as n from public.managers group by year_group) t), '[]'::jsonb),
    'transfersByMatchday', coalesce((select jsonb_agg(jsonb_build_object('matchday', md.number, 'transfers', count) order by md.number)
                            from (select matchday_id, count(*) from public.transfers group by matchday_id) t
                            join public.matchdays md on md.id = t.matchday_id), '[]'::jsonb),
    'pushTopics', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'subscriptions', n) order by n desc)
                   from (select split_part(topic, ':', 1) as kind, count(*) as n
                         from public.push_subscriptions, unnest(topics) as topic group by 1) t), '[]'::jsonb),
    'eventsBySport', coalesce((select jsonb_agg(jsonb_build_object('sport', name, 'events', n) order by n desc)
                      from (select s.name, count(*) as n from public.match_events me
                            join public.fixtures f on f.id = me.fixture_id
                            join public.events ev on ev.id = f.event_id
                            join public.sports s on s.id = ev.sport_id
                            where me.voided_at is null group by s.name) t), '[]'::jsonb)
  ) into v_out;

  return v_out;
end;
$$;

revoke all on function public.admin_analytics(integer) from public, anon;
grant execute on function public.admin_analytics(integer) to authenticated;

-- =============================================================================
-- Verify (for Tayo, after applying)
-- =============================================================================
-- select public.track_page_view(gen_random_uuid(), '/matches/4e0f5532-457f-4f7c-92e9-20b2d27cae92', 'whatsapp', 'phone', false);
-- select path from public.analytics_page_views order by id desc limit 1;   -- /matches/:id
-- As the admin: select public.admin_analytics(30) -> 'online';
