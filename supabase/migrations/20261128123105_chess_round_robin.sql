-- =============================================================================
-- Chess: one departmental round robin on two boards
-- Owner: Tayo
--
-- The organisers replaced Chess (men) and Chess (women) with one departmental
-- chess event: every year plays every other year once, on two boards (Board 1
-- and Board 2 get opposite colours). Scores count boards: a board win is
-- 2 points, a draw 1 each, shown halved (2–0, 1½–½; lib/live/display.ts).
--
-- 1. Chess (men) becomes "Chess" with 2 boards. Its slug stays, so links and
--    share pictures keep working.
-- 2. Its 10 fixtures are re-paired round by round, keeping their time slots
--    (the five kick-off times, earliest first). The team playing White is
--    listed first (home):
--      R1  Y2 v Y5, Y4 v Y3      R2  Y5 v Y1, Y2 v Y3      R3  Y1 v Y4, Y3 v Y5
--      R4  Y3 v Y1, Y4 v Y2      R5  Y1 v Y2, Y5 v Y4
-- 3. Chess (women) and its fixtures are deleted. Refused if any of them has
--    match events, lineups or race entries; reactions go with the fixtures.
--
-- Matches by slug, so it does nothing where the chess events don't exist
-- (a fresh test database). Safe to run twice.
-- =============================================================================

do $$
declare
  v_men   uuid;
  v_women uuid;
  v_slots timestamptz[];
  v_pairs int[][] := array[
    [2, 5], [4, 3],   -- round 1
    [5, 1], [2, 3],   -- round 2
    [1, 4], [3, 5],   -- round 3
    [3, 1], [4, 2],   -- round 4
    [1, 2], [5, 4]    -- round 5
  ];
  v_ids   uuid[];
  v_round int;
  v_pair  int;
begin
  select id into v_men   from public.events where slug = 'board-games-chess-men';
  select id into v_women from public.events where slug = 'board-games-chess-women';

  if v_men is null then
    raise notice 'chess_round_robin: no Chess (men) event here; nothing to do';
    return;
  end if;

  update public.events set name = 'Chess', boards = 2 where id = v_men;

  -- Re-pair only fixtures that haven't started (no events): the guard on
  -- fixtures refuses team changes once there are events.
  if exists (
    select 1 from public.fixtures f
    join public.match_events e on e.fixture_id = f.id and e.voided_at is null
    where f.event_id = v_men
  ) then
    raise exception 'chess_round_robin: a Chess fixture already has match events; re-pair it by hand';
  end if;

  select array_agg(distinct kickoff_at order by kickoff_at) into v_slots
  from public.fixtures where event_id = v_men;

  if coalesce(array_length(v_slots, 1), 0) = 5
     and (select count(*) from public.fixtures where event_id = v_men) = 10 then
    for v_round in 1..5 loop
      select array_agg(id order by id) into v_ids
      from public.fixtures where event_id = v_men and kickoff_at = v_slots[v_round];
      if coalesce(array_length(v_ids, 1), 0) <> 2 then
        raise exception 'chess_round_robin: expected 2 fixtures at %, found %', v_slots[v_round], coalesce(array_length(v_ids, 1), 0);
      end if;
      for v_pair in 1..2 loop
        update public.fixtures f
        set home_team_id = (select id from public.teams where year = v_pairs[(v_round - 1) * 2 + v_pair][1]),
            away_team_id = (select id from public.teams where year = v_pairs[(v_round - 1) * 2 + v_pair][2])
        where f.id = v_ids[v_pair];
      end loop;
    end loop;
  else
    raise notice 'chess_round_robin: Chess has % fixtures in % slots, not 10 in 5; teams left as they are',
      (select count(*) from public.fixtures where event_id = v_men), coalesce(array_length(v_slots, 1), 0);
  end if;

  if v_women is not null then
    if exists (select 1 from public.match_events e join public.fixtures f on f.id = e.fixture_id where f.event_id = v_women)
       or exists (select 1 from public.lineups l join public.fixtures f on f.id = l.fixture_id where f.event_id = v_women)
       or exists (select 1 from public.race_entries r join public.fixtures f on f.id = r.fixture_id where f.event_id = v_women) then
      raise exception 'chess_round_robin: Chess (women) has results; not deleting it';
    end if;
    delete from public.fixtures where event_id = v_women;
    delete from public.events where id = v_women;
  end if;
end;
$$;
