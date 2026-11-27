-- =============================================================================
-- Remove the 26 Nov test friendly (Year 1 v Year 2, men's football)
-- Author: Tayo, 27 Nov
--
-- A test match recorded in the real men's football event on 26 Nov (stage
-- "friendly", 1-2, with a yellow, a red, goals, a missed penalty, a sub and
-- Man of the Match). It wasn't in a fantasy matchday or the league table, but
-- its events counted in the top scorers and cards, and its red card banned
-- Show (Year 2) from Year 2's real match on Sat 28 Nov.
--
-- Removes, by id: its 12 match events, its 40 team-sheet rows and the fixture.
-- Also removes the voided kick-off left on Year 5 v Year 3 by the 26 Nov
-- console mistake (no effect on anything; just tidy).
-- Stops if the fixture isn't the friendly described above. Safe to run twice.
-- =============================================================================

do $$
declare
  v_fixture constant uuid := 'c9c666b3-902c-4700-a48b-2fbebceece5d';
  v_ok      boolean;
begin
  select exists (
    select 1
    from public.fixtures f
    join public.events e on e.id = f.event_id
    join public.teams h on h.id = f.home_team_id
    join public.teams a on a.id = f.away_team_id
    where f.id = v_fixture and f.stage = 'friendly' and e.slug = 'football-men'
      and h.year = 1 and a.year = 2 and f.matchday_id is null
  ) into v_ok;

  if not v_ok then
    if exists (select 1 from public.fixtures where id = v_fixture) then
      raise exception 'Fixture % is not the Year 1 v Year 2 test friendly. Nothing removed.', v_fixture;
    end if;
    return;  -- already removed
  end if;

  delete from public.match_events where fixture_id = v_fixture;
  delete from public.lineups      where fixture_id = v_fixture;
  delete from public.fixtures     where id = v_fixture;
end;
$$;

-- The voided kick-off on Year 5 v Year 3 (26 Nov), only while it's the
-- fixture's only event and voided.
delete from public.match_events me
where me.fixture_id = 'defde20c-0bce-4ece-8350-421b07d3ece1'
  and me.voided_at is not null
  and not exists (
    select 1 from public.match_events o
    where o.fixture_id = me.fixture_id and o.voided_at is null
  );

-- =============================================================================
-- Verify (for Tayo, after applying)
-- =============================================================================
-- select count(*) from public.match_events;           -- 0
-- select * from public.football_suspensions;          -- no rows
-- select count(*) from public.fixtures where stage = 'friendly';   -- 0
