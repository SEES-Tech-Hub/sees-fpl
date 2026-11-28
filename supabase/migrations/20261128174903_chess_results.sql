-- =============================================================================
-- Chess: rounds 2–5 from the organisers' scoresheet, and no bye points
-- Owner: Tayo
--
-- The board games scoresheet (Board 1 and Board 2 grids, doubled: a win 2, a
-- draw 1) has every result. Rounds 2–5, White first; H = White won the board,
-- A = Black won it, D = drawn:
--   R2  Y5 v Y1  A H (1–1)        Y2 v Y3  A A (0–2)
--   R3  Y1 v Y4  A A (0–2)        Y3 v Y5  H H (2–0)
--   R4  Y3 v Y1  H H (2–0)        Y4 v Y2  A H (1–1)
--   R5  Y1 v Y2  A A (0–2)        Y5 v Y4  A A (0–2)
-- With round 1 (already in) the totals match the sheet's final table:
-- Year 3 7, Year 4 6, Year 2 5, Year 1 1, Year 5 1 (it shows them doubled:
-- 14, 12, 10, 2, 2).
--
-- The sheet's final table doesn't add byes, so chess's bye_score goes back to
-- null (20261128125555_chess_byes.sql). Every year sat out once, so the order
-- is the same either way.
--
-- A match that already has events is left alone, so it's safe to run twice.
-- =============================================================================

update public.events set bye_score = null where slug = 'board-games-chess-men';

do $$
declare
  v_event uuid := (select id from public.events where slug = 'board-games-chess-men');
  r record;
  v_fixture public.fixtures%rowtype;
  v_board int;
  v_result text;
begin
  if v_event is null then
    raise notice 'chess_results: no chess event here; nothing to do';
    return;
  end if;

  for r in
    select * from (values
      (5, 1, 'A', 'H'), (2, 3, 'A', 'A'),
      (1, 4, 'A', 'A'), (3, 5, 'H', 'H'),
      (3, 1, 'H', 'H'), (4, 2, 'A', 'H'),
      (1, 2, 'A', 'A'), (5, 4, 'A', 'A')
    ) as v(home_year, away_year, b1, b2)
  loop
    select f.* into v_fixture
    from public.fixtures f
    join public.teams h on h.id = f.home_team_id and h.year = r.home_year
    join public.teams a on a.id = f.away_team_id and a.year = r.away_year
    where f.event_id = v_event;

    if v_fixture.id is null then
      raise notice 'chess_results: no fixture Y% v Y%', r.home_year, r.away_year;
      continue;
    end if;
    if exists (select 1 from public.match_events where fixture_id = v_fixture.id and voided_at is null) then
      continue;
    end if;

    for v_board in 1..2 loop
      v_result := case v_board when 1 then r.b1 else r.b2 end;
      if v_result in ('H', 'D') then
        insert into public.match_events (fixture_id, client_event_id, type, team_id, side, points, board, occurred_at)
        values (v_fixture.id, gen_random_uuid(), 'point', v_fixture.home_team_id, 'home',
                case when v_result = 'H' then 2 else 1 end, v_board,
                coalesce(v_fixture.kickoff_at, now()) + make_interval(mins => 30 + v_board));
      end if;
      if v_result in ('A', 'D') then
        insert into public.match_events (fixture_id, client_event_id, type, team_id, side, points, board, occurred_at)
        values (v_fixture.id, gen_random_uuid(), 'point', v_fixture.away_team_id, 'away',
                case when v_result = 'A' then 2 else 1 end, v_board,
                coalesce(v_fixture.kickoff_at, now()) + make_interval(mins => 30 + v_board));
      end if;
    end loop;

    insert into public.match_events (fixture_id, client_event_id, type, occurred_at)
    values (v_fixture.id, gen_random_uuid(), 'full_time', coalesce(v_fixture.kickoff_at, now()) + interval '40 minutes');
  end loop;
end;
$$;
