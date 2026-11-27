-- =============================================================================
-- Live reactions: fans tap a reaction or cheer for their year during a match.
-- Owner: Bolu. Spec: "Live Reactions: Spec for Bolu" (Tayo, 26 Nov).
--
--   * match_reactions: the running totals, split into 8 shards per kind so
--     many phones adding at once don't queue on one row. Anyone can read it;
--     nobody writes it directly.
--   * reaction_senders: one row per phone per match, for the limits. Nobody
--     can read or write it directly; only add_reactions() touches it.
--   * live_reactions_open(fixture): the window rule, kick-off until 15 minutes
--     after full time.
--   * add_reactions(fixture, session, counts): what the app calls, at most
--     once every 4 seconds per phone. Checks every limit, then adds.
--   * match_reaction_totals(fixture): one row per kind, 0 for none yet.
--
-- Reactions are anonymous: the only id is a random one the phone keeps for
-- reactions alone (never the analytics visit id, which is linked to the
-- account when someone is signed in), and these tables hold no user ids.
-- No Realtime: fans read the totals through the cached /api/live/<id>
-- endpoint the match page already polls (lib/live/live-state.ts says why).
--
-- Safe to run twice.
-- =============================================================================

-- The kinds, in the order the app shows them. Five reactions, then the two
-- cheer sides.
create or replace function public.live_reaction_kinds()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['fire', 'shock', 'clap', 'laugh', 'heartbreak', 'cheer_home', 'cheer_away']::text[];
$$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table if not exists public.match_reactions (
  fixture_id uuid     not null references public.fixtures (id) on delete cascade,
  kind       text     not null check (kind in ('fire', 'shock', 'clap', 'laugh', 'heartbreak', 'cheer_home', 'cheer_away')),
  shard      smallint not null check (shard between 0 and 7),
  count      integer  not null default 0 check (count >= 0),
  primary key (fixture_id, kind, shard)
);
-- The primary key starts with fixture_id, so it already indexes the foreign key.
alter table public.match_reactions enable row level security;

drop policy if exists "Anyone can read reaction totals" on public.match_reactions;
create policy "Anyone can read reaction totals"
  on public.match_reactions for select
  to anon, authenticated
  using (true);
revoke insert, update, delete, truncate on public.match_reactions from anon, authenticated;

create table if not exists public.reaction_senders (
  session_id uuid        not null,
  fixture_id uuid        not null references public.fixtures (id) on delete cascade,
  last_at    timestamptz not null default '-infinity',
  sent       integer     not null default 0 check (sent between 0 and 1000),
  cheer_side text        check (cheer_side in ('home', 'away')),
  primary key (session_id, fixture_id)
);
create index if not exists reaction_senders_fixture_id_idx on public.reaction_senders (fixture_id);
-- RLS on and no policies: only add_reactions() (security definer) reads or
-- writes this table.
alter table public.reaction_senders enable row level security;
revoke all on public.reaction_senders from anon, authenticated;

-- -----------------------------------------------------------------------------
-- The window: open while the match is live or at half time, and for 15
-- minutes after full time. "Full time" is when the match's latest active
-- (not voided) event was recorded; races have no match events, so for them
-- it's when the results were published (the fixture's last update).
-- lib/live/reactions.ts (reactionsOpen) applies the same rule for the page.
-- -----------------------------------------------------------------------------
create or replace function public.live_reactions_open(p_fixture_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when f.status in ('live', 'half_time') then true
      when f.status = 'full_time' then
        coalesce(
          (select max(e.recorded_at) from public.match_events e
           where e.fixture_id = f.id and e.voided_at is null),
          f.updated_at
        ) > now() - interval '15 minutes'
      else false
    end
    from public.fixtures f
    where f.id = p_fixture_id
  ), false);
$$;

-- -----------------------------------------------------------------------------
-- add_reactions: one phone's taps from the last few seconds, for example
-- {"fire": 3, "cheer_home": 6}. Returns what was added (cheers for the other
-- side are left out). Refusals raise live.* codes like the other live
-- functions; the app drops a refused tally quietly.
-- -----------------------------------------------------------------------------
create or replace function public.add_reactions(p_fixture_id uuid, p_session uuid, p_counts jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kinds  constant text[] := public.live_reaction_kinds();
  v_key    text;
  v_value  jsonb;
  v_n      integer;
  v_total  integer := 0;
  v_counts jsonb := '{}'::jsonb;
  v_side   text;
  v_sender public.reaction_senders%rowtype;
begin
  if p_fixture_id is null or p_session is null then
    perform public.live_fail('live.invalid_input', 'A match and a session are needed.');
  end if;

  -- 1. Only while the match is open.
  if not public.live_reactions_open(p_fixture_id) then
    perform public.live_fail('live.reactions_closed', 'Reactions are closed for this match.');
  end if;

  -- 2. The counts: known kinds only, each a whole number from 1 to 20, at
  --    most 30 in all.
  if p_counts is null or jsonb_typeof(p_counts) <> 'object' then
    perform public.live_fail('live.invalid_input', 'Reactions must be a set of counts.');
  end if;
  for v_key, v_value in select key, value from jsonb_each(p_counts) loop
    if not (v_key = any (v_kinds)) then
      perform public.live_fail('live.invalid_input', format('Unknown reaction: %s.', left(v_key, 20)));
    end if;
    if jsonb_typeof(v_value) <> 'number' or v_value::text !~ '^[0-9]{1,2}$' then
      perform public.live_fail('live.invalid_input', 'Each reaction count must be a whole number from 1 to 20.');
    end if;
    v_n := v_value::text::integer;
    if v_n < 1 or v_n > 20 then
      perform public.live_fail('live.invalid_input', 'Each reaction count must be a whole number from 1 to 20.');
    end if;
    v_total := v_total + v_n;
  end loop;
  if v_total = 0 then
    perform public.live_fail('live.invalid_input', 'There are no reactions to add.');
  end if;
  if v_total > 30 then
    perform public.live_fail('live.invalid_input', 'At most 30 reactions can be sent at once.');
  end if;
  if p_counts ? 'cheer_home' and p_counts ? 'cheer_away' then
    perform public.live_fail('live.invalid_input', 'Cheer for one side at a time.');
  end if;

  -- 3. This phone's limits. The row lock makes two calls from one phone take
  --    turns, so the 4-second rule holds even if they arrive together.
  insert into public.reaction_senders (session_id, fixture_id)
  values (p_session, p_fixture_id)
  on conflict (session_id, fixture_id) do nothing;

  select * into v_sender
  from public.reaction_senders
  where session_id = p_session and fixture_id = p_fixture_id
  for update;

  if v_sender.last_at > now() - interval '4 seconds' then
    perform public.live_fail('live.reactions_too_fast', 'Reactions are sent at most once every 4 seconds.');
  end if;

  v_counts := p_counts;
  v_side := case when p_counts ? 'cheer_home' then 'home' when p_counts ? 'cheer_away' then 'away' end;
  if v_side is not null and v_sender.cheer_side is not null and v_side <> v_sender.cheer_side then
    -- This phone already cheers for the other side: drop these cheers and
    -- keep the rest of the call.
    v_total  := v_total - (p_counts ->> ('cheer_' || v_side))::integer;
    v_counts := p_counts - ('cheer_' || v_side);
    v_side   := null;
  end if;

  if v_sender.sent + v_total > 1000 then
    perform public.live_fail('live.reactions_limit', 'This phone has sent the most reactions allowed for this match.');
  end if;

  update public.reaction_senders
  set last_at    = now(),
      sent       = sent + v_total,
      cheer_side = coalesce(cheer_side, v_side)
  where session_id = p_session and fixture_id = p_fixture_id;

  -- 4. Add each kind to a random shard of the match's totals.
  for v_key, v_value in select key, value from jsonb_each(v_counts) loop
    insert into public.match_reactions as r (fixture_id, kind, shard, count)
    values (p_fixture_id, v_key, floor(random() * 8)::smallint, v_value::text::integer)
    on conflict (fixture_id, kind, shard) do update set count = r.count + excluded.count;
  end loop;

  return v_counts;
end;
$$;

-- -----------------------------------------------------------------------------
-- match_reaction_totals: one row per kind, in the app's order, with the sum
-- across shards. Kinds nobody has tapped come back as 0.
-- -----------------------------------------------------------------------------
create or replace function public.match_reaction_totals(p_fixture_id uuid)
returns table (kind text, total bigint)
language sql
stable
set search_path = ''
as $$
  select k.kind, coalesce(sum(r.count), 0)::bigint as total
  from unnest(public.live_reaction_kinds()) with ordinality as k (kind, ord)
  left join public.match_reactions r
    on r.fixture_id = p_fixture_id and r.kind = k.kind
  group by k.kind, k.ord
  order by k.ord;
$$;

-- -----------------------------------------------------------------------------
-- Who may call what
-- -----------------------------------------------------------------------------
revoke all on function public.live_reaction_kinds() from public;
revoke all on function public.live_reactions_open(uuid) from public;
revoke all on function public.add_reactions(uuid, uuid, jsonb) from public;
revoke all on function public.match_reaction_totals(uuid) from public;
grant execute on function public.live_reaction_kinds() to anon, authenticated;
grant execute on function public.live_reactions_open(uuid) to anon, authenticated;
grant execute on function public.add_reactions(uuid, uuid, jsonb) to anon, authenticated;
grant execute on function public.match_reaction_totals(uuid) to anon, authenticated;
