-- =============================================================================
-- Keeper saves (part 2 of 2)
-- Owner: Tayo. Run after 20261128120958_live_save_type.sql.
--
-- 1. record_match_event accepts 'save' in timed sports: a goalkeeper of the
--    given team, while the ball is in play (not during a shootout). After
--    full time the admin may add one at an earlier time, as a correction.
--    Copied from 20261125075848_live_boards_players_legs.sql with only the
--    save changes.
-- 2. player_match_stats gains `saves` (last column): saves recorded plus
--    penalties saved, so a penalty save also counts towards save points.
-- 3. fantasy_rules: pts_saves points for every pts_saves_step saves
--    (FPL: 1 point per 3 saves).
--
-- Saves are facts for stats and fantasy, not timeline moments: the match
-- page leaves them out of the timeline (components/live).
-- Safe to run twice.
-- =============================================================================

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
                              'shootout_kick', 'man_of_the_match', 'full_time', 'walkover', 'save']::public.match_event_type[]
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
    and p_type in ('goal', 'card', 'substitution', 'penalty_miss', 'man_of_the_match', 'save');

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

      when 'save' then
        if v_fixture.status <> 'live' or v_fixture.current_period = 'penalties' then
          perform public.live_fail('live.invalid_state', 'Saves are recorded while the ball is in play.');
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
  if p_type in ('goal', 'card', 'substitution', 'penalty_miss', 'shootout_kick', 'walkover', 'point', 'save')
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
    when 'save' then
      if p_player_id is null then
        perform public.live_fail('live.invalid_input', 'Say which goalkeeper made the save.');
      end if;
      perform public.live_check_player(p_player_id, p_team_id, 'goalkeeper');
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

create or replace view public.player_match_stats
with (security_invoker = true)
as
with fx as (
  select
    f.id as fixture_id,
    f.event_id,
    f.matchday_id,
    f.status,
    f.status in ('live', 'half_time', 'full_time') as kicked_off,
    f.status in ('full_time', 'walkover') as fixture_finished,
    f.status = 'walkover' as walkover,
    -- The match-clock minute this fixture has reached (stoppage excluded).
    case
      when f.status not in ('live', 'half_time', 'full_time') then 0
      when f.status = 'live' and f.current_period in ('first_half', 'second_half', 'extra_first', 'extra_second') then
        (select m.minute
         from public.match_minute(f.current_period, f.period_started_at, now(),
                                  ev.period_minutes, ev.extra_period_minutes) m)
      else
        (select max(public.live_period_end_minute(ps.period, ev.period_minutes, ev.extra_period_minutes))
         from public.match_events ps
         where ps.fixture_id = f.id and ps.type = 'period_start'
           and ps.voided_at is null and ps.period <> 'penalties')
    end as clock_minute
  from public.fixtures f
  join public.events ev on ev.id = f.event_id
  join public.sports s on s.id = ev.sport_id
  where s.result_format = 'timed'
),
tl as (
  -- Active events with their match-clock minute (shootout kicks excluded).
  select t.fixture_id, t.id, t.type, t.team_id, t.player_id, t.other_player_id,
         t.card, t.is_own_goal, t.occurred_at, t.minute
  from public.match_timeline t
  join fx on fx.fixture_id = t.fixture_id
  where t.type in ('goal', 'card', 'substitution', 'penalty_miss', 'man_of_the_match', 'shootout_kick', 'save')
),
involved as (
  select l.fixture_id, l.player_id
  from public.lineups l join fx on fx.fixture_id = l.fixture_id
  union
  select fixture_id, player_id from tl where player_id is not null
  union
  select fixture_id, other_player_id from tl
  where other_player_id is not null and type in ('goal', 'substitution', 'penalty_miss')
),
base as (
  select
    i.fixture_id,
    fx.event_id,
    fx.matchday_id,
    i.player_id,
    p.team_id,
    p.position,
    fx.kicked_off,
    fx.fixture_finished,
    fx.walkover,
    fx.clock_minute,
    l.role as lineup_role,
    exists (
      select 1 from public.lineups lt
      where lt.fixture_id = i.fixture_id and lt.team_id = p.team_id
    ) as lineup_set,
    son.minute      as on_minute,
    son.occurred_at as on_at,
    son.id          as on_id,
    soff.minute      as off_minute,
    soff.occurred_at as off_at,
    soff.id          as off_id
  from involved i
  join fx on fx.fixture_id = i.fixture_id
  join public.players p on p.id = i.player_id
  left join public.lineups l on l.fixture_id = i.fixture_id and l.player_id = i.player_id
  left join lateral (
    select tl.minute, tl.occurred_at, tl.id from tl
    where tl.fixture_id = i.fixture_id and tl.type = 'substitution' and tl.other_player_id = i.player_id
    order by tl.occurred_at, tl.id limit 1
  ) son on true
  left join lateral (
    select tl.minute, tl.occurred_at, tl.id from tl
    where tl.fixture_id = i.fixture_id and tl.player_id = i.player_id
      and (tl.type = 'substitution' or (tl.type = 'card' and tl.card = 'red'))
    order by tl.occurred_at, tl.id limit 1
  ) soff on true
),
played as (
  select
    b.*,
    (coalesce(b.lineup_role = 'starter', false) or (not b.lineup_set and b.on_id is null)) as started
  from base b
),
appearance as (
  select
    pl.*,
    pl.kicked_off and (pl.started or pl.on_id is not null) as appeared,
    case when pl.started then 0 else pl.on_minute end as from_minute
  from played pl
)
select
  a.fixture_id,
  a.event_id,
  a.matchday_id,
  a.player_id,
  a.team_id,
  a.position,
  a.lineup_role,
  a.lineup_set,
  a.started and a.kicked_off as started,
  a.appeared,
  case
    when a.appeared then greatest(0, coalesce(a.off_minute, a.clock_minute, 0) - coalesce(a.from_minute, 0))
    else 0
  end::integer as minutes_played,
  s.goals,
  s.assists,
  s.own_goals,
  case when a.appeared then s.conceded else 0 end as goals_conceded_on_pitch,
  case when a.appeared then s.own_goals_conceded else 0 end as own_goals_conceded_on_pitch,
  s.yellow_cards,
  s.red_cards,
  s.red_from_second_yellow,
  s.penalties_missed,
  s.penalties_saved,
  s.man_of_the_match,
  a.walkover,
  a.fixture_finished,
  -- Saves: every save the keeper was credited with, plus penalties saved.
  (s.saves_made + s.penalties_saved)::integer as saves
from appearance a
cross join lateral (
  select
    count(*) filter (where tl.type = 'goal' and not tl.is_own_goal and tl.player_id = a.player_id)::integer as goals,
    count(*) filter (where tl.type = 'goal' and not tl.is_own_goal and tl.other_player_id = a.player_id)::integer as assists,
    count(*) filter (where tl.type = 'goal' and tl.is_own_goal and tl.player_id = a.player_id)::integer as own_goals,
    count(*) filter (
      where tl.type = 'goal' and tl.team_id <> a.team_id
        and (a.started or (tl.occurred_at, tl.id) > (a.on_at, a.on_id))
        and (a.off_id is null or (tl.occurred_at, tl.id) < (a.off_at, a.off_id))
    )::integer as conceded,
    count(*) filter (
      where tl.type = 'goal' and tl.is_own_goal and tl.team_id <> a.team_id
        and (a.started or (tl.occurred_at, tl.id) > (a.on_at, a.on_id))
        and (a.off_id is null or (tl.occurred_at, tl.id) < (a.off_at, a.off_id))
    )::integer as own_goals_conceded,
    count(*) filter (where tl.type = 'card' and tl.card = 'yellow' and tl.player_id = a.player_id)::integer as yellow_cards,
    count(*) filter (where tl.type = 'card' and tl.card = 'red' and tl.player_id = a.player_id)::integer as red_cards,
    coalesce(bool_or(
      tl.type = 'card' and tl.card = 'red' and tl.player_id = a.player_id
      and exists (
        select 1 from tl y
        where y.fixture_id = a.fixture_id and y.type = 'card' and y.card = 'yellow'
          and y.player_id = a.player_id and (y.occurred_at, y.id) < (tl.occurred_at, tl.id)
      )
    ), false) as red_from_second_yellow,
    count(*) filter (where tl.type = 'penalty_miss' and tl.player_id = a.player_id)::integer as penalties_missed,
    count(*) filter (where tl.type = 'penalty_miss' and tl.other_player_id = a.player_id)::integer as penalties_saved,
    coalesce(bool_or(tl.type = 'man_of_the_match' and tl.player_id = a.player_id), false) as man_of_the_match,
    count(*) filter (where tl.type = 'save' and tl.player_id = a.player_id)::integer as saves_made
  from tl
  where tl.fixture_id = a.fixture_id and tl.type <> 'shootout_kick'
) s;

comment on view public.player_match_stats is
  'One row per player per fixture, derived from match_events and lineups. The fantasy engine reads only this. See docs/live-scores.md.';

alter table public.fantasy_rules
  add column if not exists pts_saves_step smallint not null default 3 check (pts_saves_step > 0),
  add column if not exists pts_saves      smallint not null default 1;
