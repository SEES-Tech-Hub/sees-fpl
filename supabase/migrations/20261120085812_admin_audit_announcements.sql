-- =============================================================================
-- Admin: audit log and announcements
-- Author: Akeem (admin backend, PR 2)
-- PRD: "Feature: Admin portal and match console", items 8 (announcements) and
--      9 (audit log)
--
-- What this adds
--   * audit_log: who changed what, when, with old and new values. Insert-only.
--     Written by one generic trigger, audit_row_change(), on teams, players,
--     sports, events, matchdays, announcements, fixtures (schedule and holder
--     columns only) and profiles (role only).
--   * admin_set_audit_context(): admin functions call it to attach context
--     (an import id, a reason) to every audit row written in the same
--     transaction.
--   * admin_audit_page(): one keyset-paginated feed that combines audit_log
--     with match event corrections from match_events (voids, and events the
--     admin recorded), so corrections aren't stored twice.
--   * announcements: the home page banner, shown between starts_at and ends_at.
--
-- Changes made from the SQL editor (auth.uid() is null) are logged too, with
-- no actor. Writes from Bolu's derived-state refresh (sees.live_refresh = on)
-- are skipped: scores and statuses come from match_events, which has its own
-- history.
--
-- Safe to run twice.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- audit_log
-- -----------------------------------------------------------------------------
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor       uuid references public.profiles (id) on delete set null,
  table_name  text not null,
  row_id      text not null,
  action      text not null check (action in ('insert', 'update', 'delete')),
  old         jsonb,  -- updates: changed columns only; deletes: the whole row
  new         jsonb,  -- updates: changed columns only; inserts: the whole row
  context     jsonb   -- e.g. {"importId": "...", "reason": "..."}
);

create index if not exists audit_log_occurred_at_idx on public.audit_log (occurred_at desc, id desc);
create index if not exists audit_log_table_row_idx   on public.audit_log (table_name, row_id);
create index if not exists audit_log_actor_idx       on public.audit_log (actor);

alter table public.audit_log enable row level security;

drop policy if exists "Admins read the audit log" on public.audit_log;
create policy "Admins read the audit log" on public.audit_log
  for select to authenticated using (public.is_admin());

-- Insert-only, and only through the trigger (SECURITY DEFINER). No policy
-- allows writes, and the privileges are removed as well.
revoke insert, update, delete, truncate on public.audit_log from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Request context for audit rows (transaction-local)
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_audit_context(p_context jsonb)
returns void
language sql
set search_path = ''
as $$
  select set_config('sees.audit_context', coalesce(p_context, '{}'::jsonb)::text, true);
$$;

-- -----------------------------------------------------------------------------
-- The generic audit trigger.
-- Trigger arguments, if given, are the only columns recorded (and the only
-- ones whose changes count). updated_at is never recorded.
-- -----------------------------------------------------------------------------
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_full_old jsonb;
  v_full_new jsonb;
  v_old      jsonb;
  v_new      jsonb;
  v_context  jsonb;
begin
  if current_setting('sees.live_refresh', true) = 'on' then
    return null;
  end if;

  if tg_op <> 'INSERT' then v_full_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_full_new := to_jsonb(new); end if;

  v_old := v_full_old - 'updated_at';
  v_new := v_full_new - 'updated_at';

  if tg_nargs > 0 then
    select jsonb_object_agg(key, value) into v_old from jsonb_each(v_old) where key = any (tg_argv);
    select jsonb_object_agg(key, value) into v_new from jsonb_each(v_new) where key = any (tg_argv);
  end if;

  if tg_op = 'UPDATE' then
    -- Keep only the columns that changed; skip the row if none did.
    select
      jsonb_object_agg(n.key, o.value),
      jsonb_object_agg(n.key, n.value)
    into v_old, v_new
    from jsonb_each(coalesce(v_new, '{}'::jsonb)) as n
    left join jsonb_each(coalesce(v_old, '{}'::jsonb)) as o on o.key = n.key
    where o.value is distinct from n.value;

    if v_new is null then
      return null;
    end if;
  end if;

  begin
    v_context := nullif(current_setting('sees.audit_context', true), '')::jsonb;
  exception when others then
    v_context := null;
  end;

  insert into public.audit_log (actor, table_name, row_id, action, old, new, context)
  values (
    auth.uid(),
    tg_table_name,
    coalesce(v_full_new ->> 'id', v_full_old ->> 'id'),
    lower(tg_op),
    v_old,
    v_new,
    v_context
  );
  return null;
end;
$$;

-- Attach it. Plain tables record every column except updated_at.
do $$
declare
  v_table text;
begin
  foreach v_table in array array['teams', 'players', 'sports', 'events', 'matchdays'] loop
    execute format('drop trigger if exists audit_row_change on public.%I', v_table);
    execute format(
      'create trigger audit_row_change after insert or update or delete on public.%I
         for each row execute function public.audit_row_change()',
      v_table
    );
  end loop;
end $$;

-- Fixtures: schedule and holder columns only. Score, period and winner come
-- from match_events; the live refresh is skipped above, and its status
-- changes (live, full time) along with it.
drop trigger if exists audit_row_change on public.fixtures;
create trigger audit_row_change
  after insert or update or delete on public.fixtures
  for each row execute function public.audit_row_change(
    'event_id', 'stage', 'home_team_id', 'away_team_id', 'kickoff_at', 'venue',
    'status', 'matchday_id', 'console_holder', 'result_note'
  );

-- Profiles: role changes only (promoting and removing officials).
drop trigger if exists audit_row_change on public.profiles;
create trigger audit_row_change
  after update of role on public.profiles
  for each row execute function public.audit_row_change('role');

-- -----------------------------------------------------------------------------
-- announcements: the home page banner
-- -----------------------------------------------------------------------------
create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  message    text not null check (char_length(message) between 1 and 280),
  tone       text not null default 'info' check (tone in ('info', 'warning')),
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_window check (ends_at > starts_at)
);

create index if not exists announcements_created_by_idx on public.announcements (created_by);
create index if not exists announcements_window_idx     on public.announcements (ends_at, starts_at);

drop trigger if exists announcements_set_updated_at on public.announcements;
create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

drop trigger if exists audit_row_change on public.announcements;
create trigger audit_row_change
  after insert or update or delete on public.announcements
  for each row execute function public.audit_row_change();

alter table public.announcements enable row level security;

-- Anyone (signed in or not) sees a banner while it's showing. Admins see and
-- manage all of them (policies are combined with OR).
drop policy if exists "Anyone reads showing announcements" on public.announcements;
create policy "Anyone reads showing announcements" on public.announcements
  for select to anon, authenticated using (now() >= starts_at and now() < ends_at);

drop policy if exists "Admins manage announcements" on public.announcements;
create policy "Admins manage announcements" on public.announcements
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- admin_audit_page: the audit feed for the admin portal.
-- Combines audit_log with match event corrections, newest first, keyset
-- paginated on (occurred_at, source, id). Pass the last row's values as
-- p_before_* to get the next page.
--   source 'audit'        : a row of audit_log
--   source 'match_void'   : a voided match event (action 'void', at voided_at,
--                           by voided_by, with the reason)
--   source 'match_record' : a match event an admin recorded (action 'record',
--                           at recorded_at), e.g. the re-entry after a void
-- One source per kind keeps (occurred_at, source, id) unique, so a page
-- boundary never skips or repeats a row.
-- -----------------------------------------------------------------------------
create or replace function public.admin_audit_page(
  p_table         text        default null,
  p_actor         uuid        default null,
  p_from          timestamptz default null,
  p_to            timestamptz default null,
  p_before_at     timestamptz default null,
  p_before_source text        default null,
  p_before_id     bigint      default null,
  p_limit         integer     default 50
)
returns table (
  source      text,
  id          bigint,
  occurred_at timestamptz,
  actor       uuid,
  actor_name  text,
  table_name  text,
  row_id      text,
  action      text,
  old         jsonb,
  new         jsonb,
  context     jsonb
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
begin
  -- Raised directly: live_fail isn't executable by app roles, and this runs as the caller.
  if not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'Only the admin can read the audit log.',
      hint = 'admin.forbidden';
  end if;

  return query
  with entries as (
    select
      'audit'::text as source, a.id, a.occurred_at, a.actor, a.table_name, a.row_id,
      a.action, a.old, a.new, a.context
    from public.audit_log a
    where (p_table is null or p_table <> 'match_events')

    union all

    select
      'match_void', e.id, e.voided_at, e.voided_by, 'match_events', e.id::text,
      'void',
      jsonb_build_object('voided_at', null::timestamptz),
      jsonb_build_object('voided_at', e.voided_at, 'void_reason', e.void_reason),
      jsonb_build_object('fixture_id', e.fixture_id, 'type', e.type, 'client_event_id', e.client_event_id,
                         'reason', e.void_reason)
    from public.match_events e
    where e.voided_at is not null
      and (p_table is null or p_table = 'match_events')

    union all

    select
      'match_record', e.id, e.recorded_at, e.recorded_by, 'match_events', e.id::text,
      'record',
      null,
      jsonb_build_object('type', e.type, 'team_id', e.team_id, 'player_id', e.player_id,
                         'other_player_id', e.other_player_id, 'occurred_at', e.occurred_at),
      jsonb_build_object('fixture_id', e.fixture_id, 'client_event_id', e.client_event_id)
    from public.match_events e
    join public.profiles p on p.id = e.recorded_by and p.role = 'admin'
    where (p_table is null or p_table = 'match_events')
  )
  select
    x.source, x.id, x.occurred_at, x.actor,
    coalesce(p.display_name, p.email) as actor_name,
    x.table_name, x.row_id, x.action, x.old, x.new, x.context
  from entries x
  left join public.profiles p on p.id = x.actor
  where (p_table is null or x.table_name = p_table)
    and (p_actor is null or x.actor = p_actor)
    and (p_from is null or x.occurred_at >= p_from)
    and (p_to is null or x.occurred_at < p_to)
    and (
      p_before_at is null
      or (x.occurred_at, x.source, x.id) < (p_before_at, p_before_source, p_before_id)
    )
  order by x.occurred_at desc, x.source desc, x.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

-- -----------------------------------------------------------------------------
-- Function permissions
-- -----------------------------------------------------------------------------
revoke all on function public.audit_row_change() from public, anon, authenticated;
revoke all on function public.admin_set_audit_context(jsonb) from public, anon, authenticated;
revoke all on function public.admin_audit_page(text, uuid, timestamptz, timestamptz, timestamptz, text, bigint, integer)
  from public, anon;
grant execute on function public.admin_audit_page(text, uuid, timestamptz, timestamptz, timestamptz, text, bigint, integer)
  to authenticated;

-- =============================================================================
-- Verify (for Tayo, after applying). Run in the SQL editor unless noted.
-- =============================================================================
-- 1. Tables, RLS and triggers exist:
--    select relname, relrowsecurity from pg_class
--     where relname in ('audit_log', 'announcements');                -- both true
--    select event_object_table from information_schema.triggers
--     where trigger_name = 'audit_row_change' group by 1 order by 1;
--    -- announcements, events, fixtures, matchdays, players, profiles, sports, teams
--
-- 2. A change is logged with only the changed columns (actor is null here
--    because the SQL editor has no signed-in user):
--    update public.teams set coaches = coaches where year = 1;        -- no change: no row
--    update public.teams set class_label = class_label || '' where year = 1;  -- no row either
--    begin;
--      update public.players set status = 'injured' where display_name = 'Kolade';
--      select table_name, action, old, new from public.audit_log order by id desc limit 1;
--      -- players | update | {"status": "available"} | {"status": "injured"}
--    rollback;
--
-- 3. Context reaches the audit row:
--    begin;
--      select public.admin_set_audit_context('{"importId": "test"}');
--      update public.players set shirt_number = 9 where display_name = 'Kolade';
--      select context from public.audit_log order by id desc limit 1; -- {"importId": "test"}
--    rollback;
--
-- 4. Live refresh writes are not logged (score columns aren't in the list):
--    select count(*) from public.audit_log where table_name = 'fixtures'
--      and (new ? 'home_score' or new ? 'current_period');            -- 0
--
-- 5. As anon or a plain user (in the app, or with
--    set local role authenticated; set local request.jwt.claims = '{"sub": "<user uuid>"}'):
--    select count(*) from public.audit_log;                           -- 0 rows visible
--    insert into public.audit_log (table_name, row_id, action) values ('x', 'x', 'insert');
--                                                                     -- permission denied
--    insert into public.announcements (message, starts_at, ends_at)
--      values ('hi', now(), now() + interval '1 hour');               -- refused (RLS)
--    select * from public.admin_audit_page();                         -- error: admin.forbidden
--
-- 6. Announcement window:
--    insert into public.announcements (message, starts_at, ends_at)
--      values ('bad', now(), now() - interval '1 minute');            -- check violation
--    insert into public.announcements (message, starts_at, ends_at)
--      values ('Test banner', now() - interval '1 minute', now() + interval '1 hour');
--    -- As anon: select message from public.announcements;            -- 'Test banner'
--    update public.announcements set ends_at = now() where message = 'Test banner';
--    -- As anon: select message from public.announcements;            -- no rows
--    delete from public.announcements where message = 'Test banner';
--
-- 7. As the admin (in the app): admin_audit_page() returns rows, newest first,
--    and the next page with p_before_* set to the last row's
--    (occurred_at, source, id) continues without gaps or repeats.
