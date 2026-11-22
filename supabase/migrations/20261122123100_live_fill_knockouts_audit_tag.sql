-- Live scores: tag the knockout fill in the audit log.
--
-- Recreates fill_football_knockouts() from 20261122113000_live_stats_standings.sql
-- with one addition: the audit rows it causes on fixtures are tagged
-- {"action": "fill_knockouts", "eventId": ...}, so the admin's history shows
-- where the team changes came from. Nothing else changes.
--
-- Safe to run more than once.

-- -----------------------------------------------------------------------------
-- fill_football_knockouts: final = 1st v 2nd, third place = 3rd v 4th.
-- Admin only. Every league fixture of the event must be at full time, a
-- walkover or cancelled. Refuses when a tie on every tie-breaker decides who
-- goes where (2nd and 3rd level, or 4th and 5th level): the organisers then
-- decide, and the admin sets those teams by hand.
-- Safe to call again: a fixture that already has the right teams is left
-- alone, and one with match events is never changed. Audit rows are tagged
-- {"action": "fill_knockouts"}.
-- -----------------------------------------------------------------------------
create or replace function public.fill_football_knockouts(p_event_id uuid)
returns setof public.fixtures
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teams     uuid[];
  v_positions integer[];
  v_fixture   public.fixtures%rowtype;
  v_home      uuid;
  v_away      uuid;
begin
  if auth.uid() is null then
    perform public.live_fail('live.not_signed_in', 'Sign in as the admin to fill the knockout fixtures.');
  end if;
  if not public.is_admin() then
    perform public.live_fail('live.admin_only', 'Only the admin can fill the knockout fixtures.');
  end if;

  if not exists (
    select 1 from public.events ev join public.sports s on s.id = ev.sport_id
    where ev.id = p_event_id and s.slug = 'football'
  ) then
    perform public.live_fail('live.wrong_format', 'That isn''t a football event.');
  end if;

  if exists (
    select 1 from public.fixtures
    where event_id = p_event_id and stage = 'league'
      and status not in ('full_time', 'walkover', 'cancelled')
  ) then
    perform public.live_fail('live.league_not_finished',
      'Every league match must be finished before the final and third-place match can be filled.');
  end if;

  select array_agg(team_id order by position, team_year), array_agg(position order by position, team_year)
  into v_teams, v_positions
  from public.football_standings
  where event_id = p_event_id;

  if coalesce(cardinality(v_teams), 0) < 4 then
    perform public.live_fail('live.invalid_state', 'The league needs at least 4 teams to fill the knockouts.');
  end if;
  if v_positions[2] = v_positions[3] then
    perform public.live_fail('live.standings_tied',
      '2nd and 3rd are level on every tie-breaker. The organisers decide who plays the final; then set the teams by hand.');
  end if;
  if cardinality(v_positions) >= 5 and v_positions[4] = v_positions[5] then
    perform public.live_fail('live.standings_tied',
      '4th and 5th are level on every tie-breaker. The organisers decide who plays the third-place match; then set the teams by hand.');
  end if;

  for v_fixture in
    select * from public.fixtures
    where event_id = p_event_id and stage in ('final', 'third_place')
    order by stage, kickoff_at, id
    for update
  loop
    if v_fixture.stage = 'final' then
      v_home := v_teams[1]; v_away := v_teams[2];
    else
      v_home := v_teams[3]; v_away := v_teams[4];
    end if;

    if (v_fixture.home_team_id, v_fixture.away_team_id) is not distinct from (v_home, v_away) then
      return next v_fixture;
      continue;
    end if;

    if exists (select 1 from public.match_events where fixture_id = v_fixture.id and voided_at is null) then
      perform public.live_fail('live.has_events',
        'A knockout fixture already has match events, so its teams can''t change. Void them first.');
    end if;

    -- Tags the audit rows written by the fixtures audit trigger.
    perform public.admin_set_audit_context(jsonb_build_object('action', 'fill_knockouts', 'eventId', p_event_id));

    update public.fixtures
    set home_team_id = v_home, away_team_id = v_away
    where id = v_fixture.id
    returning * into v_fixture;
    return next v_fixture;
  end loop;

  if not found then
    perform public.live_fail('live.fixture_not_found', 'This event has no final or third-place fixture.');
  end if;
end;
$$;


revoke all on function public.fill_football_knockouts(uuid) from public, anon;
grant execute on function public.fill_football_knockouts(uuid) to authenticated;
