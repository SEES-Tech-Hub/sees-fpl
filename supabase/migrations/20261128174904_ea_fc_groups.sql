-- =============================================================================
-- EA FC (28 Nov): two groups of five, then semi-finals and a final
-- Owner: Tayo
--
-- EA FC was set up as a two-leg knockout bracket (eliminators, quarter-finals,
-- two-leg semis), but it was played as two groups of five (six matches a group,
-- not a full round robin), the top two of each group into single-match semis,
-- then a final. No official recorded it; the results below are from the
-- commentary channel. Players play for their year (home_team_id/away_team_id);
-- their names are the entrants.
--
--   Group A  Damisi (Y2) 8–1 Benedict (Y1)    Group B  Show (Y2) 9–0 Ohuni (Y1)
--            Alvin (Y5) 3–2 Freddy (Y3)                Emmanuel (Y4) 9–1 Savid (Y3)
--            Wayne (Y4) 7–3 Benedict (Y1)              Ohuni (Y1) 2–1 David (Y5)
--            Alvin (Y5) 6–5 Damisi (Y2)                Show (Y2) 4–3 Savid (Y3)
--            Freddy (Y3) v Benedict (Y1): not known    Emmanuel (Y4) 5–2 David (Y5)
--            Damisi (Y2) 4–1 Wayne (Y4)                Savid (Y3) 7–2 Ohuni (Y1)
--   Semi-finals  Emmanuel (Y4) 8–2 Damisi (Y2); Show (Y2) v Alvin (Y5), for the console
--   Final        Emmanuel (Y4) v the winner of Show–Alvin
--
-- The groups use stages 'group_A' and 'group_B', not 'group': the site's group
-- tables count by year, and here two Year 2 players would share one row. So
-- they show as rounds (Group A, Group B) with their results, without a table.
-- The empty placeholder fixtures (no events) are deleted. Fixed ids: safe to
-- run twice.
-- =============================================================================

do $$
declare
  v_event uuid := (select id from public.events where slug = 'mobile-games-ea-fc');
  v_day   timestamptz := timestamptz '2026-11-28 11:00:00+00';
  m record;
  v_keep uuid[];
begin
  if v_event is null then
    raise notice 'ea_fc_groups: no EA FC event here; nothing to do';
    return;
  end if;

  create temporary table ea_fc_matches (
    id uuid, stage text, tie text, slot int,
    home_year int, home_name text, away_year int, away_name text,
    home_goals int, away_goals int
  ) on commit drop;

  insert into ea_fc_matches values
    -- Group A
    ('0381c92d-0c1f-4fe5-a53d-b528ae34249e', 'group_A', 'A1', 0, 2, 'Damisi',   1, 'Benedict', 8, 1),
    ('ce55c37a-ee49-41fb-b774-3cb82a184e44', 'group_A', 'A2', 1, 5, 'Alvin',    3, 'Freddy',   3, 2),
    ('43c9ab9c-d981-44f6-b8ee-550b0fd91010', 'group_A', 'A3', 2, 4, 'Wayne',    1, 'Benedict', 7, 3),
    ('f24468c9-98dd-480f-8608-4b3b5f850198', 'group_A', 'A4', 3, 5, 'Alvin',    2, 'Damisi',   6, 5),
    ('1734b267-a608-4203-9539-c5691e12a7d9', 'group_A', 'A6', 5, 2, 'Damisi',   4, 'Wayne',    4, 1),
    -- Group B
    ('082ba68a-8efa-4907-b985-5eb696058fc9', 'group_B', 'B1', 0, 2, 'Show',     1, 'Ohuni',    9, 0),
    ('47b9ca70-30a5-4360-93b5-b32b6d2fc0d4', 'group_B', 'B2', 1, 4, 'Emmanuel', 3, 'Savid',    9, 1),
    ('fe403d4f-e280-4eee-bbe7-e39f46133263', 'group_B', 'B3', 2, 1, 'Ohuni',    5, 'David',    2, 1),
    ('94246b0f-1089-4c22-bdd1-0e8eeb95c51c', 'group_B', 'B4', 3, 2, 'Show',     3, 'Savid',    4, 3),
    ('5547570e-a487-466f-b395-c711351d9122', 'group_B', 'B5', 4, 4, 'Emmanuel', 5, 'David',    5, 2),
    ('fa64cde8-a9aa-455b-ae43-f72c5c43b553', 'group_B', 'B6', 5, 3, 'Savid',    1, 'Ohuni',    7, 2),
    -- Knockouts (null goals: not played yet)
    ('5959a153-36c9-4eb9-a062-dc06f09b2493', 'semi_final', 'SF1', 7, 4, 'Emmanuel', 2, 'Damisi', 8, 2),
    ('bd6867dc-cadf-4e0a-87b4-2f0f0c898ad6', 'semi_final', 'SF2', 7, 2, 'Show',     5, 'Alvin',  null, null),
    ('5370514c-b46d-40e3-8e04-5acc64558551', 'final',      'Final', 9, 4, 'Emmanuel', null, null, null, null);

  -- Remove the empty placeholders (anything else in EA FC without results).
  select array_agg(id) into v_keep from ea_fc_matches;
  delete from public.fixtures f
  where f.event_id = v_event and not (f.id = any (v_keep))
    and not exists (select 1 from public.match_events e where e.fixture_id = f.id)
    and not exists (select 1 from public.lineups l where l.fixture_id = f.id);

  -- The matches, each slot 15 minutes after the last (12:00 WAT onwards).
  insert into public.fixtures (id, event_id, stage, tie, kickoff_at, home_team_id, away_team_id, home_entrant, away_entrant)
  select x.id, v_event, x.stage, x.tie, v_day + make_interval(mins => 15 * x.slot),
         (select id from public.teams where year = x.home_year),
         (select id from public.teams where year = x.away_year),
         x.home_name, x.away_name
  from ea_fc_matches x
  on conflict (id) do nothing;

  -- Results: the goals as one score event per side, then full time.
  for m in select * from ea_fc_matches where home_goals is not null loop
    if exists (select 1 from public.match_events where fixture_id = m.id and voided_at is null) then
      continue;
    end if;
    if m.home_goals > 0 then
      insert into public.match_events (fixture_id, client_event_id, type, team_id, side, points, occurred_at)
      values (m.id, gen_random_uuid(), 'point', (select id from public.teams where year = m.home_year), 'home',
              m.home_goals, v_day + make_interval(mins => 15 * m.slot + 10));
    end if;
    if m.away_goals > 0 then
      insert into public.match_events (fixture_id, client_event_id, type, team_id, side, points, occurred_at)
      values (m.id, gen_random_uuid(), 'point', (select id from public.teams where year = m.away_year), 'away',
              m.away_goals, v_day + make_interval(mins => 15 * m.slot + 10, secs => 1));
    end if;
    insert into public.match_events (fixture_id, client_event_id, type, occurred_at)
    values (m.id, gen_random_uuid(), 'full_time', v_day + make_interval(mins => 15 * m.slot + 14));
  end loop;
end;
$$;
