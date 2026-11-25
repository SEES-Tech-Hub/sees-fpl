-- =============================================================================
-- Live scores: board games, player-vs-player matches and two-leg ties
-- Author: Tayo
-- Rules: the organisers' BOARD GAMES and MOBILE GAMES rulebooks, and the
-- SEES Games 2026 daily schedule (25 Nov).
--
-- What this adds
--   * Board games: events.boards says how many boards a match has (Chess 1,
--     the other games 2). The console records each board: 2 points to the
--     winner, or 1 each for a draw (the rulebook's 1 and 0.5, doubled so
--     scores stay whole numbers). match_events.board says which board.
--     events.rank_by_score ranks a group table by total score first (board
--     points), as the rulebook ranks the games.
--   * Player-vs-player events (eFootball, EA FC, lawn tennis, table tennis
--     singles): fixtures.home_entrant and away_entrant name the players; the
--     teams are their years. Two players from the same year may meet, so
--     match_events.side records home or away, and fixtures.winner_side says
--     which side won (winner_team_id is that side's year, as before).
--   * Two-leg ties: fixtures.tie labels the tie ("QF1") and fixtures.leg is 1
--     or 2. A first leg can end level; a level second leg needs a winner only
--     when the aggregate is level. fixtures.tie also labels one-off matches
--     ("M1", "R3") so the schedule can be seeded safely.
--
-- record_match_event gains p_side and p_board (the old signature is replaced).
-- refresh_fixture_state, the fixtures guard, fixture_set_scores and
-- event_standings are the 20261123065000 versions with the changes above.
--
-- Safe to run twice.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Columns
-- -----------------------------------------------------------------------------
alter table public.events
  add column if not exists boards        smallint,
  add column if not exists rank_by_score boolean not null default false;

do $$ begin
  alter table public.events add constraint events_boards_check check (boards is null or boards between 1 and 4);
exception when duplicate_object then null; end $$;

comment on column public.events.boards is 'Board games: boards per match (each worth 2 points: a win 2, a draw 1 each).';
comment on column public.events.rank_by_score is 'Rank the group table by total score first (board games: board points).';

alter table public.fixtures
  add column if not exists home_entrant text,
  add column if not exists away_entrant text,
  add column if not exists tie          text,
  add column if not exists leg          smallint,
  add column if not exists winner_side  text;

do $$ begin
  alter table public.fixtures add constraint fixtures_entrants_check check (
        (home_entrant is null or char_length(home_entrant) between 1 and 60)
    and (away_entrant is null or char_length(away_entrant) between 1 and 60)
    and (tie is null or char_length(tie) between 1 and 20)
    and (leg is null or leg in (1, 2))
    and (winner_side is null or winner_side in ('home', 'away'))
  );
exception when duplicate_object then null; end $$;

comment on column public.fixtures.home_entrant is 'Player-vs-player events: the home player''s name (home_team_id is their year).';
comment on column public.fixtures.away_entrant is 'Player-vs-player events: the away player''s name (away_team_id is their year).';
comment on column public.fixtures.tie is 'The match or tie label from the schedule ("M1", "QF2", "R3").';
comment on column public.fixtures.leg is 'Two-leg ties: 1 or 2.';
comment on column public.fixtures.winner_side is 'home or away: who won. Derived from match events, like winner_team_id.';

create index if not exists fixtures_event_tie_idx on public.fixtures (event_id, tie);

-- The same year on both sides is allowed only between two named players.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.fixtures'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%home_team_id <> away_team_id%'
      and pg_get_constraintdef(oid) not like '%home_entrant%'
  loop
    execute format('alter table public.fixtures drop constraint %I', c.conname);
  end loop;
end $$;

do $$ begin
  alter table public.fixtures add constraint fixtures_two_sides_check check (
    home_team_id is null or away_team_id is null or home_team_id <> away_team_id
    or (home_entrant is not null and away_entrant is not null and home_entrant <> away_entrant)
  );
exception when duplicate_object then null; end $$;

alter table public.match_events
  add column if not exists side  text,
  add column if not exists board smallint;

do $$ begin
  alter table public.match_events add constraint match_events_side_board_check check (
    (side is null or side in ('home', 'away')) and (board is null or board between 1 and 4)
  );
exception when duplicate_object then null; end $$;

comment on column public.match_events.side is 'home or away: who it was for (needed when both players are from the same year).';
comment on column public.match_events.board is 'Board games: which board this result is for.';

-- -----------------------------------------------------------------------------
-- record_match_event: p_side and p_board; level first legs; aggregate second legs
-- (the old signature is dropped so there is one function)
-- -----------------------------------------------------------------------------
drop function if exists public.record_match_event(uuid, uuid, public.match_event_type, timestamptz, public.match_period,
  uuid, uuid, uuid, public.card_colour, boolean, boolean, boolean, smallint);

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
  p_points          smallint default null,
  p_side            text default null,
  p_board           smallint default null
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
  v_side       text;
  v_board_sum  integer;
  v_first      public.fixtures%rowtype;
  v_agg_home   integer;
  v_agg_away   integer;
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
        if p_board is not null then
          -- A board game: a board's result is 2 points to the winner, or 1 each for a draw.
          if v_ev.boards is null or p_board < 1 or p_board > v_ev.boards then
            perform public.live_fail('live.invalid_input', 'That board isn''t part of this game.');
          end if;
          if v_points not in (1, 2) then
            perform public.live_fail('live.invalid_input', 'A board gives 2 points for a win or 1 for a draw.');
          end if;
          select coalesce(sum(points), 0) into v_board_sum
          from public.match_events
          where fixture_id = p_fixture_id and type = 'point' and board = p_board and voided_at is null;
          if v_board_sum + v_points > 2 then
            perform public.live_fail('live.board_done',
              format('Board %s already has its result. Undo it to change it.', p_board));
          end if;
        elsif not v_is_admin and v_points <> 1 then
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
              and v_fixture.leg is distinct from 1 then
          -- A knockout needs a winner when it's level. A first leg can end
          -- level; a second leg is judged on the aggregate of both legs.
          v_agg_home := coalesce(v_fixture.home_score, 0);
          v_agg_away := coalesce(v_fixture.away_score, 0);
          if v_fixture.leg = 2 and v_fixture.tie is not null then
            select * into v_first from public.fixtures
            where event_id = v_fixture.event_id and tie = v_fixture.tie and leg = 1 and id <> v_fixture.id
            limit 1;
            if found then
              if v_first.home_team_id is not distinct from v_fixture.home_team_id
                 and v_first.home_entrant is not distinct from v_fixture.home_entrant then
                v_agg_home := v_agg_home + coalesce(v_first.home_score, 0);
                v_agg_away := v_agg_away + coalesce(v_first.away_score, 0);
              else
                v_agg_home := v_agg_home + coalesce(v_first.away_score, 0);
                v_agg_away := v_agg_away + coalesce(v_first.home_score, 0);
              end if;
            end if;
          end if;
          if v_agg_home = v_agg_away then
            perform public.live_fail('live.needs_winner',
              case when v_fixture.leg = 2 then 'Level on aggregate: pick who won (extra time or penalties).'
                   else 'A knockout game needs a winner.' end);
          end if;
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
    -- The side (home or away) says who it was when both players are from the same year.
    if p_side is not null then
      if p_side not in ('home', 'away') then
        perform public.live_fail('live.invalid_input', 'side must be home or away.');
      end if;
      if p_team_id is distinct from (case p_side when 'home' then v_fixture.home_team_id else v_fixture.away_team_id end) then
        perform public.live_fail('live.wrong_team', 'That team isn''t on that side.');
      end if;
    elsif v_fixture.home_team_id = v_fixture.away_team_id then
      perform public.live_fail('live.needs_side', 'Both players are from the same year. Say which one.');
    end if;
    v_side := coalesce(p_side, case when p_team_id = v_fixture.home_team_id then 'home' else 'away' end);
    v_opponent := case when v_side = 'home' then v_fixture.away_team_id else v_fixture.home_team_id end;
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
    card, is_penalty, is_own_goal, scored, points, occurred_at, recorded_by, side, board
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
    v_uid,
    v_side,
    case when p_type = 'point' then p_board end
  )
  returning * into v_event;

  return v_event;
end;
$$;


-- -----------------------------------------------------------------------------
-- refresh_fixture_state: home and away by side; winner_side
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
  v_declared_side text;
  v_winner_side   text;
  v_home_side     boolean;
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
    -- Home or away: the side when it was recorded (two players from one year), else the team.
    v_home_side := coalesce(e.side = 'home', e.team_id = f.home_team_id);
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
        if v_home_side then
          v_home := coalesce(v_home, 0) + e.points;
        else
          v_away := coalesce(v_away, 0) + e.points;
        end if;
      when 'shootout_kick' then
        if e.scored then
          if v_home_side then
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
          v_set_home := coalesce(v_set_home, 0) + case when v_home_side then e.points else 0 end;
          v_set_away := coalesce(v_set_away, 0) + case when v_home_side then 0 else e.points end;
        elsif v_home_side then
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
        v_declared_side := case when e.team_id is null then null when v_home_side then 'home' else 'away' end;
      when 'walkover' then
        v_status  := 'walkover';
        v_period  := null;
        v_started := null;
        v_winner  := e.team_id;
        v_winner_side := case when v_home_side then 'home' else 'away' end;
        if v_home_side then
          v_home := e.points; v_away := 0;
        else
          v_home := 0; v_away := e.points;
        end if;
      else
        null;  -- cards, substitutions, misses and MOTM don't change the fixture row
    end case;
  end loop;

  if v_status = 'full_time' then
    v_winner_side := case
      when v_declared_side is not null then v_declared_side  -- a declared result (head-to-head, or a retirement)
      when v_home > v_away then 'home'
      when v_away > v_home then 'away'
      when coalesce(v_hs, 0) > coalesce(v_as, 0) then 'home'
      when coalesce(v_as, 0) > coalesce(v_hs, 0) then 'away'
      else null  -- a draw
    end;
    v_winner := case v_winner_side when 'home' then f.home_team_id when 'away' then f.away_team_id end;
  elsif v_status <> 'walkover' then
    v_winner := null;
    v_winner_side := null;
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
      away_set_points   = v_set_away,
      winner_side       = v_winner_side
  where id = p_fixture_id
    and (status, current_period, period_started_at, home_score, away_score,
         home_shootout, away_shootout, winner_team_id, current_set, home_set_points, away_set_points, winner_side)
        is distinct from
        (v_status, v_period, v_started, v_home, v_away, v_hs, v_as, v_winner, v_set, v_set_home, v_set_away, v_winner_side);
  perform set_config('sees.live_refresh', 'off', true);
end;
$$;


-- -----------------------------------------------------------------------------
-- guard_fixture_live_columns: winner_side comes from match events too
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
      new.current_set, new.home_set_points, new.away_set_points, new.winner_side)
     is distinct from
     (old.home_score, old.away_score, old.home_shootout, old.away_shootout,
      old.current_period, old.period_started_at, old.winner_team_id,
      old.current_set, old.home_set_points, old.away_set_points, old.winner_side) then
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
-- fixture_set_scores: home and away by side (two players from one year)
-- -----------------------------------------------------------------------------
create or replace view public.fixture_set_scores
with (security_invoker = true)
as
with ev as (
  select
    e.fixture_id, e.type, e.team_id, e.side, e.points,
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
  coalesce(sum(ev.points) filter (where ev.type = 'point' and coalesce(ev.side = 'home', ev.team_id = f.home_team_id)), 0)::integer as home_points,
  coalesce(sum(ev.points) filter (where ev.type = 'point' and coalesce(ev.side = 'away', ev.team_id = f.away_team_id)), 0)::integer as away_points,
  bool_or(ev.type = 'set_end') as complete,
  case
    when not bool_or(ev.type = 'set_end') then null
    when coalesce(sum(ev.points) filter (where ev.type = 'point' and coalesce(ev.side = 'home', ev.team_id = f.home_team_id)), 0)
       > coalesce(sum(ev.points) filter (where ev.type = 'point' and coalesce(ev.side = 'away', ev.team_id = f.away_team_id)), 0)
      then f.home_team_id
    else f.away_team_id
  end as winner_team_id
from ev
join public.fixtures f on f.id = ev.fixture_id
group by ev.fixture_id, ev.set_number, f.home_team_id, f.away_team_id;


-- -----------------------------------------------------------------------------
-- event_standings: events with rank_by_score (board games) rank by score first
-- -----------------------------------------------------------------------------
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
      order by case when evx.rank_by_score then tot.score_for end desc nulls last,
               tot.points desc,
               coalesce(h.h2h_points, 0) desc,
               tot.score_for - tot.score_against desc,
               tot.score_for desc
    )::integer as position
  from tot
  left join h2h h on h.event_id = tot.event_id and h.team_id = tot.team_id
  join public.events evx on evx.id = tot.event_id
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


-- -----------------------------------------------------------------------------
-- Permissions (as before)
-- -----------------------------------------------------------------------------
revoke all on function public.record_match_event(uuid, uuid, public.match_event_type, timestamptz, public.match_period,
  uuid, uuid, uuid, public.card_colour, boolean, boolean, boolean, smallint, text, smallint) from public, anon;
grant execute on function public.record_match_event(uuid, uuid, public.match_event_type, timestamptz, public.match_period,
  uuid, uuid, uuid, public.card_colour, boolean, boolean, boolean, smallint, text, smallint) to authenticated;
revoke all on function public.refresh_fixture_state(uuid) from public, anon, authenticated;
revoke insert, update, delete, truncate on public.fixture_set_scores from anon, authenticated;
revoke insert, update, delete, truncate on public.event_standings    from anon, authenticated;
grant select on public.fixture_set_scores, public.event_standings to anon, authenticated;
