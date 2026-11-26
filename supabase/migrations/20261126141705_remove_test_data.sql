-- =============================================================================
-- Remove the test data before the festival
-- Author: Tayo, 26 Nov
--
-- Found by checking the live database on 26 Nov. Removes only:
--   * the "Test Football Match." event (football) and its 2 fixtures
--     (Y1 v Y2 on 23 Nov, Y3 v Y4 on 25 Nov), with their 26 match events.
--     They aren't in any fantasy matchday, but their goals and cards count in
--     the football views (top scorers, suspensions).
--   * the 2 test fantasy teams on Tayo's own accounts, "Gojo's Squad" and
--     "Machiaveliian Devils", with their squads, picks and transfer (cascade).
--     The accounts themselves stay, so they can make a real team later.
--   * the 2 expired test announcements.
-- Real teams (Dips FC, Dolphmaster FC), the schedule, players, prices, push
-- subscriptions, analytics and the audit log are not touched.
--
-- Match events are append-only for signed-in users; a migration runs with no
-- user, which the guard allows. Rows are matched by id, so running this again
-- does nothing.
-- =============================================================================

do $$
declare
  v_event    constant uuid   := 'd19f1b46-0e6e-4c5e-b584-6143fe660cdc';
  v_fixtures constant uuid[] := array['4e0f5532-457f-4f7c-92e9-20b2d27cae92', 'bbc4c16b-921e-4bde-8a5f-19b9a7b1edf6']::uuid[];
begin
  -- Only the test event's own fixtures, and stop if it ever gains a real one.
  if exists (select 1 from public.fixtures where event_id = v_event and id <> all (v_fixtures)) then
    raise exception 'The test event has fixtures other than the two test matches. Nothing removed.';
  end if;

  delete from public.match_events where fixture_id = any (v_fixtures);
  delete from public.lineups      where fixture_id = any (v_fixtures);
  delete from public.race_entries where fixture_id = any (v_fixtures);
  delete from public.fixtures     where id = any (v_fixtures);
  delete from public.events       where id = v_event;
end;
$$;

delete from public.managers
where id in ('b347de01-3b3b-4159-a1e3-24409c752083',   -- Gojo's Squad
             'e6a3e8e3-2323-455e-a158-4ebcb2e090ca');  -- Machiaveliian Devils

delete from public.announcements
where id in ('19378140-da91-4953-8d16-c0a491483e96',   -- "Seond test announcement!"
             'e6db3c20-a25f-46cc-a05e-66c3d53c3df7');  -- "Announcement Testing: this better work!"

-- =============================================================================
-- Verify (for Tayo, after applying)
-- =============================================================================
-- select count(*) from public.match_events;                        -- 0
-- select count(*) from public.events where name ilike '%test%';    -- 0
-- select team_name from public.managers;                           -- Dips FC, Dolphmaster FC
-- select message from public.announcements;                        -- the fantasy launch one
