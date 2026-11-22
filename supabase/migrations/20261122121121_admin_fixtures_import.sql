-- =============================================================================
-- Admin: fixtures import
-- Author: Akeem (admin backend)
-- PRD: "Feature: Admin portal and match console", item 4 (fixtures: create,
--      set kickoff times, import from CSV)
-- CSV format: docs/admin-csv-formats.md
-- Needs: 20261122120701_admin_players_prices.sql (the shared import helpers)
--
-- What this adds
--   * admin_import_fixtures(import_id, rows): the fixtures CSV commit. Admin
--     only, all rows or none, safe to commit twice (import id), every row
--     re-checked, the import id on every audit row. Returns
--     { inserted, updated, unchanged, alreadyApplied }.
--
-- Rows are matched to existing fixtures by the preview, on
-- (event, stage, home, away). For an existing fixture only kickoff_at, venue
-- and matchday_id change; its event, stage and teams must match the row.
-- Bolu's guard on fixtures still applies to every write.
--
-- Matchday deadlines are not recalculated when kickoffs move. The admin sets
-- each deadline in the admin portal (decided with Akeem and Mary).
--
-- Runs as the caller (SECURITY INVOKER), so row-level security applies.
-- Safe to run twice.
-- =============================================================================

-- Each row (snake_case JSON, from previewFixturesCsv):
--   row_number, existing_id (null for a new fixture), event_id, stage,
--   home_team_id, away_team_id, kickoff_at, venue, matchday_id
create or replace function public.admin_import_fixtures(p_import_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_done     jsonb;
  v_errors   text[];
  v_inserted integer;
  v_updated  integer;
  v_total    integer;
begin
  v_done := public.admin_begin_import(p_import_id, 'fixtures', p_rows);
  if v_done is not null then
    return v_done;
  end if;
  v_total := jsonb_array_length(p_rows);

  drop table if exists pg_temp.admin_fixture_rows;
  create temp table admin_fixture_rows on commit drop as
  select
    r.row_number,
    r.existing_id,
    r.event_id,
    lower(btrim(coalesce(r.stage, ''))) as stage,
    r.home_team_id,
    r.away_team_id,
    r.kickoff_at,
    public.admin_normalise_name(r.venue) as venue,
    r.matchday_id
  from jsonb_to_recordset(p_rows) as r (
    row_number   integer,
    existing_id  uuid,
    event_id     uuid,
    stage        text,
    home_team_id uuid,
    away_team_id uuid,
    kickoff_at   timestamptz,
    venue        text,
    matchday_id  uuid
  );

  select array_agg(problem order by row_number) into v_errors
  from (
    select r.row_number, format('Row %s: %s', r.row_number, p.problem) as problem
    from admin_fixture_rows r
    left join public.fixtures f on f.id = r.existing_id
    cross join lateral (values
      (case when r.existing_id is not null and f.id is null then 'that fixture no longer exists.' end),
      (case when r.event_id is null or not exists (select 1 from public.events e where e.id = r.event_id)
            then 'the event doesn''t exist.' end),
      (case when r.stage !~ '^[a-z0-9_]{1,40}$' then 'the stage must be letters, numbers and _, like league or third_place.' end),
      (case when (r.home_team_id is null) <> (r.away_team_id is null)
            then 'give both teams, or leave both empty if they aren''t known yet.' end),
      (case when r.home_team_id is not null and r.home_team_id = r.away_team_id then 'a team can''t play itself.' end),
      (case when (r.home_team_id is not null and not exists (select 1 from public.teams t where t.id = r.home_team_id))
              or (r.away_team_id is not null and not exists (select 1 from public.teams t where t.id = r.away_team_id))
            then 'a team doesn''t exist.' end),
      (case when r.matchday_id is not null and not exists (select 1 from public.matchdays m where m.id = r.matchday_id)
            then 'the matchday doesn''t exist.' end),
      (case when char_length(r.venue) > 100 then 'the venue is longer than 100 characters.' end),
      (case when f.id is not null
             and (f.event_id, f.stage, f.home_team_id, f.away_team_id)
                 is distinct from (r.event_id, r.stage, r.home_team_id, r.away_team_id)
            then 'an import can''t change a fixture''s event, stage or teams. Edit the fixture instead.' end),
      (case when r.existing_id is not null
             and (select count(*) from admin_fixture_rows d where d.existing_id = r.existing_id) > 1
            then 'the same fixture appears in another row.' end)
    ) as p (problem)
    where p.problem is not null
  ) problems;

  perform public.admin_raise_row_errors(v_errors);

  with changed as (
    update public.fixtures f
    set kickoff_at  = r.kickoff_at,
        venue       = r.venue,
        matchday_id = r.matchday_id
    from admin_fixture_rows r
    where r.existing_id = f.id
      and (f.kickoff_at, f.venue, f.matchday_id) is distinct from (r.kickoff_at, r.venue, r.matchday_id)
    returning f.id
  )
  select count(*) into v_updated from changed;

  with added as (
    insert into public.fixtures (event_id, stage, home_team_id, away_team_id, kickoff_at, venue, matchday_id)
    select r.event_id, r.stage, r.home_team_id, r.away_team_id, r.kickoff_at, r.venue, r.matchday_id
    from admin_fixture_rows r
    where r.existing_id is null
    order by r.row_number
    returning id
  )
  select count(*) into v_inserted from added;

  return public.admin_finish_import(p_import_id, v_inserted, v_updated, v_total - v_inserted - v_updated);
end;
$$;

revoke all on function public.admin_import_fixtures(uuid, jsonb) from public, anon;
grant execute on function public.admin_import_fixtures(uuid, jsonb) to authenticated;

-- =============================================================================
-- Verify (for Tayo, after applying). As the admin in the app, or in the SQL
-- editor with: set local role authenticated;
--              set local request.jwt.claims = '{"sub": "<admin profile id>"}';
-- =============================================================================
-- 1. Move the first matchday 1 kickoff to 15:30 WAT:
--    select public.admin_import_fixtures('00000000-0000-0000-0000-0000000000f1', (
--      select jsonb_agg(jsonb_build_object(
--        'row_number', 2, 'existing_id', id, 'event_id', event_id, 'stage', stage,
--        'home_team_id', home_team_id, 'away_team_id', away_team_id,
--        'kickoff_at', '2026-11-28T15:30:00+01:00', 'venue', venue, 'matchday_id', matchday_id))
--      from public.fixtures where stage = 'league' order by kickoff_at limit 1));
--    -- {"inserted": 0, "updated": 1, "unchanged": 0, "alreadyApplied": false}
--    -- run it again: the same counts with "alreadyApplied": true
--
-- 2. Changing teams through an import is refused (admin.import_invalid):
--    the same call with a new import id and 'home_team_id' set to another team.
--
-- 3. As a plain user: admin.forbidden. As anon: permission denied.
