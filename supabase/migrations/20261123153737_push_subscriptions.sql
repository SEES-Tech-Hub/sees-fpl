-- =============================================================================
-- Web Push subscriptions
-- Author: Tayo
--
-- A browser that taps "Notify me" stores its push subscription here with the
-- topics it follows: 'fixture:<uuid>', 'team:<uuid>' or 'all'. Signing in is
-- not needed (push works for anonymous visitors), so:
--   * nobody reads or writes the table directly (RLS on, no policies);
--   * push_subscribe / push_unsubscribe are SECURITY DEFINER and callable by
--     anyone: they only touch the row for the caller's own endpoint, and an
--     endpoint is an unguessable URL only that browser knows;
--   * push_targets / push_forget, used when sending, are for officials and
--     admins only (the console records events with their session).
-- Safe to run twice.
-- =============================================================================

create table if not exists public.push_subscriptions (
  endpoint   text primary key check (endpoint like 'https://%'),
  p256dh     text not null,
  auth       text not null,
  topics     text[] not null default '{}',
  user_id    uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_topics_idx on public.push_subscriptions using gin (topics);
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

-- Save or update this browser's subscription. Topics are added to the ones
-- it already follows (p_replace = true sets them exactly).
create or replace function public.push_subscribe(
  p_endpoint text,
  p_p256dh   text,
  p_auth     text,
  p_topics   text[],
  p_replace  boolean default false
)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_topics text[];
begin
  if p_endpoint is null or p_endpoint not like 'https://%' or char_length(p_endpoint) > 1000 then
    raise exception 'push.invalid: That push subscription is not valid.';
  end if;
  if exists (select 1 from unnest(p_topics) t where t !~ '^(all|fixture:[0-9a-f-]{36}|team:[0-9a-f-]{36})$') then
    raise exception 'push.invalid: Unknown notification topic.';
  end if;

  insert into public.push_subscriptions as s (endpoint, p256dh, auth, topics, user_id)
  values (p_endpoint, p_p256dh, p_auth, coalesce(p_topics, '{}'), auth.uid())
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh,
        auth = excluded.auth,
        topics = case
          when p_replace then excluded.topics
          else (select array(select distinct unnest(s.topics || excluded.topics)))
        end,
        user_id = coalesce(auth.uid(), s.user_id),
        updated_at = now()
  returning topics into v_topics;
  return v_topics;
end;
$$;

-- Stop some topics (or everything when p_topics is null).
create or replace function public.push_unsubscribe(p_endpoint text, p_topics text[] default null)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_topics text[];
begin
  if p_topics is null then
    delete from public.push_subscriptions where endpoint = p_endpoint;
    return '{}';
  end if;
  update public.push_subscriptions
  set topics = array(select t from unnest(topics) t where t <> all(p_topics)), updated_at = now()
  where endpoint = p_endpoint
  returning topics into v_topics;
  return coalesce(v_topics, '{}');
end;
$$;

-- What this browser follows (to show the bell's state).
create or replace function public.push_topics(p_endpoint text)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select topics from public.push_subscriptions where endpoint = p_endpoint), '{}');
$$;

-- For sending: every subscription following any of these topics.
create or replace function public.push_targets(p_topics text[])
returns table (endpoint text, p256dh text, auth text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.is_official() or public.is_admin()) then
    raise exception 'push.forbidden: Only officials can send notifications.';
  end if;
  return query
    select s.endpoint, s.p256dh, s.auth
    from public.push_subscriptions s
    where s.topics && p_topics;
end;
$$;

-- For sending: drop subscriptions the push service says are gone.
create or replace function public.push_forget(p_endpoints text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_official() or public.is_admin()) then
    raise exception 'push.forbidden: Only officials can send notifications.';
  end if;
  delete from public.push_subscriptions where endpoint = any(p_endpoints);
end;
$$;

revoke all on function public.push_subscribe(text, text, text, text[], boolean) from public;
revoke all on function public.push_unsubscribe(text, text[]) from public;
revoke all on function public.push_topics(text) from public;
revoke all on function public.push_targets(text[]) from public, anon;
revoke all on function public.push_forget(text[]) from public, anon;
grant execute on function public.push_subscribe(text, text, text, text[], boolean) to anon, authenticated;
grant execute on function public.push_unsubscribe(text, text[]) to anon, authenticated;
grant execute on function public.push_topics(text) to anon, authenticated;
grant execute on function public.push_targets(text[]) to authenticated;
grant execute on function public.push_forget(text[]) to authenticated;
