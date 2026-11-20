-- Live scores: neutral wording in record_match_event's error messages.
--
-- The console shows database error messages to officials as they are, and
-- SEES Games has men's and women's events, so the own-goal assist message now
-- reads "A player can't assist their own goal." Nothing else in the function
-- changes.
--
-- Safe to run more than once (create or replace). Permissions are set again
-- explicitly so the result doesn't depend on what was there before.

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

-- Console API: signed-in users only (each function checks the role itself).
revoke all on function public.record_match_event(uuid, uuid, public.match_event_type, timestamptz,
  public.match_period, uuid, uuid, uuid, public.card_colour, boolean, boolean, boolean, smallint)
  from public, anon;
grant execute on function public.record_match_event(uuid, uuid, public.match_event_type, timestamptz,
  public.match_period, uuid, uuid, uuid, public.card_colour, boolean, boolean, boolean, smallint)
  to authenticated;
