-- =============================================================================
-- Live scores, phase 3 (part 2 of 2): every result format and the championship
-- Owner: Bolu (live scores backend)
-- Needs 20261123064500_live_phase3_types.sql applied first (in its own run).
-- PRD: "Result formats", "Console", "Overall championship"
-- Rules: the organisers' basketball, handball, volleyball and athletics
-- rulebooks (Drive, 15 Nov)
-- Guide for the team: docs/live-scores.md
--
-- What this adds
--   * Event rules: period lengths, set rules, league points and heat
--     qualifiers live on events, so the admin can change them. Basketball,
--     handball, volleyball and athletics are filled in from the rulebooks;
--     the other sports get standard rules the organisers can change.
--   * Timed: basketball quarters and overtime; handball halves of 15 minutes
--     with 7-metre throws (the shootout) when a knockout ends level.
--   * Sets (volleyball, badminton, table tennis, lawn tennis): points, closing
--     a set, sets won; the match ends by itself when a team wins enough sets.
--   * Head-to-head (board games, mobile games, Mortal Kombat): optional score
--     and a result with the winner.
--   * Ranked (athletics, swimming): entrants, results with places, times,
--     DNF/DNS/DQ, publishing, and heats feeding the final.
--   * event_standings: group tables for every sport except football
--     (rulebook order: points, head-to-head, score difference, score for).
--   * advance_knockouts(): fills best-loser, semi-final, third-place and final
--     fixtures from the group table and earlier rounds, as each is decided.
--   * event_medals and medal_table: gold, silver and bronze per event and the
--     overall championship, ranked by medals or by points (an admin setting,
--     because the organisers haven't decided the rule yet).
--
-- Football is unchanged: the same periods, rules and tests apply.
-- Error handling: as before, rule violations raise SQLSTATE P0001 with a
-- stable code in HINT (live.*).
--
-- Safe to run twice.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Event rules
-- -----------------------------------------------------------------------------
alter table public.events
  add column if not exists sets_to_win         smallint,
  add column if not exists set_points          smallint,
  add column if not exists final_set_points    smallint,
  add column if not exists set_win_by          smallint,
  add column if not exists set_points_cap      smallint,
  add column if not exists win_points          smallint,
  add column if not exists draw_points         smallint,
  add column if not exists loss_points         smallint,
  add column if not exists qualifiers_per_heat smallint;

do $$ begin
  alter table public.events add constraint events_rules_check check (
        (sets_to_win is null or sets_to_win between 1 and 5)
    and (set_points is null or set_points between 1 and 99)
    and (final_set_points is null or final_set_points between 1 and 99)
    and (set_win_by is null or set_win_by between 1 and 5)
    and (set_points_cap is null or set_points_cap >= greatest(set_points, final_set_points))
    and (win_points is null or win_points between 0 and 10)
    and (draw_points is null or draw_points between 0 and 10)
    and (loss_points is null or loss_points between 0 and 10)
    and (qualifiers_per_heat is null or qualifiers_per_heat between 1 and 20)
  );
exception when duplicate_object then null; end $$;

comment on column public.events.period_count is
  'Timed sports: 2 halves (football, handball) or 4 quarters (basketball).';
comment on column public.events.extra_period_minutes is
  'Timed sports: length of each extra-time half (football) or overtime period (basketball).';
comment on column public.events.sets_to_win is 'Sets: sets needed to win the match (2 = best of 3).';
comment on column public.events.set_points is 'Sets: points (or games) to win a set.';
comment on column public.events.final_set_points is 'Sets: points to win the deciding set, if different.';
comment on column public.events.set_win_by is 'Sets: winning margin needed (usually 2).';
comment on column public.events.set_points_cap is 'Sets: a set ends at this score even without the margin (badminton 30).';
comment on column public.events.win_points is 'Group table: points for a win (draw_points and loss_points likewise).';
comment on column public.events.qualifiers_per_heat is 'Ranked: finishers per heat who go through to the final.';

-- Rules from the organisers' rulebooks. Only empty values are filled, so an
-- admin's later change is never overwritten.
update public.events ev set
  period_minutes       = coalesce(ev.period_minutes, 10),
  period_count         = coalesce(ev.period_count, 4),
  extra_period_minutes = coalesce(ev.extra_period_minutes, 3),
  win_points           = coalesce(ev.win_points, 2),
  draw_points          = coalesce(ev.draw_points, 1),
  loss_points          = coalesce(ev.loss_points, 0)
from public.sports s
where s.id = ev.sport_id and s.slug = 'basketball';

update public.events ev set
  sets_to_win      = coalesce(ev.sets_to_win, 2),
  set_points       = coalesce(ev.set_points, 25),
  final_set_points = coalesce(ev.final_set_points, 15),
  set_win_by       = coalesce(ev.set_win_by, 2),
  win_points       = coalesce(ev.win_points, 3),
  draw_points      = coalesce(ev.draw_points, 0),
  loss_points      = coalesce(ev.loss_points, 0)
from public.sports s
where s.id = ev.sport_id and s.slug = 'volleyball';

-- Handball rulebook: two 15-minute halves, win 2 / draw 1 / loss 0, and a
-- level knockout goes straight to 7-metre throws (no extra time, so
-- extra_period_minutes stays empty).
update public.events ev set
  period_minutes = coalesce(ev.period_minutes, 15),
  period_count = coalesce(ev.period_count, 2),
  win_points   = coalesce(ev.win_points, 2),
  draw_points  = coalesce(ev.draw_points, 1),
  loss_points  = coalesce(ev.loss_points, 0)
from public.sports s
where s.id = ev.sport_id and s.slug = 'handball';

update public.events ev set
  win_points  = coalesce(ev.win_points, 3),
  draw_points = coalesce(ev.draw_points, 1),
  loss_points = coalesce(ev.loss_points, 0)
from public.sports s
where s.id = ev.sport_id and s.slug = 'football';

update public.events ev set
  sets_to_win    = coalesce(ev.sets_to_win, 2),
  set_points     = coalesce(ev.set_points, case s.slug when 'badminton' then 21 when 'table-tennis' then 11 else 6 end),
  set_win_by     = coalesce(ev.set_win_by, 2),
  set_points_cap = coalesce(ev.set_points_cap, case s.slug when 'badminton' then 30 when 'lawn-tennis' then 7 end),
  win_points     = coalesce(ev.win_points, 3),
  draw_points    = coalesce(ev.draw_points, 0),
  loss_points    = coalesce(ev.loss_points, 0)
from public.sports s
where s.id = ev.sport_id and s.slug in ('badminton', 'table-tennis', 'lawn-tennis');

update public.events ev set
  win_points  = coalesce(ev.win_points, 3),
  draw_points = coalesce(ev.draw_points, 1),
  loss_points = coalesce(ev.loss_points, 0)
from public.sports s
where s.id = ev.sport_id and s.result_format = 'head_to_head';

update public.events ev set
  qualifiers_per_heat = coalesce(ev.qualifiers_per_heat, 2)
from public.sports s
where s.id = ev.sport_id and s.result_format = 'ranked';

-- -----------------------------------------------------------------------------
-- Derived set columns on fixtures (sets format only)
--   home_score / away_score: sets won
--   current_set, home_set_points, away_set_points: the set being played
-- -----------------------------------------------------------------------------
alter table public.fixtures
  add column if not exists current_set     smallint,
  add column if not exists home_set_points smallint,
  add column if not exists away_set_points smallint;

-- -----------------------------------------------------------------------------
-- The shape of each event type, now with point and set_end.
-- -----------------------------------------------------------------------------
alter table public.match_events drop constraint if exists match_events_shape;
alter table public.match_events add constraint match_events_shape check (
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
    when 'point'            then team_id is not null and points between 1 and 99
    when 'set_end'          then true
  end
);

-- -----------------------------------------------------------------------------
-- Match clock for quarters and overtime. Football is unchanged.
-- Basketball: quarters start at 0, 10, 20 and 30; overtime at 40 (every
-- overtime period counts from 40, since the period names don't number them).
-- -----------------------------------------------------------------------------
create or replace function public.live_period_offset(
  p_period               public.match_period,
  p_period_minutes       integer,
  p_extra_period_minutes integer
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_period
    when 'first_half'     then 0
    when 'second_half'    then p_period_minutes
    when 'extra_first'    then 2 * p_period_minutes
    when 'extra_second'   then 2 * p_period_minutes + p_extra_period_minutes
    when 'first_quarter'  then 0
    when 'second_quarter' then p_period_minutes
    when 'third_quarter'  then 2 * p_period_minutes
    when 'fourth_quarter' then 3 * p_period_minutes
    when 'overtime'       then 4 * p_period_minutes
  end;
$$;

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
      public.live_period_offset(p_period, p_period_minutes, p_extra_period_minutes) as offset_minutes,
      case
        when p_period in ('extra_first', 'extra_second', 'overtime') then p_extra_period_minutes
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

create or replace function public.live_period_end_minute(
  p_period               public.match_period,
  p_period_minutes       integer,
  p_extra_period_minutes integer
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select public.live_period_offset(p_period, p_period_minutes, p_extra_period_minutes)
       + case
           when p_period in ('extra_first', 'extra_second', 'overtime') then p_extra_period_minutes
           else p_period_minutes
         end;
$$;

-- -----------------------------------------------------------------------------
-- Set rules
-- -----------------------------------------------------------------------------

-- Points needed to win set p_set_number.
create or replace function public.live_set_target(p_event public.events, p_set_number integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_set_number = 2 * p_event.sets_to_win - 1 and p_event.final_set_points is not null
      then p_event.final_set_points
    else p_event.set_points
  end;
$$;

-- Is h-a a finished set? 25-20, 27-25 and (with a cap of 30) 30-29 are;
-- 24-22, 26-23 and 30-25 aren't.
create or replace function public.live_set_is_won(
  p_home integer, p_away integer, p_target integer, p_win_by integer, p_cap integer
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
       (greatest(p_home, p_away) >= p_target
        and abs(p_home - p_away) >= coalesce(p_win_by, 1)
        and (greatest(p_home, p_away) = p_target or abs(p_home - p_away) = coalesce(p_win_by, 1)))
    or (p_cap is not null and greatest(p_home, p_away) = p_cap and p_home <> p_away),
    false);
$$;

-- -----------------------------------------------------------------------------
-- Derived fixture state, for every format except ranked (races set their own
-- state when results are published).
--   timed:        as before; quarters and overtime are periods like halves.
--   sets:         points build the current set; set_end closes it; the match
--                 is over when a team wins sets_to_win sets. home_score and
--                 away_score are sets won. A set break shows as half_time.
--   head_to_head: points add to the score; full_time ends the game, with the
--                 winner from full_time's team, else the higher score.
-- -----------------------------------------------------------------------------
create or replace function public.refresh_fixture_state(p_fixture_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  f          public.fixtures%rowtype;
  ev         public.events%rowtype;
  v_format   public.result_format;
  e          public.match_events%rowtype;
  v_status   public.fixture_status;
  v_period   public.match_period;
  v_started  timestamptz;
  v_home     integer;
  v_away     integer;
  v_hs       integer;
  v_as       integer;
  v_winner   uuid;
  v_set      integer;
  v_set_home integer;
  v_set_away integer;
  v_declared uuid;
begin
  select * into f from public.fixtures where id = p_fixture_id;
  if not found then
    return;
  end if;
  select * into ev from public.events where id = f.event_id;
  select s.result_format into v_format from public.sports s where s.id = ev.sport_id;
  if v_format = 'ranked' then
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
      when 'point' then
        v_status := 'live';
        v_home   := coalesce(v_home, 0);
        v_away   := coalesce(v_away, 0);
        if v_format = 'sets' then
          v_set      := coalesce(v_set, 1);
          v_set_home := coalesce(v_set_home, 0) + case when e.team_id = f.home_team_id then e.points else 0 end;
          v_set_away := coalesce(v_set_away, 0) + case when e.team_id = f.home_team_id then 0 else e.points end;
        elsif e.team_id = f.home_team_id then
          v_home := v_home + e.points;
        else
          v_away := v_away + e.points;
        end if;
      when 'set_end' then
        if coalesce(v_set_home, 0) > coalesce(v_set_away, 0) then
          v_home := coalesce(v_home, 0) + 1;
        elsif coalesce(v_set_away, 0) > coalesce(v_set_home, 0) then
          v_away := coalesce(v_away, 0) + 1;
        end if;
        v_set      := coalesce(v_set, 1) + 1;
        v_set_home := 0;
        v_set_away := 0;
        if greatest(coalesce(v_home, 0), coalesce(v_away, 0)) >= coalesce(ev.sets_to_win, 1) then
          v_status := 'full_time';
        else
          v_status := 'half_time';
        end if;
      when 'full_time' then
        v_status   := 'full_time';
        v_started  := null;
        v_declared := e.team_id;
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
      when v_declared is not null then v_declared  -- a declared result (head-to-head, or a retirement)
      when v_home > v_away then f.home_team_id
      when v_away > v_home then f.away_team_id
      when coalesce(v_hs, 0) > coalesce(v_as, 0) then f.home_team_id
      when coalesce(v_as, 0) > coalesce(v_hs, 0) then f.away_team_id
      else null  -- a draw
    end;
  elsif v_status <> 'walkover' then
    v_winner := null;
  end if;

  -- The set in progress is only shown while the match is on.
  if v_format <> 'sets' or v_status not in ('live', 'half_time') then
    v_set := null; v_set_home := null; v_set_away := null;
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
      winner_team_id    = v_winner,
      current_set       = v_set,
      home_set_points   = v_set_home,
      away_set_points   = v_set_away
  where id = p_fixture_id
    and (status, current_period, period_started_at, home_score, away_score,
         home_shootout, away_shootout, winner_team_id, current_set, home_set_points, away_set_points)
        is distinct from
        (v_status, v_period, v_started, v_home, v_away, v_hs, v_as, v_winner, v_set, v_set_home, v_set_away);
  perform set_config('sees.live_refresh', 'off', true);
end;
$$;

-- -----------------------------------------------------------------------------
-- Guard on fixtures: as before, plus the set columns.
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
      new.current_period, new.period_started_at, new.winner_team_id,
      new.current_set, new.home_set_points, new.away_set_points)
     is distinct from
     (old.home_score, old.away_score, old.home_shootout, old.away_shootout,
      old.current_period, old.period_started_at, old.winner_team_id,
      old.current_set, old.home_set_points, old.away_set_points) then
    perform public.live_fail('live.derived_column',
      'Scores, periods and winners come from match events. Record or void an event instead.');
  end if;

  v_has_events := exists (
    select 1 from public.match_events where fixture_id = new.id and voided_at is null
  ) or exists (
    select 1 from public.race_entries where fixture_id = new.id and outcome is not null
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

-- -----------------------------------------------------------------------------
-- Console lock: every format now has a console. Ranked races have no home and
-- away team, so only timed, sets and head-to-head need both teams.
-- -----------------------------------------------------------------------------
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

  select s.result_format into v_format
  from public.events ev join public.sports s on s.id = ev.sport_id
  where ev.id = v_fixture.event_id;

  if v_format <> 'ranked' and (v_fixture.home_team_id is null or v_fixture.away_team_id is null) then
    perform public.live_fail('live.teams_not_set',
      'Both teams must be set before this match can be run.');
  end if;

  -- holds_fixture() is true for the holder and for admins. A holder who has
  -- since lost the official role is refused.
  if not (public.holds_fixture(p_fixture_id) and public.is_official()) then
    perform public.live_fail('live.not_holder',
      'Only the official holding this match can record it. Tap "Take this match" first.');
  end if;

  return v_fixture;
end;
$$;

-- -----------------------------------------------------------------------------
-- Console: record one match event (timed, sets and head-to-head)
-- Same entry point and rules as before for timed matches, plus:
--   * basketball quarters (first_quarter ... fourth_quarter), then overtime
--     while the score is level (repeatable);
--   * sets: point (team, optional player; officials send 1 point at a time,
--     the admin may enter a set's total) and set_end (closes the set; refused
--     unless the score is a finished set, e.g. 25-20 or 27-25);
--   * head-to-head: point (optional score) and full_time with the winner;
--   * the admin can end a sets match early (retirement) with full_time and
--     the winning team.
-- Ranked races use set_race_entries and record_race_results instead.
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
  v_ev         public.events%rowtype;
  v_format     public.result_format;
  v_existing   public.match_events%rowtype;
  v_last_at    timestamptz;
  v_at         timestamptz;
  v_period     public.match_period;
  v_next       public.match_period[];
  v_opponent   uuid;
  v_correction boolean;
  v_points     smallint;
  v_target     integer;
  v_event      public.match_events%rowtype;
begin
  if p_client_event_id is null or p_type is null then
    perform public.live_fail('live.invalid_input', 'An event needs a client_event_id and a type.');
  end if;

  v_fixture := public.live_lock_fixture_for_console(p_fixture_id);
  select * into v_ev from public.events where id = v_fixture.event_id;
  select s.result_format into v_format from public.sports s where s.id = v_ev.sport_id;

  -- Idempotency (checked after the lock, so two retries can't both insert).
  select * into v_existing from public.match_events where client_event_id = p_client_event_id;
  if found then
    if v_existing.fixture_id <> p_fixture_id then
      perform public.live_fail('live.duplicate_id', 'That event ID was already used for another fixture.');
    end if;
    return v_existing;
  end if;

  if v_format = 'ranked' then
    perform public.live_fail('live.wrong_format',
      'Races are entered with their entrants and results, not match events.');
  end if;
  if not (p_type = any (case v_format
      when 'timed' then array['period_start', 'period_end', 'goal', 'card', 'substitution', 'penalty_miss',
                              'shootout_kick', 'man_of_the_match', 'full_time', 'walkover']::public.match_event_type[]
      when 'sets' then array['point', 'set_end', 'man_of_the_match', 'full_time', 'walkover']::public.match_event_type[]
      else array['point', 'man_of_the_match', 'full_time', 'walkover']::public.match_event_type[]
    end)) then
    perform public.live_fail('live.wrong_format', 'That event doesn''t belong to this sport''s format.');
  end if;

  if v_fixture.status in ('postponed', 'cancelled', 'walkover') then
    perform public.live_fail('live.fixture_closed', 'This fixture is postponed, cancelled or a walkover.');
  end if;
  if p_type = 'walkover' and not v_is_admin then
    perform public.live_fail('live.admin_only', 'Only the admin can record a walkover.');
  end if;

  -- An admin adding a missed event after full time is a correction (timed).
  v_correction := v_is_admin
    and v_format = 'timed'
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

  elsif v_format = 'timed' then
    case p_type
      when 'period_start' then
        if v_ev.period_minutes is null then
          perform public.live_fail('live.event_not_configured',
            'Set this event''s period length before the match starts.');
        end if;
        if v_fixture.status not in ('scheduled', 'half_time') then
          perform public.live_fail('live.invalid_state', 'End the current period first.');
        end if;
        -- The periods that may follow the current one.
        if coalesce(v_ev.period_count, 2) = 4 then
          v_next := case coalesce(v_fixture.current_period::text, 'none')
            when 'none'           then array['first_quarter']::public.match_period[]
            when 'first_quarter'  then array['second_quarter']::public.match_period[]
            when 'second_quarter' then array['third_quarter']::public.match_period[]
            when 'third_quarter'  then array['fourth_quarter']::public.match_period[]
            when 'fourth_quarter' then array['overtime']::public.match_period[]
            when 'overtime'       then array['overtime']::public.match_period[]
            else array[]::public.match_period[]
          end;
        else
          v_next := case coalesce(v_fixture.current_period::text, 'none')
            when 'none'         then array['first_half']::public.match_period[]
            when 'first_half'   then array['second_half']::public.match_period[]
            when 'second_half'  then array['extra_first', 'penalties']::public.match_period[]
            when 'extra_first'  then array['extra_second']::public.match_period[]
            when 'extra_second' then array['penalties']::public.match_period[]
            else array[]::public.match_period[]
          end;
        end if;
        if p_period is null or not coalesce(p_period = any (v_next), false) then
          perform public.live_fail('live.invalid_period', 'That period can''t start now.');
        end if;
        if p_period = 'extra_first' and v_ev.extra_period_minutes is null then
          perform public.live_fail('live.invalid_period',
            'This sport has no extra time. A level knockout goes straight to penalties.');
        end if;
        if p_period in ('extra_first', 'penalties') then
          if v_fixture.stage in ('league', 'group') then
            perform public.live_fail('live.invalid_period',
              'Group matches end after the second half. Extra time and penalties are for knockouts.');
          end if;
          if v_fixture.home_score is distinct from v_fixture.away_score then
            perform public.live_fail('live.invalid_period',
              'Extra time and penalties only happen when the score is level.');
          end if;
        end if;
        if p_period = 'overtime' then
          if v_ev.extra_period_minutes is null then
            perform public.live_fail('live.event_not_configured', 'Set this event''s overtime length first.');
          end if;
          if v_fixture.home_score is distinct from v_fixture.away_score then
            perform public.live_fail('live.invalid_period', 'Overtime only happens when the score is level.');
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
           or coalesce(v_fixture.current_period::text, '') not in
              ('second_half', 'extra_second', 'penalties', 'fourth_quarter', 'overtime') then
          perform public.live_fail('live.invalid_state', 'Full time comes after the last period.');
        end if;
        if v_fixture.stage not in ('league', 'group')
           and v_fixture.home_score is not distinct from v_fixture.away_score
           and coalesce(v_fixture.home_shootout, 0) = coalesce(v_fixture.away_shootout, 0) then
          perform public.live_fail('live.needs_winner',
            'A knockout match needs a winner. Go to extra time, overtime or penalties.');
        end if;
        v_period := v_fixture.current_period;

      when 'walkover' then
        if v_fixture.status <> 'scheduled' or v_last_at is not null then
          perform public.live_fail('live.invalid_state', 'A walkover is recorded instead of playing, before any events.');
        end if;
        v_period := null;
    end case;

  else
    -- Sets and head-to-head.
    if v_format = 'sets' and v_ev.set_points is null then
      perform public.live_fail('live.event_not_configured',
        'Set this event''s set rules (points per set, sets to win) first.');
    end if;
    case p_type
      when 'point' then
        if v_fixture.status not in ('scheduled', 'live', 'half_time') then
          perform public.live_fail('live.invalid_state', 'This match is over.');
        end if;
        v_points := coalesce(p_points, 1);
        if not v_is_admin and v_points <> 1 then
          perform public.live_fail('live.invalid_input', 'Add one point at a time.');
        end if;
        if v_format = 'sets' and not v_is_admin and public.live_set_is_won(
             coalesce(v_fixture.home_set_points, 0), coalesce(v_fixture.away_set_points, 0),
             public.live_set_target(v_ev, coalesce(v_fixture.current_set, 1)), v_ev.set_win_by, v_ev.set_points_cap) then
          perform public.live_fail('live.set_over', 'This set is over. Close the set before adding points.');
        end if;

      when 'set_end' then
        if v_fixture.status <> 'live' then
          perform public.live_fail('live.invalid_state', 'There''s no set being played.');
        end if;
        v_target := public.live_set_target(v_ev, coalesce(v_fixture.current_set, 1));
        if not public.live_set_is_won(coalesce(v_fixture.home_set_points, 0), coalesce(v_fixture.away_set_points, 0),
                                      v_target, v_ev.set_win_by, v_ev.set_points_cap) then
          perform public.live_fail('live.set_not_over', format(
            'The set isn''t over at %s-%s. A set is won at %s with a %s-point lead.',
            coalesce(v_fixture.home_set_points, 0), coalesce(v_fixture.away_set_points, 0),
            v_target, coalesce(v_ev.set_win_by, 1)));
        end if;

      when 'man_of_the_match' then
        if v_fixture.status not in ('live', 'half_time', 'full_time') then
          perform public.live_fail('live.invalid_state', 'Man of the Match is picked once the match has started.');
        end if;

      when 'full_time' then
        if v_fixture.status not in ('scheduled', 'live', 'half_time') then
          perform public.live_fail('live.invalid_state', 'This match is already over.');
        end if;
        if v_format = 'sets' then
          -- A sets match ends by itself; full_time is the admin ending it early.
          if not v_is_admin then
            perform public.live_fail('live.admin_only',
              'A sets match ends when a team wins enough sets. Ask the admin to end it early (a retirement).');
          end if;
          if p_team_id is null then
            perform public.live_fail('live.needs_winner', 'Pick the winner when ending a match early.');
          end if;
        elsif p_team_id is null and v_fixture.stage not in ('league', 'group')
              and v_fixture.home_score is not distinct from v_fixture.away_score then
          perform public.live_fail('live.needs_winner', 'A knockout game needs a winner.');
        end if;

      when 'walkover' then
        if v_fixture.status <> 'scheduled' or v_last_at is not null then
          perform public.live_fail('live.invalid_state', 'A walkover is recorded instead of playing, before any events.');
        end if;
    end case;
    v_period := null;
  end if;

  if p_type = 'man_of_the_match' and exists (
    select 1 from public.match_events
    where fixture_id = p_fixture_id and type = 'man_of_the_match' and voided_at is null
  ) then
    perform public.live_fail('live.duplicate_motm', 'Man of the Match is already picked. Undo it to change it.');
  end if;

  -- Who was involved?
  if p_type in ('goal', 'card', 'substitution', 'penalty_miss', 'shootout_kick', 'walkover', 'point')
     or (p_type = 'full_time' and p_team_id is not null and v_format <> 'timed') then
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
            perform public.live_fail('live.invalid_input', 'A player can''t assist their own goal.');
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
    when 'point' then
      if p_player_id is not null then
        perform public.live_check_player(p_player_id, p_team_id, 'player');
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
    case when p_type in ('man_of_the_match', 'set_end') or (p_type = 'full_time' and v_format = 'timed') then null else p_team_id end,
    case when p_type = 'set_end' then null else p_player_id end,
    case when p_type in ('goal', 'substitution', 'penalty_miss') then p_other_player_id end,
    case when p_type = 'card' then p_card end,
    p_type = 'goal' and coalesce(p_is_penalty, false),
    p_type = 'goal' and coalesce(p_is_own_goal, false),
    case when p_type = 'shootout_kick' then p_scored end,
    case
      when p_type = 'goal' then coalesce(p_points, 1)
      when p_type = 'point' then v_points
      when p_type = 'walkover' and v_format = 'sets' then coalesce(v_ev.sets_to_win, 2)
      when p_type = 'walkover' then coalesce(p_points, 3)
    end,
    v_at,
    v_uid
  )
  returning * into v_event;

  return v_event;
end;
$$;

-- -----------------------------------------------------------------------------
-- fixture_set_scores: the score of every set (sets format)
-- set_number counts the set_end events before each point. complete = closed.
-- -----------------------------------------------------------------------------
create or replace view public.fixture_set_scores
with (security_invoker = true)
as
with ev as (
  select
    e.fixture_id, e.type, e.team_id, e.points,
    1 + coalesce(count(*) filter (where e.type = 'set_end') over (
          partition by e.fixture_id order by e.occurred_at, e.id
          rows between unbounded preceding and 1 preceding), 0) as set_number
  from public.match_events e
  join public.fixtures f on f.id = e.fixture_id
  join public.events evt on evt.id = f.event_id
  join public.sports s on s.id = evt.sport_id
  where s.result_format = 'sets' and e.voided_at is null and e.type in ('point', 'set_end')
)
select
  ev.fixture_id,
  ev.set_number::integer as set_number,
  coalesce(sum(ev.points) filter (where ev.type = 'point' and ev.team_id = f.home_team_id), 0)::integer as home_points,
  coalesce(sum(ev.points) filter (where ev.type = 'point' and ev.team_id = f.away_team_id), 0)::integer as away_points,
  bool_or(ev.type = 'set_end') as complete,
  case
    when not bool_or(ev.type = 'set_end') then null
    when coalesce(sum(ev.points) filter (where ev.type = 'point' and ev.team_id = f.home_team_id), 0)
       > coalesce(sum(ev.points) filter (where ev.type = 'point' and ev.team_id = f.away_team_id), 0)
      then f.home_team_id
    else f.away_team_id
  end as winner_team_id
from ev
join public.fixtures f on f.id = ev.fixture_id
group by ev.fixture_id, ev.set_number, f.home_team_id, f.away_team_id;

comment on view public.fixture_set_scores is 'Score of each set in a sets match (volleyball, badminton, table tennis, lawn tennis).';

-- =============================================================================
-- Ranked results (athletics, swimming)
-- A race is a fixture with no home or away team: a heat (stage heat_1,
-- heat_2, ...) or the final (stage final). Its entrants are race_entries:
-- a year (team) and, for individual races, the athlete's name. A relay entry
-- has no athlete. Athletes are named rather than added to players, which is
-- the football squad list the fantasy game picks from.
-- =============================================================================
create table if not exists public.race_entries (
  id          bigint generated always as identity primary key,
  fixture_id  uuid not null references public.fixtures (id) on delete restrict,
  team_id     uuid not null references public.teams (id) on delete restrict,
  player_id   uuid references public.players (id) on delete restrict,
  athlete_name text check (char_length(btrim(athlete_name)) between 1 and 80),
  lane        smallint check (lane between 1 and 20),
  outcome     public.race_outcome,   -- null until results are entered
  position    smallint check (position between 1 and 99),
  time_ms     integer check (time_ms > 0),
  mark_mm     integer check (mark_mm > 0),
  note        text check (char_length(note) <= 200),
  set_by      uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now(),
  -- A place only for finishers, and every finisher has one.
  constraint race_entries_position check ((outcome is distinct from 'finished') = (position is null))
);

-- One entry per year per athlete (by player or name) per race; one relay team.
create unique index if not exists race_entries_entrant_key
  on public.race_entries (fixture_id, team_id, (coalesce(player_id::text, lower(btrim(athlete_name)), '')));
create index if not exists race_entries_fixture_id_idx on public.race_entries (fixture_id);
create index if not exists race_entries_team_id_idx    on public.race_entries (team_id);
create index if not exists race_entries_player_id_idx  on public.race_entries (player_id);
create index if not exists race_entries_set_by_idx     on public.race_entries (set_by);

alter table public.race_entries enable row level security;

-- Entrants are public. Results show once the race is published (full time);
-- officials and the admin see them while they're being entered.
drop policy if exists "Race entries are public" on public.race_entries;
create policy "Race entries are public" on public.race_entries for select using (
  outcome is null
  or public.is_official()
  or exists (select 1 from public.fixtures f where f.id = fixture_id and f.status = 'full_time')
);

-- Written only through the functions below.
revoke insert, update, delete, truncate on public.race_entries from anon, authenticated;

drop trigger if exists race_entries_set_updated_at on public.race_entries;
create trigger race_entries_set_updated_at
  before update on public.race_entries
  for each row execute function public.set_updated_at();

-- Every change to a race result is in the admin's audit feed.
drop trigger if exists audit_row_change on public.race_entries;
create trigger audit_row_change
  after insert or update or delete on public.race_entries
  for each row execute function public.audit_row_change(
    'fixture_id', 'team_id', 'player_id', 'athlete_name', 'lane', 'outcome', 'position', 'time_ms', 'mark_mm', 'note'
  );

-- Locks a race for its console holder. Ranked only.
create or replace function public.live_lock_race(p_fixture_id uuid)
returns public.fixtures
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fixture public.fixtures%rowtype;
begin
  v_fixture := public.live_lock_fixture_for_console(p_fixture_id);
  if not exists (
    select 1 from public.events ev join public.sports s on s.id = ev.sport_id
    where ev.id = v_fixture.event_id and s.result_format = 'ranked'
  ) then
    perform public.live_fail('live.wrong_format', 'Only races (athletics, swimming) have entrants and results.');
  end if;
  if v_fixture.status in ('postponed', 'cancelled') then
    perform public.live_fail('live.fixture_closed', 'This race is postponed or cancelled.');
  end if;
  return v_fixture;
end;
$$;

-- Sets the race's status and winner (results go public when published).
create or replace function public.live_set_race_state(p_fixture_id uuid, p_status public.fixture_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_winner uuid;
begin
  if p_status = 'full_time' then
    select min(team_id::text)::uuid into v_winner
    from public.race_entries
    where fixture_id = p_fixture_id and position = 1
    having count(distinct team_id) = 1;
  end if;

  perform set_config('sees.live_refresh', 'on', true);
  update public.fixtures
  set status = p_status, winner_team_id = v_winner
  where id = p_fixture_id
    and (status, winner_team_id) is distinct from (p_status, v_winner);
  perform set_config('sees.live_refresh', 'off', true);
end;
$$;

-- The entrants in a set_race_entries request, as rows (already checked).
create or replace function public.live_race_rows(p_entries jsonb)
returns table (team_id uuid, player_id uuid, athlete_name text, entrant_key text, lane smallint)
language sql
immutable
set search_path = ''
as $$
  select (x ->> 'teamId')::uuid,
         nullif(x ->> 'playerId', '')::uuid,
         nullif(btrim(x ->> 'athleteName'), ''),
         coalesce(nullif(x ->> 'playerId', ''), lower(nullif(btrim(x ->> 'athleteName'), '')), ''),
         (x ->> 'lane')::smallint
  from jsonb_array_elements(p_entries) as x;
$$;

-- The key that identifies an entrant within a race and year.
create or replace function public.live_entrant_key(p_player_id uuid, p_athlete_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_player_id::text, lower(nullif(btrim(p_athlete_name), '')), '');
$$;

-- -----------------------------------------------------------------------------
-- set_race_entries: who runs (before results).
-- p_entries: [{"teamId": uuid, "athleteName": text | null, "lane": 1-20 | null}]
-- (or "playerId" for someone in the players list; neither for a relay team)
-- Replaces the race's entrants. Officials can change them until results are
-- entered; the admin at any time (results for removed entrants go with them).
-- -----------------------------------------------------------------------------
create or replace function public.set_race_entries(p_fixture_id uuid, p_entries jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fixture public.fixtures%rowtype;
  v_entry   jsonb;
  v_team    uuid;
  v_player  uuid;
  v_name    text;
  v_lane    integer;
  v_status  public.player_status;
  v_count   integer;
begin
  v_fixture := public.live_lock_race(p_fixture_id);

  if not public.is_admin() and (
    v_fixture.status <> 'scheduled'
    or exists (select 1 from public.race_entries where fixture_id = p_fixture_id and outcome is not null)
  ) then
    perform public.live_fail('live.results_entered',
      'Results are already in for this race. Ask the admin to change the entrants.');
  end if;

  if p_entries is null or jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 then
    perform public.live_fail('live.invalid_input', 'Add at least one entrant.');
  end if;
  if jsonb_array_length(p_entries) > 40 then
    perform public.live_fail('live.invalid_input', 'A race can have at most 40 entrants.');
  end if;

  for v_entry in select * from jsonb_array_elements(p_entries) loop
    begin
      v_team   := (v_entry ->> 'teamId')::uuid;
      v_player := nullif(v_entry ->> 'playerId', '')::uuid;
      v_name   := nullif(btrim(v_entry ->> 'athleteName'), '');
      v_lane   := (v_entry ->> 'lane')::integer;
    exception when others then
      perform public.live_fail('live.invalid_input', 'Each entrant needs a teamId, and playerId and lane must be valid.');
    end;
    if char_length(v_name) > 80 then
      perform public.live_fail('live.invalid_input', 'Keep athlete names under 80 characters.');
    end if;
    if v_player is not null and v_name is not null then
      perform public.live_fail('live.invalid_input', 'Give a playerId or an athleteName, not both.');
    end if;
    if v_team is null or not exists (select 1 from public.teams where id = v_team) then
      perform public.live_fail('live.wrong_team', 'An entrant''s year doesn''t exist.');
    end if;
    if v_lane is not null and v_lane not between 1 and 20 then
      perform public.live_fail('live.invalid_input', 'Lanes go from 1 to 20.');
    end if;
    if v_player is not null then
      perform public.live_check_player(v_player, v_team, 'athlete');
      select status into v_status from public.players where id = v_player;
      if v_status = 'suspended' then
        perform public.live_fail('live.player_suspended', 'A suspended athlete can''t be entered.');
      end if;
    end if;
  end loop;

  if exists (
    select 1 from public.live_race_rows(p_entries) t group by t.team_id, t.entrant_key having count(*) > 1
  ) then
    perform public.live_fail('live.invalid_input', 'An entrant appears twice.');
  end if;
  if exists (
    select 1 from public.live_race_rows(p_entries) t where t.lane is not null group by t.lane having count(*) > 1
  ) then
    perform public.live_fail('live.invalid_input', 'Two entrants have the same lane.');
  end if;

  delete from public.race_entries r
  where r.fixture_id = p_fixture_id
    and not exists (
      select 1 from public.live_race_rows(p_entries) t
      where t.team_id = r.team_id and t.entrant_key = public.live_entrant_key(r.player_id, r.athlete_name)
    );

  insert into public.race_entries (fixture_id, team_id, player_id, athlete_name, lane, set_by)
  select p_fixture_id, t.team_id, t.player_id, t.athlete_name, t.lane, auth.uid() from public.live_race_rows(p_entries) t
  on conflict (fixture_id, team_id, (coalesce(player_id::text, lower(btrim(athlete_name)), '')))
  do update set lane = excluded.lane, athlete_name = excluded.athlete_name, set_by = excluded.set_by
  where (public.race_entries.lane, public.race_entries.athlete_name)
        is distinct from (excluded.lane, excluded.athlete_name);

  select count(*) into v_count from public.race_entries where fixture_id = p_fixture_id;

  -- Removing finishers can change the winner of a published race.
  if v_fixture.status = 'full_time' then
    perform public.live_set_race_state(p_fixture_id, 'full_time');
  end if;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- record_race_results: places, times and outcomes.
-- p_results: [{"teamId", "athleteName" | "playerId" | neither (relay),
--              "outcome": "finished|dnf|dns|dq",
--              "position": 1-99 (finishers), "timeMs" | null, "markMm" | null,
--              "note" | null}]
-- Each result must match an entrant. Entrants not listed keep what they had.
-- p_publish = true checks every entrant has a result and the places run
-- 1, 2, 3 ... (equal places allowed: 1, 2, 2, 4), then makes the race final
-- (full_time). Officials can't change a published race; the admin can, and
-- can unpublish it with p_publish = false.
-- -----------------------------------------------------------------------------
create or replace function public.record_race_results(
  p_fixture_id uuid,
  p_results    jsonb,
  p_publish    boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fixture  public.fixtures%rowtype;
  v_result   jsonb;
  v_team     uuid;
  v_player   uuid;
  v_name     text;
  v_outcome  public.race_outcome;
  v_position integer;
  v_time     integer;
  v_mark     integer;
  v_note     text;
  v_entry_id bigint;
  v_count    integer := 0;
begin
  v_fixture := public.live_lock_race(p_fixture_id);

  if v_fixture.status = 'full_time' and not public.is_admin() then
    perform public.live_fail('live.results_published',
      'These results are published. Ask the admin to correct them.');
  end if;
  if p_results is null or jsonb_typeof(p_results) <> 'array' then
    perform public.live_fail('live.invalid_input', 'Results must be a list.');
  end if;

  for v_result in select * from jsonb_array_elements(p_results) loop
    begin
      v_team     := (v_result ->> 'teamId')::uuid;
      v_player   := nullif(v_result ->> 'playerId', '')::uuid;
      v_name     := nullif(btrim(v_result ->> 'athleteName'), '');
      v_outcome  := (v_result ->> 'outcome')::public.race_outcome;
      v_position := (v_result ->> 'position')::integer;
      v_time     := (v_result ->> 'timeMs')::integer;
      v_mark     := (v_result ->> 'markMm')::integer;
      v_note     := nullif(btrim(v_result ->> 'note'), '');
    exception when others then
      perform public.live_fail('live.invalid_input',
        'Each result needs a teamId and an outcome (finished, dnf, dns or dq); position, timeMs and markMm are whole numbers.');
    end;

    if v_outcome is null then
      perform public.live_fail('live.invalid_input', 'Each result needs an outcome.');
    end if;
    if v_outcome = 'finished' and (v_position is null or v_position not between 1 and 99) then
      perform public.live_fail('live.invalid_input', 'A finisher needs a place from 1 to 99.');
    end if;
    if v_outcome <> 'finished' and v_position is not null then
      perform public.live_fail('live.invalid_input', 'Only finishers have a place.');
    end if;
    if (v_time is not null and v_time <= 0) or (v_mark is not null and v_mark <= 0) then
      perform public.live_fail('live.invalid_input', 'Times and marks must be positive.');
    end if;
    if char_length(v_note) > 200 then
      perform public.live_fail('live.invalid_input', 'Keep the note under 200 characters.');
    end if;

    select id into v_entry_id from public.race_entries
    where fixture_id = p_fixture_id and team_id = v_team
      and public.live_entrant_key(player_id, athlete_name) = public.live_entrant_key(v_player, v_name);
    if not found then
      perform public.live_fail('live.not_entered', 'A result is for someone who isn''t entered in this race.');
    end if;

    update public.race_entries
    set outcome = v_outcome, position = case when v_outcome = 'finished' then v_position end,
        time_ms = v_time, mark_mm = v_mark, note = v_note, set_by = auth.uid()
    where id = v_entry_id
      and (outcome, position, time_ms, mark_mm, note)
          is distinct from (v_outcome, case when v_outcome = 'finished' then v_position end, v_time, v_mark, v_note);
    v_count := v_count + 1;
  end loop;

  if p_publish then
    if exists (select 1 from public.race_entries where fixture_id = p_fixture_id and outcome is null) then
      perform public.live_fail('live.results_incomplete', 'Every entrant needs a result before publishing.');
    end if;
    if not exists (select 1 from public.race_entries where fixture_id = p_fixture_id) then
      perform public.live_fail('live.results_incomplete', 'This race has no entrants.');
    end if;
    -- Places must be 1, 2, 3 ... with ties sharing a place (1, 2, 2, 4).
    if exists (
      select 1 from (
        select position, rank() over (order by position) as expected
        from public.race_entries where fixture_id = p_fixture_id and outcome = 'finished'
      ) x where x.position <> x.expected
    ) then
      perform public.live_fail('live.invalid_places', 'Places must run 1, 2, 3 ... (equal places share a number).');
    end if;
    perform public.live_set_race_state(p_fixture_id, 'full_time');
  elsif exists (select 1 from public.race_entries where fixture_id = p_fixture_id and outcome is not null) then
    perform public.live_set_race_state(p_fixture_id, 'live');
  else
    perform public.live_set_race_state(p_fixture_id, 'scheduled');
  end if;

  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- fill_race_final: the final's entrants from the heats (admin).
-- Every heat (stage heat_1, heat_2, ...) must be published. The top
-- qualifiers_per_heat finishers of each heat (2 by the athletics rulebook;
-- ties at the cut go through together) replace the final's entrants. Refused
-- once the final has results.
-- -----------------------------------------------------------------------------
create or replace function public.fill_race_final(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_final     public.fixtures%rowtype;
  v_qualifiers integer;
  v_count     integer;
begin
  if auth.uid() is null then
    perform public.live_fail('live.not_signed_in', 'Sign in as the admin to fill the final.');
  end if;
  if not public.is_admin() then
    perform public.live_fail('live.admin_only', 'Only the admin can fill the final.');
  end if;

  select coalesce(ev.qualifiers_per_heat, 2) into v_qualifiers
  from public.events ev join public.sports s on s.id = ev.sport_id
  where ev.id = p_event_id and s.result_format = 'ranked';
  if not found then
    perform public.live_fail('live.wrong_format', 'That isn''t a race event (athletics, swimming).');
  end if;

  if not exists (select 1 from public.fixtures where event_id = p_event_id and stage like 'heat%') then
    perform public.live_fail('live.invalid_state',
      'This event has no heats. Enter the final''s entrants on the final itself.');
  end if;
  if exists (
    select 1 from public.fixtures
    where event_id = p_event_id and stage like 'heat%' and status not in ('full_time', 'cancelled')
  ) then
    perform public.live_fail('live.heats_not_finished', 'Publish every heat''s results first.');
  end if;

  select * into v_final from public.fixtures
  where event_id = p_event_id and stage = 'final'
  order by kickoff_at nulls last, id limit 1
  for update;
  if not found then
    perform public.live_fail('live.fixture_not_found', 'This event has no final.');
  end if;
  if exists (select 1 from public.race_entries where fixture_id = v_final.id and outcome is not null) then
    perform public.live_fail('live.results_entered', 'The final already has results.');
  end if;

  perform public.admin_set_audit_context(jsonb_build_object('action', 'fill_race_final', 'eventId', p_event_id));

  delete from public.race_entries r
  where r.fixture_id = v_final.id
    and not exists (
      select 1 from public.race_entries h
      join public.fixtures hf on hf.id = h.fixture_id
      where hf.event_id = p_event_id and hf.stage like 'heat%' and hf.status = 'full_time'
        and h.outcome = 'finished' and h.position <= v_qualifiers
        and h.team_id = r.team_id
        and public.live_entrant_key(h.player_id, h.athlete_name) = public.live_entrant_key(r.player_id, r.athlete_name)
    );

  insert into public.race_entries (fixture_id, team_id, player_id, athlete_name, set_by)
  select v_final.id, h.team_id, h.player_id, h.athlete_name, auth.uid()
  from public.race_entries h
  join public.fixtures hf on hf.id = h.fixture_id
  where hf.event_id = p_event_id and hf.stage like 'heat%' and hf.status = 'full_time'
    and h.outcome = 'finished' and h.position <= v_qualifiers
  on conflict (fixture_id, team_id, (coalesce(player_id::text, lower(btrim(athlete_name)), ''))) do nothing;

  select count(*) into v_count from public.race_entries where fixture_id = v_final.id;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- race_results: a race's entrants and results, in finishing order.
-- Unpublished results are hidden from the public (place, time and outcome
-- show once the race is at full time); officials and the admin see them.
-- medal: gold, silver or bronze for places 1 to 3 in a published final.
-- -----------------------------------------------------------------------------
create or replace view public.race_results
with (security_invoker = true)
as
select
  r.id,
  r.fixture_id,
  f.event_id,
  f.stage,
  f.status as race_status,
  r.team_id,
  t.name       as team_name,
  t.short_name as team_short_name,
  t.year       as team_year,
  r.player_id,
  coalesce(p.display_name, r.athlete_name) as athlete_name,
  r.lane,
  case when f.status = 'full_time' or public.is_official() then r.outcome  end as outcome,
  case when f.status = 'full_time' or public.is_official() then r.position end as position,
  case when f.status = 'full_time' or public.is_official() then r.time_ms  end as time_ms,
  case when f.status = 'full_time' or public.is_official() then r.mark_mm  end as mark_mm,
  case when f.status = 'full_time' or public.is_official() then r.note     end as note,
  case
    when f.stage = 'final' and f.status = 'full_time' and r.position = 1 then 'gold'
    when f.stage = 'final' and f.status = 'full_time' and r.position = 2 then 'silver'
    when f.stage = 'final' and f.status = 'full_time' and r.position = 3 then 'bronze'
  end as medal
from public.race_entries r
join public.fixtures f on f.id = r.fixture_id
join public.teams t on t.id = r.team_id
left join public.players p on p.id = r.player_id;

comment on view public.race_results is 'Race entrants and (once published) results, for athletics and swimming.';

-- =============================================================================
-- event_standings: group tables for every sport except football
-- (football_standings keeps the football rulebook order).
--
-- Counts group-stage fixtures (stage league or group) that are live, at a
-- break, finished or a walkover. Points from the event's rules (basketball
-- 2/1/0, volleyball 3/0/0, ...). Order, as both rulebooks give it: points,
-- then head-to-head among the teams level on points, then score difference,
-- then score for. Teams level on everything share a position (the rulebook's
-- coin toss is done by hand).
-- Score: goals or points for timed and head-to-head; rally points for sets
-- (sets_for and sets_against hold sets won and lost).
-- =============================================================================
create or replace view public.event_standings
with (security_invoker = true)
as
with lf as (
  select f.id, f.event_id, f.home_team_id, f.away_team_id, f.home_score, f.away_score,
         f.status, f.winner_team_id, s.result_format,
         coalesce(ev.win_points, 3) as win_points,
         coalesce(ev.draw_points, 1) as draw_points,
         coalesce(ev.loss_points, 0) as loss_points
  from public.fixtures f
  join public.events ev on ev.id = f.event_id
  join public.sports s on s.id = ev.sport_id
  where s.slug <> 'football' and s.result_format <> 'ranked'
    and f.stage in ('league', 'group')
    and f.home_team_id is not null and f.away_team_id is not null
),
teams_in as (
  select event_id, home_team_id as team_id from lf
  union
  select event_id, away_team_id from lf
),
rally as (
  select fixture_id, sum(home_points)::integer as home_points, sum(away_points)::integer as away_points
  from public.fixture_set_scores group by fixture_id
),
counted as (
  select lf.*,
         case when lf.result_format = 'sets' then coalesce(r.home_points, 0) else lf.home_score end as home_for,
         case when lf.result_format = 'sets' then coalesce(r.away_points, 0) else lf.away_score end as away_for
  from lf
  left join rally r on r.fixture_id = lf.id
  where lf.status in ('live', 'half_time', 'full_time', 'walkover')
),
res as (
  select event_id, id as fixture_id, home_team_id as team_id, away_team_id as opponent_id,
         coalesce(home_for, 0) as score_for, coalesce(away_for, 0) as score_against,
         coalesce(home_score, 0) as sets_for, coalesce(away_score, 0) as sets_against,
         status, winner_team_id, result_format, win_points, draw_points, loss_points
  from counted
  union all
  select event_id, id, away_team_id, home_team_id,
         coalesce(away_for, 0), coalesce(home_for, 0),
         coalesce(away_score, 0), coalesce(home_score, 0),
         status, winner_team_id, result_format, win_points, draw_points, loss_points
  from counted
),
res_outcome as (
  select r.*,
    case
      when r.status in ('full_time', 'walkover') then
        case when r.winner_team_id = r.team_id then 'W' when r.winner_team_id is null then 'D' else 'L' end
      -- In play: who's ahead now (sets won for a sets match, else the score).
      when r.result_format = 'sets' then
        case when r.sets_for > r.sets_against then 'W' when r.sets_for = r.sets_against then 'D' else 'L' end
      else
        case when r.score_for > r.score_against then 'W' when r.score_for = r.score_against then 'D' else 'L' end
    end as outcome
  from res r
),
res_pts as (
  select o.*,
    case o.outcome when 'W' then o.win_points when 'D' then o.draw_points else o.loss_points end as pts
  from res_outcome o
),
tot as (
  select
    t.event_id,
    t.team_id,
    count(r.team_id)::integer                            as played,
    count(*) filter (where r.outcome = 'W')::integer     as won,
    count(*) filter (where r.outcome = 'D')::integer     as drawn,
    count(*) filter (where r.outcome = 'L')::integer     as lost,
    coalesce(sum(r.score_for), 0)::integer               as score_for,
    coalesce(sum(r.score_against), 0)::integer           as score_against,
    coalesce(sum(r.sets_for) filter (where r.result_format = 'sets'), 0)::integer     as sets_for,
    coalesce(sum(r.sets_against) filter (where r.result_format = 'sets'), 0)::integer as sets_against,
    coalesce(sum(r.pts), 0)::integer                     as points,
    coalesce(bool_or(r.status in ('live', 'half_time')), false) as live
  from teams_in t
  left join res_pts r on r.event_id = t.event_id and r.team_id = t.team_id
  group by t.event_id, t.team_id
),
h2h as (
  -- Points only from matches between teams level on points.
  select a.event_id, a.team_id, sum(r.pts)::integer as h2h_points
  from tot a
  join res_pts r on r.event_id = a.event_id and r.team_id = a.team_id
  join tot b on b.event_id = a.event_id and b.team_id = r.opponent_id
  where a.points = b.points
  group by a.event_id, a.team_id
),
ranked as (
  select
    tot.*,
    tot.score_for - tot.score_against as score_difference,
    coalesce(h.h2h_points, 0) as h2h_points,
    rank() over (
      partition by tot.event_id
      order by tot.points desc,
               coalesce(h.h2h_points, 0) desc,
               tot.score_for - tot.score_against desc,
               tot.score_for desc
    )::integer as position
  from tot
  left join h2h h on h.event_id = tot.event_id and h.team_id = tot.team_id
)
select
  r.event_id,
  r.position,
  count(*) over (partition by r.event_id, r.position) > 1 as position_shared,
  r.team_id,
  t.name       as team_name,
  t.short_name as team_short_name,
  t.year       as team_year,
  r.played,
  r.won,
  r.drawn,
  r.lost,
  r.score_for,
  r.score_against,
  r.score_difference,
  r.sets_for,
  r.sets_against,
  r.points,
  r.h2h_points,
  r.live
from ranked r
join public.teams t on t.id = r.team_id;

comment on view public.event_standings is
  'Group tables for every sport except football: points, head-to-head, score difference, score for. Live during play.';

-- =============================================================================
-- advance_knockouts: fills knockout fixtures as each one is decided (admin).
-- For every sport except football (fill_football_knockouts keeps football).
--
-- Stages it knows, as in the basketball and volleyball rulebooks:
--   best_loser    group 3rd v group 4th
--   semi_final_a  (auto qualifier, set by the admin as home) v group 2nd
--   semi_final_b  group 1st v winner of best_loser
--   third_place   losers of the two semi-finals
--   final         winners of the two semi-finals
-- Without semi-finals: final = 1st v 2nd and third_place = 3rd v 4th.
--
-- Each call fills whatever is ready and leaves the rest, so the admin can
-- call it after every knockout round. It refuses when the group isn't
-- finished, and when teams level on every tie-breaker decide who goes where
-- (the organisers decide, by coin toss for basketball; then set the teams by
-- hand). A fixture with match events is never changed. Audit rows are tagged
-- {"action": "advance_knockouts"}. Returns the event's knockout fixtures.
-- =============================================================================
create or replace function public.live_fill_knockout_slot(
  p_event_id uuid, p_stage text, p_home uuid, p_away uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fixture public.fixtures%rowtype;
begin
  select * into v_fixture from public.fixtures
  where event_id = p_event_id and stage = p_stage
  order by kickoff_at nulls last, id limit 1
  for update;
  if not found then
    return;
  end if;
  if (coalesce(p_home, v_fixture.home_team_id), coalesce(p_away, v_fixture.away_team_id))
     is not distinct from (v_fixture.home_team_id, v_fixture.away_team_id) then
    return;
  end if;
  if exists (select 1 from public.match_events where fixture_id = v_fixture.id and voided_at is null) then
    perform public.live_fail('live.has_events', format(
      'The %s fixture already has match events, so its teams can''t change. Void them first.',
      replace(p_stage, '_', ' ')));
  end if;
  update public.fixtures
  set home_team_id = coalesce(p_home, home_team_id),
      away_team_id = coalesce(p_away, away_team_id)
  where id = v_fixture.id;
end;
$$;

create or replace function public.advance_knockouts(p_event_id uuid)
returns setof public.fixtures
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teams     uuid[];
  v_positions integer[];
  v_has_semis boolean;
  v_bl        public.fixtures%rowtype;
  v_sfa       public.fixtures%rowtype;
  v_sfb       public.fixtures%rowtype;
begin
  if auth.uid() is null then
    perform public.live_fail('live.not_signed_in', 'Sign in as the admin to fill the knockouts.');
  end if;
  if not public.is_admin() then
    perform public.live_fail('live.admin_only', 'Only the admin can fill the knockouts.');
  end if;
  if not exists (
    select 1 from public.events ev join public.sports s on s.id = ev.sport_id
    where ev.id = p_event_id and s.slug <> 'football' and s.result_format <> 'ranked'
  ) then
    perform public.live_fail('live.wrong_format',
      'Use fill_football_knockouts for football, and fill_race_final for races.');
  end if;
  if not exists (select 1 from public.fixtures where event_id = p_event_id and stage in ('league', 'group')) then
    perform public.live_fail('live.invalid_state', 'This event has no group matches.');
  end if;
  if exists (
    select 1 from public.fixtures
    where event_id = p_event_id and stage in ('league', 'group')
      and status not in ('full_time', 'walkover', 'cancelled')
  ) then
    perform public.live_fail('live.league_not_finished',
      'Every group match must be finished before the knockouts can be filled.');
  end if;

  select array_agg(team_id order by position, team_year), array_agg(position order by position, team_year)
  into v_teams, v_positions
  from public.event_standings where event_id = p_event_id;

  if coalesce(cardinality(v_teams), 0) < 2 then
    perform public.live_fail('live.invalid_state', 'The group needs at least 2 teams.');
  end if;

  v_has_semis := exists (
    select 1 from public.fixtures where event_id = p_event_id and stage in ('semi_final_a', 'semi_final_b')
  );

  perform public.admin_set_audit_context(jsonb_build_object('action', 'advance_knockouts', 'eventId', p_event_id));

  if v_has_semis then
    -- 1st and 2nd go to different semis; 3rd and 4th (or 2nd and 3rd without
    -- a best-loser match) are on either side of a cut.
    if v_positions[1] = v_positions[2]
       or (cardinality(v_positions) >= 3 and v_positions[2] = v_positions[3]) then
      perform public.live_fail('live.standings_tied',
        'Teams in the top 3 are level on every tie-breaker. The organisers decide (coin toss); then set the teams by hand.');
    end if;
    if cardinality(v_positions) >= 5 and v_positions[4] = v_positions[5]
       and exists (select 1 from public.fixtures where event_id = p_event_id and stage = 'best_loser') then
      perform public.live_fail('live.standings_tied',
        '4th and 5th are level on every tie-breaker. The organisers decide (coin toss); then set the teams by hand.');
    end if;

    if exists (select 1 from public.fixtures where event_id = p_event_id and stage = 'best_loser') then
      perform public.live_fill_knockout_slot(p_event_id, 'best_loser', v_teams[3], v_teams[4]);
      perform public.live_fill_knockout_slot(p_event_id, 'semi_final_a', null, v_teams[2]);
      perform public.live_fill_knockout_slot(p_event_id, 'semi_final_b', v_teams[1], null);
      select * into v_bl from public.fixtures where event_id = p_event_id and stage = 'best_loser' limit 1;
      if v_bl.status in ('full_time', 'walkover') and v_bl.winner_team_id is not null then
        perform public.live_fill_knockout_slot(p_event_id, 'semi_final_b', null, v_bl.winner_team_id);
      end if;
    else
      -- Four-team semis: 1st v 4th, 2nd v 3rd.
      perform public.live_fill_knockout_slot(p_event_id, 'semi_final_a', v_teams[2], v_teams[3]);
      perform public.live_fill_knockout_slot(p_event_id, 'semi_final_b', v_teams[1], v_teams[4]);
    end if;

    select * into v_sfa from public.fixtures where event_id = p_event_id and stage = 'semi_final_a' limit 1;
    select * into v_sfb from public.fixtures where event_id = p_event_id and stage = 'semi_final_b' limit 1;
    if v_sfa.status in ('full_time', 'walkover') and v_sfa.winner_team_id is not null
       and v_sfb.status in ('full_time', 'walkover') and v_sfb.winner_team_id is not null then
      perform public.live_fill_knockout_slot(p_event_id, 'final', v_sfa.winner_team_id, v_sfb.winner_team_id);
      perform public.live_fill_knockout_slot(p_event_id, 'third_place',
        case when v_sfa.winner_team_id = v_sfa.home_team_id then v_sfa.away_team_id else v_sfa.home_team_id end,
        case when v_sfb.winner_team_id = v_sfb.home_team_id then v_sfb.away_team_id else v_sfb.home_team_id end);
    end if;
  else
    if v_positions[2] = v_positions[3] or (cardinality(v_positions) >= 5 and v_positions[4] = v_positions[5]) then
      perform public.live_fail('live.standings_tied',
        'Teams level on every tie-breaker decide who qualifies. The organisers decide; then set the teams by hand.');
    end if;
    perform public.live_fill_knockout_slot(p_event_id, 'final', v_teams[1], v_teams[2]);
    if cardinality(v_teams) >= 4 then
      perform public.live_fill_knockout_slot(p_event_id, 'third_place', v_teams[3], v_teams[4]);
    end if;
  end if;

  return query
    select * from public.fixtures
    where event_id = p_event_id and stage not in ('league', 'group')
    order by kickoff_at nulls last, stage;
end;
$$;

-- =============================================================================
-- Medals and the overall championship
-- event_medals: per event, gold and silver to the final's winner and loser
-- and bronze to the third-place winner (team sports); places 1 to 3 in a
-- published final (races; equal places share a medal).
-- medal_table: every year's gold, silver, bronze, total and points, ranked by
-- the admin's setting: by medals (gold, then silver, then bronze) or by
-- points (gold_points per gold and so on). The organisers haven't decided
-- the rule yet, so it's a setting rather than code.
-- =============================================================================
create table if not exists public.championship_settings (
  id            boolean primary key default true check (id),
  rank_by       text not null default 'medals' check (rank_by in ('medals', 'points')),
  gold_points   smallint not null default 3 check (gold_points between 0 and 100),
  silver_points smallint not null default 2 check (silver_points between 0 and 100),
  bronze_points smallint not null default 1 check (bronze_points between 0 and 100),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references public.profiles (id) on delete set null
);
insert into public.championship_settings (id) values (true) on conflict (id) do nothing;
create index if not exists championship_settings_updated_by_idx on public.championship_settings (updated_by);

alter table public.championship_settings enable row level security;
drop policy if exists "Championship settings are public" on public.championship_settings;
create policy "Championship settings are public" on public.championship_settings for select using (true);
revoke insert, update, delete, truncate on public.championship_settings from anon, authenticated;

drop trigger if exists championship_settings_set_updated_at on public.championship_settings;
create trigger championship_settings_set_updated_at
  before update on public.championship_settings
  for each row execute function public.set_updated_at();

drop trigger if exists audit_row_change on public.championship_settings;
create trigger audit_row_change
  after insert or update or delete on public.championship_settings
  for each row execute function public.audit_row_change('rank_by', 'gold_points', 'silver_points', 'bronze_points');

create or replace function public.set_championship_rule(
  p_rank_by text, p_gold_points integer default 3, p_silver_points integer default 2, p_bronze_points integer default 1
)
returns public.championship_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.championship_settings%rowtype;
begin
  if auth.uid() is null or not public.is_admin() then
    perform public.live_fail('live.admin_only', 'Only the admin can change how the champion is decided.');
  end if;
  if p_rank_by is null or p_rank_by not in ('medals', 'points') then
    perform public.live_fail('live.invalid_input', 'Rank by medals or by points.');
  end if;
  if coalesce(p_gold_points, -1) not between 0 and 100
     or coalesce(p_silver_points, -1) not between 0 and 100
     or coalesce(p_bronze_points, -1) not between 0 and 100 then
    perform public.live_fail('live.invalid_input', 'Points per medal go from 0 to 100.');
  end if;
  update public.championship_settings
  set rank_by = p_rank_by, gold_points = p_gold_points, silver_points = p_silver_points,
      bronze_points = p_bronze_points, updated_by = auth.uid()
  where id
  returning * into v_row;
  return v_row;
end;
$$;

create or replace view public.event_medals
with (security_invoker = true)
as
with team_results as (
  select f.event_id, f.id as fixture_id, f.stage, f.winner_team_id,
         case when f.winner_team_id = f.home_team_id then f.away_team_id else f.home_team_id end as loser_team_id
  from public.fixtures f
  join public.events ev on ev.id = f.event_id
  join public.sports s on s.id = ev.sport_id
  where s.result_format <> 'ranked'
    and f.stage in ('final', 'third_place')
    and f.status in ('full_time', 'walkover')
    and f.winner_team_id is not null
)
select event_id, fixture_id, 'gold'::text as medal, 1 as place, winner_team_id as team_id, null::text as athlete_name
from team_results where stage = 'final'
union all
select event_id, fixture_id, 'silver', 2, loser_team_id, null::text
from team_results where stage = 'final'
union all
select event_id, fixture_id, 'bronze', 3, winner_team_id, null::text
from team_results where stage = 'third_place'
union all
select f.event_id, f.id, case r.position when 1 then 'gold' when 2 then 'silver' else 'bronze' end,
       r.position::integer, r.team_id, coalesce(p.display_name, r.athlete_name)
from public.race_entries r
left join public.players p on p.id = r.player_id
join public.fixtures f on f.id = r.fixture_id
join public.events ev on ev.id = f.event_id
join public.sports s on s.id = ev.sport_id
where s.result_format = 'ranked' and f.stage = 'final' and f.status = 'full_time'
  and r.outcome = 'finished' and r.position between 1 and 3;

comment on view public.event_medals is 'Gold, silver and bronze per event: final and third-place results, or places 1-3 in a race final.';

create or replace view public.medal_table
with (security_invoker = true)
as
with counts as (
  select t.id as team_id,
         count(m.*) filter (where m.medal = 'gold')::integer   as gold,
         count(m.*) filter (where m.medal = 'silver')::integer as silver,
         count(m.*) filter (where m.medal = 'bronze')::integer as bronze
  from public.teams t
  left join public.event_medals m on m.team_id = t.id
  group by t.id
),
scored as (
  select c.*, c.gold + c.silver + c.bronze as total,
         (c.gold * s.gold_points + c.silver * s.silver_points + c.bronze * s.bronze_points)::integer as points,
         s.rank_by
  from counts c cross join public.championship_settings s
)
select
  rank() over (
    order by case when sc.rank_by = 'points' then sc.points else 0 end desc,
             sc.gold desc, sc.silver desc, sc.bronze desc
  )::integer as position,
  sc.team_id,
  t.name       as team_name,
  t.short_name as team_short_name,
  t.year       as team_year,
  sc.gold,
  sc.silver,
  sc.bronze,
  sc.total,
  sc.points,
  sc.rank_by
from scored sc
join public.teams t on t.id = sc.team_id;

comment on view public.medal_table is 'Overall championship: medals and points per year, ranked by the admin''s championship setting.';

-- =============================================================================
-- Permissions
-- =============================================================================
revoke insert, update, delete, truncate on public.fixture_set_scores from anon, authenticated;
revoke insert, update, delete, truncate on public.event_standings    from anon, authenticated;
revoke insert, update, delete, truncate on public.race_results       from anon, authenticated;
revoke insert, update, delete, truncate on public.event_medals       from anon, authenticated;
revoke insert, update, delete, truncate on public.medal_table        from anon, authenticated;
grant select on public.fixture_set_scores, public.event_standings, public.race_results,
               public.event_medals, public.medal_table, public.race_entries,
               public.championship_settings
  to anon, authenticated;

-- Console and admin functions: signed-in users only (each checks its own role).
revoke all on function public.record_match_event(uuid, uuid, public.match_event_type, timestamptz, public.match_period,
  uuid, uuid, uuid, public.card_colour, boolean, boolean, boolean, smallint) from public, anon;
grant execute on function public.record_match_event(uuid, uuid, public.match_event_type, timestamptz, public.match_period,
  uuid, uuid, uuid, public.card_colour, boolean, boolean, boolean, smallint) to authenticated;
revoke all on function public.set_race_entries(uuid, jsonb) from public, anon;
grant execute on function public.set_race_entries(uuid, jsonb) to authenticated;
revoke all on function public.record_race_results(uuid, jsonb, boolean) from public, anon;
grant execute on function public.record_race_results(uuid, jsonb, boolean) to authenticated;
revoke all on function public.fill_race_final(uuid) from public, anon;
grant execute on function public.fill_race_final(uuid) to authenticated;
revoke all on function public.advance_knockouts(uuid) from public, anon;
grant execute on function public.advance_knockouts(uuid) to authenticated;
revoke all on function public.set_championship_rule(text, integer, integer, integer) from public, anon;
grant execute on function public.set_championship_rule(text, integer, integer, integer) to authenticated;

-- Internal helpers: called only from the functions above.
revoke all on function public.live_lock_fixture_for_console(uuid) from public, anon, authenticated;
revoke all on function public.live_lock_race(uuid) from public, anon, authenticated;
revoke all on function public.live_set_race_state(uuid, public.fixture_status) from public, anon, authenticated;
revoke all on function public.live_fill_knockout_slot(uuid, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.refresh_fixture_state(uuid) from public, anon, authenticated;
revoke all on function public.live_race_rows(jsonb) from public, anon, authenticated;
revoke all on function public.live_entrant_key(uuid, text) from public;
grant execute on function public.live_entrant_key(uuid, text) to anon, authenticated;

-- Pure arithmetic used by the public views.
revoke all on function public.live_period_offset(public.match_period, integer, integer) from public;
grant execute on function public.live_period_offset(public.match_period, integer, integer) to anon, authenticated;
revoke all on function public.live_set_target(public.events, integer) from public;
grant execute on function public.live_set_target(public.events, integer) to anon, authenticated;
revoke all on function public.live_set_is_won(integer, integer, integer, integer, integer) from public;
grant execute on function public.live_set_is_won(integer, integer, integer, integer, integer) to anon, authenticated;

-- =============================================================================
-- Realtime: race results go out live like match events.
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'race_entries'
     ) then
    alter publication supabase_realtime add table public.race_entries;
  end if;
end $$;
