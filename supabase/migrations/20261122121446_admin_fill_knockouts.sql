-- =============================================================================
-- Admin: fill the knockout fixtures from the final league table
-- Author: Akeem (admin backend), with Bolu (standings)
-- PRD: "Tournament facts" (1st and 2nd to the final, 3rd and 4th to the
--      third-place match); "Feature: Admin portal and match console", item 4
-- Needs: 20261122120701_admin_players_prices.sql (admin_fail)
--
-- What this adds
--   * admin_fill_knockouts(event_id, ranking): sets the teams of the event's
--     final (1st v 2nd) and third-place match (3rd v 4th). An explicit admin
--     action, never automatic, so the organisers stay in control.
--
-- The ranking (team ids, 1st first) comes from Bolu's standings, which apply
-- the rulebook's tie-breakers (points, goal difference, goals scored, head to
-- head). His standings aren't in the database yet, so the app passes the order
-- from lib/live/stats.ts getFootballStandings(). This function checks
-- everything it can without them:
--   * every league fixture of the event has finished (full time or walkover);
--   * the ranking is exactly the teams that played in the league, once each;
--   * the final and third-place fixtures exist and haven't started.
-- TODO(Bolu): when a standings view lands, read the order from it here and
-- drop p_ranking, so the database decides the order too.
--
-- "Set to", not "toggle": running it again with the same table changes
-- nothing. Runs as the caller (SECURITY INVOKER); Bolu's fixture guard and
-- the audit log apply. Safe to run twice.
-- =============================================================================

create or replace function public.admin_fill_knockouts(p_event_id uuid, p_ranking uuid[])
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_unfinished integer;
  v_league     uuid[];
  v_final      public.fixtures%rowtype;
  v_third      public.fixtures%rowtype;
  v_has_third  boolean;
  v_changed    integer := 0;
  v_count      integer;
begin
  if not public.is_admin() then
    perform public.admin_fail('admin.forbidden', 'Only the admin can fill the knockout fixtures.');
  end if;
  if not exists (select 1 from public.events where id = p_event_id) then
    perform public.admin_fail('admin.not_found', 'That event wasn''t found.');
  end if;

  select count(*) filter (where status not in ('full_time', 'walkover')),
         array_agg(distinct t) filter (where t is not null)
  into v_unfinished, v_league
  from public.fixtures f
  cross join lateral unnest(array[f.home_team_id, f.away_team_id]) as t
  where f.event_id = p_event_id and f.stage = 'league';

  if v_league is null then
    perform public.admin_fail('admin.not_found', 'This event has no league fixtures.');
  end if;
  if v_unfinished > 0 then
    -- Each fixture is counted once per team slot above, so halve it.
    perform public.admin_fail('admin.league_not_finished',
      format('%s league match(es) haven''t finished yet.', v_unfinished / 2));
  end if;

  v_count := coalesce(array_length(p_ranking, 1), 0);
  if v_count <> array_length(v_league, 1)
     or array_position(p_ranking, null) is not null
     or (select count(distinct x) from unnest(p_ranking) as x) <> v_count
     or exists (select 1 from unnest(p_ranking) as x where not (x = any (v_league))) then
    perform public.admin_fail('admin.invalid_input',
      'The table doesn''t match the teams in this league. Refresh and try again.');
  end if;
  if v_count < 2 then
    perform public.admin_fail('admin.invalid_input', 'A final needs at least two teams.');
  end if;

  select * into v_final from public.fixtures
  where event_id = p_event_id and stage = 'final'
  for update;
  get diagnostics v_count = row_count;
  if v_count <> 1 then
    perform public.admin_fail('admin.not_found',
      format('This event needs exactly one final fixture (it has %s).', v_count));
  end if;

  select * into v_third from public.fixtures
  where event_id = p_event_id and stage = 'third_place'
  for update;
  get diagnostics v_count = row_count;
  if v_count > 1 then
    perform public.admin_fail('admin.invalid_input', 'This event has more than one third-place fixture.');
  end if;
  v_has_third := v_count = 1 and array_length(p_ranking, 1) >= 4;

  if v_final.status not in ('scheduled', 'postponed')
     or (v_has_third and v_third.status not in ('scheduled', 'postponed')) then
    perform public.admin_fail('admin.rule_violation',
      'A knockout fixture has already started, so its teams can''t change.');
  end if;

  perform set_config('sees.audit_context', jsonb_build_object('action', 'fill_knockouts')::text, true);

  update public.fixtures
  set home_team_id = p_ranking[1], away_team_id = p_ranking[2]
  where id = v_final.id
    and (home_team_id, away_team_id) is distinct from (p_ranking[1], p_ranking[2]);
  get diagnostics v_count = row_count;
  v_changed := v_changed + v_count;

  if v_has_third then
    update public.fixtures
    set home_team_id = p_ranking[3], away_team_id = p_ranking[4]
    where id = v_third.id
      and (home_team_id, away_team_id) is distinct from (p_ranking[3], p_ranking[4]);
    get diagnostics v_count = row_count;
    v_changed := v_changed + v_count;
  end if;

  perform set_config('sees.audit_context', '', true);

  return jsonb_build_object(
    'final', jsonb_build_object('fixtureId', v_final.id, 'homeTeamId', p_ranking[1], 'awayTeamId', p_ranking[2]),
    'thirdPlace', case when v_has_third then
      jsonb_build_object('fixtureId', v_third.id, 'homeTeamId', p_ranking[3], 'awayTeamId', p_ranking[4]) end,
    'changed', v_changed
  );
end;
$$;

revoke all on function public.admin_fill_knockouts(uuid, uuid[]) from public, anon;
grant execute on function public.admin_fill_knockouts(uuid, uuid[]) to authenticated;

-- =============================================================================
-- Verify (for Tayo, after applying). As the admin.
-- =============================================================================
-- 1. Before the league ends: admin.league_not_finished
--    select public.admin_fill_knockouts(
--      (select id from public.events where slug = 'football-men'),
--      (select array_agg(id order by year) from public.teams));
-- 2. A ranking with a missing or repeated team: admin.invalid_input
-- 3. After the league ends (test inside a transaction, marking the league
--    fixtures full_time from the SQL editor): the final gets ranking[1] v
--    ranking[2], the third-place match ranking[3] v ranking[4]; running it
--    again returns "changed": 0.
-- 4. As a plain user: admin.forbidden.
