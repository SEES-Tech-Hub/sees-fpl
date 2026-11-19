-- =============================================================================
-- Live scores, phase 1: match events, lineups and the console API
-- Owner: Bolu (live scores backend)
-- PRD: "Feature: Live scores and results", "Match console", "Users and roles"
-- Guide for the team: docs/live-scores.md
--
-- What this adds
--   * match_events: the append-only record of everything that happens in a
--     timed match. Rows are never edited or deleted. A mistake is voided, so
--     the full history stays available for corrections and the audit log.
--   * lineups: starters and bench for each team in a fixture.
--   * Console functions. They are the only way to write either table:
--       record_match_event, void_match_event, set_lineup,
--       take_fixture, release_fixture
--   * The score, period, clock and winner columns on fixtures are now worked
--     out from match_events by refresh_fixture_state() and can't be written
--     by hand.
--   * fixture_player_state() (who is on the pitch), the match_timeline view
--     (events with the match minute and names) and Realtime on fixtures,
--     match_events and lineups.
--
-- Error handling: every rule violation raises SQLSTATE P0001 with a stable
-- code in HINT (for example 'live.not_holder'). The app maps these codes to
-- messages; see lib/live/errors.ts.
--
-- Safe to run twice.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.match_event_type as enum (
    'period_start',      -- kick off a period (first half, second half, extra time, penalties)
    'period_end',        -- whistle for a break (half time, end of normal time, ...)
    'goal',              -- a goal (or basket points) credited to team_id
    'card',              -- yellow or red card
    'substitution',      -- player_id off, other_player_id on
    'penalty_miss',      -- penalty in normal or extra time not scored; other_player_id = goalkeeper if saved
    'shootout_kick',     -- one kick in a penalty shootout
    'man_of_the_match',  -- chosen by the official
    'full_time',         -- the match is over
    'walkover'           -- awarded to team_id without play (admin only)
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.card_colour as enum ('yellow', 'red');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lineup_role as enum ('starter', 'bench');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- New columns on existing tables
-- -----------------------------------------------------------------------------
-- Length of each extra-time period (football: 2 x 7 minutes). Used by the clock.
alter table public.events
  add column if not exists extra_period_minutes smallint
  check (extra_period_minutes > 0);

update public.events e
set extra_period_minutes = 7
from public.sports s
where s.id = e.sport_id
  and s.slug = 'football'
  and e.extra_period_minutes is null;

-- Penalty shootout score (null until a shootout starts). Derived, like the score.
alter table public.fixtures
  add column if not exists home_shootout smallint check (home_shootout >= 0);
alter table public.fixtures
  add column if not exists away_shootout smallint check (away_shootout >= 0);

-- -----------------------------------------------------------------------------
-- Errors: raise P0001 with a stable machine-readable code in HINT
-- -----------------------------------------------------------------------------
create or replace function public.live_fail(p_code text, p_message text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = p_message, hint = p_code;
end;
$$;

-- -----------------------------------------------------------------------------
-- match_events: the single record of what happened in a match
-- -----------------------------------------------------------------------------
create table if not exists public.match_events (
  id              bigint generated always as identity primary key,
  fixture_id      uuid not null references public.fixtures (id) on delete restrict,
  -- Made by the console when the button is tapped. Makes retries from the offline
  -- queue safe: sending the same event twice records it once.
  client_event_id uuid not null unique,
  type            public.match_event_type not null,
  -- The period the event happened in (stamped by record_match_event).
  period          public.match_period,
  team_id         uuid references public.teams (id) on delete restrict,
  -- Meaning depends on type (see docs/live-scores.md):
  --   goal: scorer (own goal: the player who put it in his own net)
  --   card: carded player; substitution: player off
  --   penalty_miss / shootout_kick: taker; man_of_the_match: the player
  player_id       uuid references public.players (id) on delete restrict,
  --   goal: assister; substitution: player on; penalty_miss: goalkeeper who saved it
  other_player_id uuid references public.players (id) on delete restrict,
  card            public.card_colour,
  is_penalty      boolean not null default false,
  is_own_goal     boolean not null default false,
  scored          boolean,               -- shootout_kick only
  points          smallint,              -- goal: 1 (basketball 1 to 3); walkover: the awarded score
  occurred_at     timestamptz not null,  -- when it happened on the pitch
  recorded_at     timestamptz not null default now(),  -- when the server received it
  recorded_by     uuid references public.profiles (id) on delete set null,
  voided_at       timestamptz,
  voided_by       uuid references public.profiles (id) on delete set null,
  void_reason     text,

  constraint match_events_shape check (
    case type
      when 'period_start'     then period is not null
      when 'period_end'       then period is not null
      when 'goal'             then team_id is not null and points between 1 and 3
      when 'card'             then team_id is not null and player_id is not null and card is not null
      when 'substitution'     then team_id is not null and player_id is not null
                                   and other_player_id is not null and player_id <> other_player_id
      when 'penalty_miss'     then team_id is not null and player_id is not null
      when 'shootout_kick'    then team_id is not null and scored is not null
      when 'man_of_the_match' then player_id is not null
      when 'full_time'        then true
      when 'walkover'         then team_id is not null and points between 1 and 99
    end
  ),
  constraint match_events_flags check (
    (type = 'goal' or (not is_penalty and not is_own_goal))
    and not (is_penalty and is_own_goal)
    and (type = 'card' or card is null)
    and (type = 'shootout_kick' or scored is null)
  ),
  constraint match_events_void check (
    voided_at is not null or (voided_by is null and void_reason is null)
  )
);

create index if not exists match_events_fixture_order_idx
  on public.match_events (fixture_id, occurred_at, id);
create index if not exists match_events_team_id_idx         on public.match_events (team_id);
create index if not exists match_events_player_id_idx       on public.match_events (player_id);
create index if not exists match_events_other_player_id_idx on public.match_events (other_player_id);
create index if not exists match_events_recorded_by_idx     on public.match_events (recorded_by);
create index if not exists match_events_voided_by_idx       on public.match_events (voided_by);

-- Append-only: only the void columns may change, and only once. Deletes are
-- refused for app users; trusted maintenance (SQL editor, secret key, where
-- auth.uid() is null) may delete, for example in the pre-launch reset script.
create or replace function public.match_events_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if auth.uid() is not null then
      perform public.live_fail('live.append_only',
        'Match events are never deleted. Void the event instead.');
    end if;
    return old;
  end if;

  if old.voided_at is not null then
    perform public.live_fail('live.already_voided', 'This event has already been voided.');
  end if;

  if (to_jsonb(new) - array['voided_at', 'voided_by', 'void_reason'])
     is distinct from (to_jsonb(old) - array['voided_at', 'voided_by', 'void_reason']) then
    perform public.live_fail('live.append_only',
      'Match events are never edited. Void the event and record a new one.');
  end if;
  return new;
end;
$$;

drop trigger if exists match_events_append_only on public.match_events;
create trigger match_events_append_only
  before update or delete on public.match_events
  for each row execute function public.match_events_append_only();

-- -----------------------------------------------------------------------------
-- lineups: who starts and who is on the bench, per team per fixture
-- -----------------------------------------------------------------------------
create table if not exists public.lineups (
  fixture_id uuid not null references public.fixtures (id) on delete restrict,
  team_id    uuid not null references public.teams (id) on delete restrict,
  player_id  uuid not null references public.players (id) on delete restrict,
  role       public.lineup_role not null,
  set_by     uuid references public.profiles (id) on delete set null,
  set_at     timestamptz not null default now(),
  primary key (fixture_id, player_id)
);

create index if not exists lineups_team_id_idx   on public.lineups (team_id);
create index if not exists lineups_player_id_idx on public.lineups (player_id);
create index if not exists lineups_set_by_idx    on public.lineups (set_by);

-- -----------------------------------------------------------------------------
-- Player state in a fixture, worked out from the lineup and events.
-- Football has no re-entry, so set logic is enough: on the pitch means
-- (started or subbed on) and not subbed off and not sent off.
-- Public: the console uses it for the substitution picker.
-- -----------------------------------------------------------------------------
create or replace function public.fixture_player_state(p_fixture_id uuid)
returns table (
  player_id    uuid,
  team_id      uuid,
  lineup_role  public.lineup_role,
  appeared     boolean,   -- started, or came on as a substitute
  on_pitch     boolean,
  sent_off     boolean,
  yellow_cards integer
)
language sql
stable
set search_path = ''
as $$
  with ev as (
    select type, player_id, other_player_id, card
    from public.match_events
    where fixture_id = p_fixture_id and voided_at is null
  ),
  subbed_on  as (select other_player_id as pid from ev where type = 'substitution'),
  subbed_off as (select player_id as pid from ev where type = 'substitution'),
  reds       as (select player_id as pid from ev where type = 'card' and card = 'red'),
  yellows    as (
    select player_id as pid, count(*)::integer as n
    from ev where type = 'card' and card = 'yellow'
    group by player_id
  )
  select
    l.player_id,
    l.team_id,
    l.role,
    (l.role = 'starter' or l.player_id in (select pid from subbed_on)) as appeared,
    (l.role = 'starter' or l.player_id in (select pid from subbed_on))
      and l.player_id not in (select pid from subbed_off)
      and l.player_id not in (select pid from reds) as on_pitch,
    l.player_id in (select pid from reds) as sent_off,
    coalesce(y.n, 0) as yellow_cards
  from public.lineups l
  left join yellows y on y.pid = l.player_id
  where l.fixture_id = p_fixture_id;
$$;

-- -----------------------------------------------------------------------------
-- Match minute for an event or the live clock.
-- 0:00 to 0:59 into a period is minute 1. Past the period's length, the minute
-- stays at the period's end and the extra time is returned as added_minutes
-- (shown as 25+2'). Penalties have no minute.
-- Mirrors matchMinute() in lib/live/clock.ts. Change both together.
-- -----------------------------------------------------------------------------
create or replace function public.match_minute(
  p_period               public.match_period,
  p_period_started_at    timestamptz,
  p_at                   timestamptz,
  p_period_minutes       integer,
  p_extra_period_minutes integer
)
returns table (minute integer, added_minutes integer)
language sql
immutable
set search_path = ''
as $$
  with base as (
    select
      case p_period
        when 'first_half'   then 0
        when 'second_half'  then p_period_minutes
        when 'extra_first'  then 2 * p_period_minutes
        when 'extra_second' then 2 * p_period_minutes + p_extra_period_minutes
      end as offset_minutes,
      case
        when p_period in ('extra_first', 'extra_second') then p_extra_period_minutes
        else p_period_minutes
      end as length_minutes,
      case
        when p_period_started_at is null or p_at is null then null
        else greatest(floor(extract(epoch from (p_at - p_period_started_at)) / 60)::integer + 1, 1)
      end as elapsed
  )
  select
    case
      when offset_minutes is null or elapsed is null then null
      when length_minutes is not null and elapsed > length_minutes then offset_minutes + length_minutes
      else offset_minutes + elapsed
    end,
    case
      when offset_minutes is null or elapsed is null then null
      when length_minutes is not null and elapsed > length_minutes then elapsed - length_minutes
      else 0
    end
  from base;
$$;

-- -----------------------------------------------------------------------------
-- Derived fixture state. Replays the fixture's active events in order and
-- writes status, period, clock start, score, shootout score and winner.
-- Called by a trigger on match_events, so it runs on every record and void.
-- -----------------------------------------------------------------------------
create or replace function public.refresh_fixture_state(p_fixture_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  f         public.fixtures%rowtype;
  e         public.match_events%rowtype;
  v_status  public.fixture_status;
  v_period  public.match_period;
  v_started timestamptz;
  v_home    integer;
  v_away    integer;
  v_hs      integer;
  v_as      integer;
  v_winner  uuid;
begin
  select * into f from public.fixtures where id = p_fixture_id;
  if not found then
    return;
  end if;

  -- Postponed and cancelled are set by the admin and only allowed when the
  -- fixture has no active events, so they survive a replay with no events.
  v_status := case when f.status in ('postponed', 'cancelled') then f.status else 'scheduled' end;

  for e in
    select * from public.match_events
    where fixture_id = p_fixture_id and voided_at is null
    order by occurred_at, id
  loop
    case e.type
      when 'period_start' then
        v_status  := 'live';
        v_period  := e.period;
        v_started := e.occurred_at;
        v_home    := coalesce(v_home, 0);
        v_away    := coalesce(v_away, 0);
        if e.period = 'penalties' then
          v_hs := coalesce(v_hs, 0);
          v_as := coalesce(v_as, 0);
        end if;
      when 'period_end' then
        v_status  := 'half_time';
        v_started := null;
      when 'goal' then
        if e.team_id = f.home_team_id then
          v_home := coalesce(v_home, 0) + e.points;
        else
          v_away := coalesce(v_away, 0) + e.points;
        end if;
      when 'shootout_kick' then
        if e.scored then
          if e.team_id = f.home_team_id then
            v_hs := coalesce(v_hs, 0) + 1;
          else
            v_as := coalesce(v_as, 0) + 1;
          end if;
        end if;
      when 'full_time' then
        v_status  := 'full_time';
        v_started := null;
      when 'walkover' then
        v_status  := 'walkover';
        v_period  := null;
        v_started := null;
        v_winner  := e.team_id;
        if e.team_id = f.home_team_id then
          v_home := e.points; v_away := 0;
        else
          v_home := 0; v_away := e.points;
        end if;
      else
        null;  -- cards, substitutions, misses and MOTM don't change the fixture row
    end case;
  end loop;

  if v_status = 'full_time' then
    v_winner := case
      when v_home > v_away then f.home_team_id
      when v_away > v_home then f.away_team_id
      when coalesce(v_hs, 0) > coalesce(v_as, 0) then f.home_team_id
      when coalesce(v_as, 0) > coalesce(v_hs, 0) then f.away_team_id
      else null  -- a draw
    end;
  elsif v_status <> 'walkover' then
    v_winner := null;
  end if;

  perform set_config('sees.live_refresh', 'on', true);
  update public.fixtures
  set status            = v_status,
      current_period    = v_period,
      period_started_at = v_started,
      home_score        = v_home,
      away_score        = v_away,
      home_shootout     = v_hs,
      away_shootout     = v_as,
      winner_team_id    = v_winner
  where id = p_fixture_id
    and (status, current_period, period_started_at, home_score, away_score,
         home_shootout, away_shootout, winner_team_id)
        is distinct from
        (v_status, v_period, v_started, v_home, v_away, v_hs, v_as, v_winner);
  perform set_config('sees.live_refresh', 'off', true);
end;
$$;

create or replace function public.match_events_refresh_fixture()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_fixture_state(new.fixture_id);
  return null;
end;
$$;

drop trigger if exists match_events_refresh_fixture on public.match_events;
create trigger match_events_refresh_fixture
  after insert or update on public.match_events
  for each row execute function public.match_events_refresh_fixture();

-- -----------------------------------------------------------------------------
-- Guard on fixtures: derived columns change only through refresh_fixture_state.
-- Requests from the app (auth.uid() is set) may:
--   * change status only between scheduled, postponed and cancelled, and only
--     while the fixture has no active events;
--   * not change the teams or event once events exist;
--   * set console_holder only to an official or admin account.
-- The SQL editor (auth.uid() is null) is not restricted, like the role guard.
-- -----------------------------------------------------------------------------
create or replace function public.guard_fixture_live_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_has_events boolean;
begin
  if current_setting('sees.live_refresh', true) = 'on' or auth.uid() is null then
    return new;
  end if;

  if (new.home_score, new.away_score, new.home_shootout, new.away_shootout,
      new.current_period, new.period_started_at, new.winner_team_id)
     is distinct from
     (old.home_score, old.away_score, old.home_shootout, old.away_shootout,
      old.current_period, old.period_started_at, old.winner_team_id) then
    perform public.live_fail('live.derived_column',
      'Scores, periods and winners come from match events. Record or void an event instead.');
  end if;

  v_has_events := exists (
    select 1 from public.match_events where fixture_id = new.id and voided_at is null
  );

  if new.status is distinct from old.status then
    if old.status not in ('scheduled', 'postponed', 'cancelled')
       or new.status not in ('scheduled', 'postponed', 'cancelled') then
      perform public.live_fail('live.derived_status',
        'Live, half time, full time and walkover come from match events. You can only schedule, postpone or cancel.');
    end if;
    if v_has_events then
      perform public.live_fail('live.has_events',
        'This fixture already has match events. Void them before postponing or cancelling.');
    end if;
  end if;

  if v_has_events and (new.event_id, new.home_team_id, new.away_team_id)
     is distinct from (old.event_id, old.home_team_id, old.away_team_id) then
    perform public.live_fail('live.has_events',
      'The teams and event of a fixture can''t change once it has match events.');
  end if;

  if new.console_holder is distinct from old.console_holder
     and new.console_holder is not null
     and not exists (
       select 1 from public.profiles
       where id = new.console_holder and role in ('official', 'admin')
     ) then
    perform public.live_fail('live.holder_not_official',
      'Only an official or admin account can hold a match console.');
  end if;

  return new;
end;
$$;

drop trigger if exists fixtures_guard_live_columns on public.fixtures;
create trigger fixtures_guard_live_columns
  before update on public.fixtures
  for each row execute function public.guard_fixture_live_columns();

-- -----------------------------------------------------------------------------
-- Console: take and release a fixture (the one-holder lock)
-- "Hand over" in the console is release_fixture on the old phone, then
-- take_fixture on the new one. The admin can also set console_holder directly.
-- -----------------------------------------------------------------------------
create or replace function public.take_fixture(p_fixture_id uuid)
returns public.fixtures
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_fixture public.fixtures%rowtype;
begin
  if v_uid is null then
    perform public.live_fail('live.not_signed_in', 'Sign in to use the match console.');
  end if;
  if not public.is_official() then
    perform public.live_fail('live.not_official', 'Only officials can run a match console.');
  end if;

  select * into v_fixture from public.fixtures where id = p_fixture_id for update;
  if not found then
    perform public.live_fail('live.fixture_not_found', 'That fixture doesn''t exist.');
  end if;
  if v_fixture.console_holder = v_uid then
    return v_fixture;  -- already yours: taking again is harmless
  end if;
  if v_fixture.console_holder is not null then
    perform public.live_fail('live.already_held',
      'Another official holds this match. Ask them to hand over, or ask the admin.');
  end if;
  if v_fixture.status in ('full_time', 'walkover', 'cancelled') then
    perform public.live_fail('live.fixture_closed', 'This match is over.');
  end if;

  update public.fixtures set console_holder = v_uid where id = p_fixture_id
  returning * into v_fixture;
  return v_fixture;
end;
$$;

create or replace function public.release_fixture(p_fixture_id uuid)
returns public.fixtures
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_fixture public.fixtures%rowtype;
begin
  if v_uid is null then
    perform public.live_fail('live.not_signed_in', 'Sign in to use the match console.');
  end if;

  select * into v_fixture from public.fixtures where id = p_fixture_id for update;
  if not found then
    perform public.live_fail('live.fixture_not_found', 'That fixture doesn''t exist.');
  end if;
  if v_fixture.console_holder is null then
    return v_fixture;  -- nobody holds it: releasing again is harmless
  end if;
  if v_fixture.console_holder <> v_uid and not public.is_admin() then
    perform public.live_fail('live.not_holder', 'Only the official holding this match can hand it over.');
  end if;

  update public.fixtures set console_holder = null where id = p_fixture_id
  returning * into v_fixture;
  return v_fixture;
end;
$$;

-- -----------------------------------------------------------------------------
-- Shared checks for console writes
-- -----------------------------------------------------------------------------
-- Locks and returns the fixture after checking the caller may write to it and
-- that it is a timed match.
create or replace function public.live_lock_fixture_for_console(p_fixture_id uuid)
returns public.fixtures
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fixture public.fixtures%rowtype;
  v_format  public.result_format;
begin
  if auth.uid() is null then
    perform public.live_fail('live.not_signed_in', 'Sign in to use the match console.');
  end if;

  select * into v_fixture from public.fixtures where id = p_fixture_id for update;
  if not found then
    perform public.live_fail('live.fixture_not_found', 'That fixture doesn''t exist.');
  end if;

  if v_fixture.home_team_id is null or v_fixture.away_team_id is null then
    perform public.live_fail('live.teams_not_set',
      'Both teams must be set before this match can be run.');
  end if;

  -- holds_fixture() is true for the holder and for admins. A holder who has
  -- since lost the official role is refused.
  if not (public.holds_fixture(p_fixture_id) and public.is_official()) then
    perform public.live_fail('live.not_holder',
      'Only the official holding this match can record it. Tap "Take this match" first.');
  end if;

  select s.result_format into v_format
  from public.events ev join public.sports s on s.id = ev.sport_id
  where ev.id = v_fixture.event_id;
  if v_format is distinct from 'timed' then
    perform public.live_fail('live.wrong_format',
      'This console only records timed matches (football, handball, basketball) so far.');
  end if;

  return v_fixture;
end;
$$;

-- Checks that a player belongs to a team and hasn't left the squad.
create or replace function public.live_check_player(p_player_id uuid, p_team_id uuid, p_label text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_team   uuid;
  v_status public.player_status;
begin
  select team_id, status into v_team, v_status from public.players where id = p_player_id;
  if not found then
    perform public.live_fail('live.player_not_found', format('The %s isn''t a known player.', p_label));
  end if;
  if v_team is distinct from p_team_id then
    perform public.live_fail('live.wrong_team', format('The %s doesn''t play for that team.', p_label));
  end if;
  if v_status = 'left' then
    perform public.live_fail('live.player_left', format('The %s has left the squad.', p_label));
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Console: set a team's lineup (before kickoff; admins at any time)
-- Replaces the team's whole lineup. Starters: 1 to 11 players.
-- -----------------------------------------------------------------------------
create or replace function public.set_lineup(
  p_fixture_id uuid,
  p_team_id    uuid,
  p_starters   uuid[],
  p_bench      uuid[] default '{}'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fixture public.fixtures%rowtype;
  v_all     uuid[];
  v_player  uuid;
  v_status  public.player_status;
  v_count   integer;
begin
  v_fixture := public.live_lock_fixture_for_console(p_fixture_id);

  if p_team_id is null
     or (p_team_id is distinct from v_fixture.home_team_id and p_team_id is distinct from v_fixture.away_team_id) then
    perform public.live_fail('live.wrong_team', 'That team isn''t playing in this fixture.');
  end if;
  if v_fixture.status <> 'scheduled' and not public.is_admin() then
    perform public.live_fail('live.lineup_locked', 'Lineups lock at kickoff. Ask the admin to change one.');
  end if;

  p_bench := coalesce(p_bench, '{}');
  if coalesce(cardinality(p_starters), 0) not between 1 and 11 then
    perform public.live_fail('live.invalid_lineup', 'Pick between 1 and 11 starters.');
  end if;

  v_all := p_starters || p_bench;
  if array_position(v_all, null) is not null then
    perform public.live_fail('live.invalid_lineup', 'The lineup has an empty player slot.');
  end if;
  if (select count(distinct x) from unnest(v_all) as x) <> cardinality(v_all) then
    perform public.live_fail('live.invalid_lineup', 'A player appears twice in the lineup.');
  end if;

  foreach v_player in array v_all loop
    perform public.live_check_player(v_player, p_team_id, 'lineup player');
    select status into v_status from public.players where id = v_player;
    if v_status = 'suspended' then
      perform public.live_fail('live.player_suspended', 'A suspended player can''t be in the lineup.');
    end if;
  end loop;

  delete from public.lineups where fixture_id = p_fixture_id and team_id = p_team_id;

  insert into public.lineups (fixture_id, team_id, player_id, role, set_by)
  select p_fixture_id, p_team_id, x, 'starter'::public.lineup_role, auth.uid() from unnest(p_starters) as x
  union all
  select p_fixture_id, p_team_id, x, 'bench'::public.lineup_role, auth.uid() from unnest(p_bench) as x;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Console: record one match event
-- One entry point for every event type, so the offline queue has one call to
-- replay. Retrying with the same client_event_id returns the original event.
--
-- Time: p_occurred_at is when the official tapped (it may be earlier than
-- now if the phone was offline). It is clamped to "not in the future" and
-- "not before the previous event", so the log always stays in order, and an
-- official can't send anything older than 6 hours. After full time an admin
-- may record goals, cards, substitutions, missed penalties and Man of the
-- Match at an earlier time, as a correction.
-- -----------------------------------------------------------------------------
create or replace function public.record_match_event(
  p_fixture_id      uuid,
  p_client_event_id uuid,
  p_type            public.match_event_type,
  p_occurred_at     timestamptz default null,
  p_period          public.match_period default null,
  p_team_id         uuid default null,
  p_player_id       uuid default null,
  p_other_player_id uuid default null,
  p_card            public.card_colour default null,
  p_is_penalty      boolean default false,
  p_is_own_goal     boolean default false,
  p_scored          boolean default null,
  p_points          smallint default null
)
returns public.match_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_is_admin   boolean := public.is_admin();
  v_fixture    public.fixtures%rowtype;
  v_existing   public.match_events%rowtype;
  v_last_at    timestamptz;
  v_at         timestamptz;
  v_period     public.match_period;
  v_opponent   uuid;
  v_correction boolean;
  v_lineups    boolean;
  v_event      public.match_events%rowtype;
begin
  if p_client_event_id is null or p_type is null then
    perform public.live_fail('live.invalid_input', 'An event needs a client_event_id and a type.');
  end if;

  v_fixture := public.live_lock_fixture_for_console(p_fixture_id);

  -- Idempotency (checked after the lock, so two retries can't both insert).
  select * into v_existing from public.match_events where client_event_id = p_client_event_id;
  if found then
    if v_existing.fixture_id <> p_fixture_id then
      perform public.live_fail('live.duplicate_id', 'That event ID was already used for another fixture.');
    end if;
    return v_existing;
  end if;

  if v_fixture.status in ('postponed', 'cancelled', 'walkover') then
    perform public.live_fail('live.fixture_closed', 'This fixture is postponed, cancelled or a walkover.');
  end if;
  if p_type = 'walkover' and not v_is_admin then
    perform public.live_fail('live.admin_only', 'Only the admin can record a walkover.');
  end if;

  -- An admin adding a missed event after full time is a correction.
  v_correction := v_is_admin
    and v_fixture.status = 'full_time'
    and p_type in ('goal', 'card', 'substitution', 'penalty_miss', 'man_of_the_match');

  -- Work out when the event happened.
  select max(occurred_at) into v_last_at
  from public.match_events where fixture_id = p_fixture_id and voided_at is null;

  -- Officials can't send events older than 6 hours (a stuck offline queue).
  -- The admin can, to enter a match afterwards from the referee's sheet.
  v_at := least(coalesce(p_occurred_at, now()), now());
  if not v_is_admin and v_at < now() - interval '6 hours' then
    perform public.live_fail('live.too_old', 'That event is more than 6 hours old. Ask the admin to enter it.');
  end if;
  if not v_correction and v_last_at is not null then
    v_at := greatest(v_at, v_last_at);
  end if;

  -- Is this event allowed in the match's current state?
  if v_correction then
    select ps.period into v_period
    from public.match_events ps
    where ps.fixture_id = p_fixture_id and ps.type = 'period_start'
      and ps.voided_at is null and ps.occurred_at <= v_at
    order by ps.occurred_at desc, ps.id desc
    limit 1;
    if v_period is null and p_type <> 'man_of_the_match' then
      perform public.live_fail('live.invalid_time', 'That time is before kickoff.');
    end if;
  else
    case p_type
      when 'period_start' then
        if v_fixture.status not in ('scheduled', 'half_time') then
          perform public.live_fail('live.invalid_state', 'End the current period first.');
        end if;
        -- The periods that may follow the current one.
        if p_period is null or not coalesce(p_period = any (
          case coalesce(v_fixture.current_period::text, 'none')
            when 'none'         then array['first_half']::public.match_period[]
            when 'first_half'   then array['second_half']::public.match_period[]
            when 'second_half'  then array['extra_first', 'penalties']::public.match_period[]
            when 'extra_first'  then array['extra_second']::public.match_period[]
            when 'extra_second' then array['penalties']::public.match_period[]
            else array[]::public.match_period[]
          end
        ), false) then
          perform public.live_fail('live.invalid_period', 'That period can''t start now.');
        end if;
        if p_period in ('extra_first', 'penalties') then
          if v_fixture.stage = 'league' then
            perform public.live_fail('live.invalid_period',
              'League matches end after the second half. Extra time and penalties are for knockouts.');
          end if;
          if v_fixture.home_score is distinct from v_fixture.away_score then
            perform public.live_fail('live.invalid_period',
              'Extra time and penalties only happen when the score is level.');
          end if;
        end if;
        v_period := p_period;

      when 'period_end' then
        if v_fixture.status <> 'live' or v_fixture.current_period = 'penalties' then
          perform public.live_fail('live.invalid_state', 'There''s no period running to end.');
        end if;
        v_period := v_fixture.current_period;

      when 'goal', 'penalty_miss' then
        if v_fixture.status <> 'live' or v_fixture.current_period = 'penalties' then
          perform public.live_fail('live.invalid_state', 'Goals and penalties are recorded while the ball is in play.');
        end if;
        v_period := v_fixture.current_period;

      when 'card', 'substitution' then
        if v_fixture.status not in ('live', 'half_time') then
          perform public.live_fail('live.invalid_state', 'Cards and substitutions are recorded once the match has started.');
        end if;
        if p_type = 'substitution' and v_fixture.current_period = 'penalties' then
          perform public.live_fail('live.invalid_state', 'No substitutions during a penalty shootout.');
        end if;
        v_period := v_fixture.current_period;

      when 'shootout_kick' then
        if v_fixture.status <> 'live' or v_fixture.current_period is distinct from 'penalties' then
          perform public.live_fail('live.invalid_state', 'Start the penalty shootout first.');
        end if;
        v_period := 'penalties';

      when 'man_of_the_match' then
        if v_fixture.status not in ('live', 'half_time', 'full_time') then
          perform public.live_fail('live.invalid_state', 'Man of the Match is picked once the match has started.');
        end if;
        v_period := v_fixture.current_period;

      when 'full_time' then
        if v_fixture.status not in ('live', 'half_time')
           or coalesce(v_fixture.current_period::text, '') not in ('second_half', 'extra_second', 'penalties') then
          perform public.live_fail('live.invalid_state', 'Full time comes after the second half.');
        end if;
        if v_fixture.stage <> 'league'
           and v_fixture.home_score is not distinct from v_fixture.away_score
           and coalesce(v_fixture.home_shootout, 0) = coalesce(v_fixture.away_shootout, 0) then
          perform public.live_fail('live.needs_winner',
            'A knockout match needs a winner. Go to extra time or penalties.');
        end if;
        v_period := v_fixture.current_period;

      when 'walkover' then
        if v_fixture.status <> 'scheduled' or v_last_at is not null then
          perform public.live_fail('live.invalid_state', 'A walkover is recorded instead of playing, before any events.');
        end if;
        v_period := null;
    end case;
  end if;

  if p_type = 'man_of_the_match' and exists (
    select 1 from public.match_events
    where fixture_id = p_fixture_id and type = 'man_of_the_match' and voided_at is null
  ) then
    perform public.live_fail('live.duplicate_motm', 'Man of the Match is already picked. Undo it to change it.');
  end if;

  -- Who was involved?
  if p_type in ('goal', 'card', 'substitution', 'penalty_miss', 'shootout_kick', 'walkover') then
    if p_team_id is null
       or (p_team_id is distinct from v_fixture.home_team_id and p_team_id is distinct from v_fixture.away_team_id) then
      perform public.live_fail('live.wrong_team', 'That team isn''t playing in this fixture.');
    end if;
    v_opponent := case when p_team_id = v_fixture.home_team_id
                       then v_fixture.away_team_id else v_fixture.home_team_id end;
  end if;

  case p_type
    when 'goal' then
      if p_is_own_goal then
        if p_other_player_id is not null then
          perform public.live_fail('live.invalid_input', 'An own goal has no assist.');
        end if;
        if p_player_id is not null then
          perform public.live_check_player(p_player_id, v_opponent, 'own-goal scorer');
        end if;
      else
        if p_player_id is not null then
          perform public.live_check_player(p_player_id, p_team_id, 'scorer');
        end if;
        if p_other_player_id is not null then
          perform public.live_check_player(p_other_player_id, p_team_id, 'assister');
          if p_other_player_id = p_player_id then
            perform public.live_fail('live.invalid_input', 'A player can''t assist his own goal.');
          end if;
        end if;
      end if;
    when 'card' then
      perform public.live_check_player(p_player_id, p_team_id, 'carded player');
    when 'substitution' then
      perform public.live_check_player(p_player_id, p_team_id, 'player coming off');
      perform public.live_check_player(p_other_player_id, p_team_id, 'player coming on');
    when 'penalty_miss' then
      perform public.live_check_player(p_player_id, p_team_id, 'penalty taker');
      if p_other_player_id is not null then
        perform public.live_check_player(p_other_player_id, v_opponent, 'goalkeeper');
      end if;
    when 'shootout_kick' then
      if p_player_id is not null then
        perform public.live_check_player(p_player_id, p_team_id, 'penalty taker');
      end if;
    when 'man_of_the_match' then
      if not exists (
        select 1 from public.players
        where id = p_player_id and team_id in (v_fixture.home_team_id, v_fixture.away_team_id)
      ) then
        perform public.live_fail('live.wrong_team', 'Man of the Match must play for one of the two teams.');
      end if;
    else
      null;
  end case;

  -- With lineups set, players must be on the pitch for what they did.
  -- Skipped for corrections, where "on the pitch" depends on the earlier time.
  if not v_correction and p_type in ('goal', 'card', 'substitution', 'penalty_miss') then
    perform public.live_check_on_pitch(
      p_fixture_id, p_type, p_team_id, v_opponent, p_player_id, p_other_player_id, p_is_own_goal);
  end if;

  insert into public.match_events (
    fixture_id, client_event_id, type, period, team_id, player_id, other_player_id,
    card, is_penalty, is_own_goal, scored, points, occurred_at, recorded_by
  ) values (
    p_fixture_id, p_client_event_id, p_type, v_period,
    case when p_type = 'man_of_the_match' then null else p_team_id end,
    p_player_id,
    p_other_player_id,
    case when p_type = 'card' then p_card end,
    p_type = 'goal' and coalesce(p_is_penalty, false),
    p_type = 'goal' and coalesce(p_is_own_goal, false),
    case when p_type = 'shootout_kick' then p_scored end,
    case
      when p_type = 'goal' then coalesce(p_points, 1)
      when p_type = 'walkover' then coalesce(p_points, 3)
    end,
    v_at,
    v_uid
  )
  returning * into v_event;

  return v_event;
end;
$$;

-- Lineup checks for record_match_event. A team without a lineup is not
-- checked (the console can run without lineups if needed).
create or replace function public.live_check_on_pitch(
  p_fixture_id      uuid,
  p_type            public.match_event_type,
  p_team_id         uuid,
  p_opponent_id     uuid,
  p_player_id       uuid,
  p_other_player_id uuid,
  p_is_own_goal     boolean
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_team_has_lineup     boolean;
  v_opponent_has_lineup boolean;
begin
  v_team_has_lineup := exists (
    select 1 from public.lineups where fixture_id = p_fixture_id and team_id = p_team_id);
  v_opponent_has_lineup := exists (
    select 1 from public.lineups where fixture_id = p_fixture_id and team_id = p_opponent_id);

  if p_type = 'goal' then
    if p_is_own_goal then
      if p_player_id is not null and v_opponent_has_lineup
         and not public.live_is_on_pitch(p_fixture_id, p_player_id) then
        perform public.live_fail('live.not_on_pitch', 'The own-goal scorer isn''t on the pitch.');
      end if;
    elsif v_team_has_lineup then
      if p_player_id is not null and not public.live_is_on_pitch(p_fixture_id, p_player_id) then
        perform public.live_fail('live.not_on_pitch', 'The scorer isn''t on the pitch.');
      end if;
      if p_other_player_id is not null and not public.live_is_on_pitch(p_fixture_id, p_other_player_id) then
        perform public.live_fail('live.not_on_pitch', 'The assister isn''t on the pitch.');
      end if;
    end if;

  elsif p_type = 'card' and v_team_has_lineup then
    if not exists (select 1 from public.lineups where fixture_id = p_fixture_id and player_id = p_player_id) then
      perform public.live_fail('live.not_in_lineup', 'That player isn''t in the lineup.');
    end if;
    if exists (
      select 1 from public.fixture_player_state(p_fixture_id) s
      where s.player_id = p_player_id and s.sent_off
    ) then
      perform public.live_fail('live.sent_off', 'That player has already been sent off.');
    end if;

  elsif p_type = 'substitution' and v_team_has_lineup then
    if not public.live_is_on_pitch(p_fixture_id, p_player_id) then
      perform public.live_fail('live.not_on_pitch', 'The player coming off isn''t on the pitch.');
    end if;
    if not exists (
      select 1 from public.fixture_player_state(p_fixture_id) s
      where s.player_id = p_other_player_id
        and s.lineup_role = 'bench' and not s.appeared and not s.sent_off
    ) then
      perform public.live_fail('live.not_on_bench',
        'The player coming on must be an unused substitute on the bench.');
    end if;

  elsif p_type = 'penalty_miss' then
    if v_team_has_lineup and not public.live_is_on_pitch(p_fixture_id, p_player_id) then
      perform public.live_fail('live.not_on_pitch', 'The penalty taker isn''t on the pitch.');
    end if;
    if p_other_player_id is not null and v_opponent_has_lineup
       and not public.live_is_on_pitch(p_fixture_id, p_other_player_id) then
      perform public.live_fail('live.not_on_pitch', 'The goalkeeper isn''t on the pitch.');
    end if;
  end if;
end;
$$;

create or replace function public.live_is_on_pitch(p_fixture_id uuid, p_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select s.on_pitch from public.fixture_player_state(p_fixture_id) s
    where s.player_id = p_player_id
  ), false);
$$;

-- -----------------------------------------------------------------------------
-- Console: void (undo) an event
--   * The holder can undo their own latest event within 30 seconds of the
--     server receiving it. The console shows a 10-second undo button; the
--     extra time covers a slow connection.
--   * The admin can void any event at any time, with a reason (a correction).
-- Voiding an already-voided event returns it unchanged, so retries are safe.
-- -----------------------------------------------------------------------------
create or replace function public.void_match_event(
  p_client_event_id uuid,
  p_reason          text default null
)
returns public.match_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_event   public.match_events%rowtype;
  v_latest  bigint;
  v_reason  text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select * into v_event from public.match_events where client_event_id = p_client_event_id;
  if not found then
    perform public.live_fail('live.event_not_found', 'That event wasn''t found. It may not have been sent yet.');
  end if;

  perform public.live_lock_fixture_for_console(v_event.fixture_id);

  -- Re-read under the fixture lock.
  select * into v_event from public.match_events where client_event_id = p_client_event_id;
  if v_event.voided_at is not null then
    return v_event;
  end if;

  if public.is_admin() then
    if v_reason is null or length(v_reason) < 3 then
      perform public.live_fail('live.reason_required', 'Give a short reason for the correction.');
    end if;
  else
    if v_event.recorded_by is distinct from v_uid then
      perform public.live_fail('live.undo_not_allowed', 'You can only undo events you recorded.');
    end if;
    if v_event.recorded_at < now() - interval '30 seconds' then
      perform public.live_fail('live.undo_expired', 'Too late to undo. Ask the admin to correct it.');
    end if;
    select id into v_latest
    from public.match_events
    where fixture_id = v_event.fixture_id and voided_at is null
    order by occurred_at desc, id desc
    limit 1;
    if v_latest <> v_event.id then
      perform public.live_fail('live.undo_not_latest', 'Only the most recent event can be undone.');
    end if;
  end if;

  update public.match_events
  set voided_at   = now(),
      voided_by   = v_uid,
      void_reason = coalesce(v_reason, 'Undone on the console')
  where id = v_event.id
  returning * into v_event;

  return v_event;
end;
$$;

-- -----------------------------------------------------------------------------
-- match_timeline: active events with the match minute and names, ready for
-- the match page. Runs with the caller's rights.
-- -----------------------------------------------------------------------------
create or replace view public.match_timeline
with (security_invoker = true)
as
select
  e.id,
  e.fixture_id,
  e.client_event_id,
  e.type,
  e.period,
  e.team_id,
  t.short_name       as team_short_name,
  e.player_id,
  p1.display_name    as player_name,
  e.other_player_id,
  p2.display_name    as other_player_name,
  e.card,
  e.is_penalty,
  e.is_own_goal,
  e.scored,
  e.points,
  e.occurred_at,
  m.minute,
  m.added_minutes
from public.match_events e
join public.fixtures f on f.id = e.fixture_id
join public.events ev on ev.id = f.event_id
left join public.teams t on t.id = e.team_id
left join public.players p1 on p1.id = e.player_id
left join public.players p2 on p2.id = e.other_player_id
left join lateral (
  select ps.occurred_at
  from public.match_events ps
  where ps.fixture_id = e.fixture_id
    and ps.type = 'period_start'
    and ps.period = e.period
    and ps.voided_at is null
  order by ps.occurred_at desc, ps.id desc
  limit 1
) period_start on true
left join lateral public.match_minute(
  e.period, period_start.occurred_at, e.occurred_at, ev.period_minutes, ev.extra_period_minutes
) m on true
where e.voided_at is null;

grant select on public.match_timeline to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Row-level security. Everyone reads; nobody writes directly. All writes go
-- through the console functions above (SECURITY DEFINER, with their own checks).
-- -----------------------------------------------------------------------------
alter table public.match_events enable row level security;
alter table public.lineups      enable row level security;

drop policy if exists "Anyone reads match events" on public.match_events;
create policy "Anyone reads match events" on public.match_events
  for select to anon, authenticated using (true);

drop policy if exists "Anyone reads lineups" on public.lineups;
create policy "Anyone reads lineups" on public.lineups
  for select to anon, authenticated using (true);

revoke insert, update, delete, truncate on public.match_events from anon, authenticated;
revoke insert, update, delete, truncate on public.lineups      from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Function permissions. Supabase lets anon and authenticated execute new
-- functions by default, so each one is set explicitly.
-- -----------------------------------------------------------------------------
-- Console API: signed-in users only (each function checks the role itself).
revoke all on function public.record_match_event(uuid, uuid, public.match_event_type, timestamptz,
  public.match_period, uuid, uuid, uuid, public.card_colour, boolean, boolean, boolean, smallint)
  from public, anon;
grant execute on function public.record_match_event(uuid, uuid, public.match_event_type, timestamptz,
  public.match_period, uuid, uuid, uuid, public.card_colour, boolean, boolean, boolean, smallint)
  to authenticated;

revoke all on function public.void_match_event(uuid, text)               from public, anon;
grant execute on function public.void_match_event(uuid, text)            to authenticated;
revoke all on function public.set_lineup(uuid, uuid, uuid[], uuid[])     from public, anon;
grant execute on function public.set_lineup(uuid, uuid, uuid[], uuid[])  to authenticated;
revoke all on function public.take_fixture(uuid)                         from public, anon;
grant execute on function public.take_fixture(uuid)                      to authenticated;
revoke all on function public.release_fixture(uuid)                      from public, anon;
grant execute on function public.release_fixture(uuid)                   to authenticated;

-- Public read helpers.
grant execute on function public.fixture_player_state(uuid) to anon, authenticated;
grant execute on function public.match_minute(public.match_period, timestamptz, timestamptz, integer, integer)
  to anon, authenticated;

-- Internal helpers: not callable from the app.
revoke all on function public.live_fail(text, text)                       from public, anon, authenticated;
revoke all on function public.refresh_fixture_state(uuid)                 from public, anon, authenticated;
revoke all on function public.live_lock_fixture_for_console(uuid)         from public, anon, authenticated;
revoke all on function public.live_check_player(uuid, uuid, text)         from public, anon, authenticated;
revoke all on function public.live_check_on_pitch(uuid, public.match_event_type, uuid, uuid, uuid, uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.live_is_on_pitch(uuid, uuid)                from public, anon, authenticated;
revoke all on function public.match_events_append_only()                  from public, anon, authenticated;
revoke all on function public.match_events_refresh_fixture()              from public, anon, authenticated;
revoke all on function public.guard_fixture_live_columns()                from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Realtime: open pages and consoles get changes without refreshing.
-- See "Realtime guide" in docs/live-scores.md.
-- -----------------------------------------------------------------------------
do $$
declare
  v_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;
  foreach v_table in array array['fixtures', 'match_events', 'lineups'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end $$;
