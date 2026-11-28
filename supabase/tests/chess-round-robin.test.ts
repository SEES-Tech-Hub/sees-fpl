// The departmental chess round robin (supabase/migrations/*_chess_round_robin.sql),
// run on the festival schedule the earlier migrations create.
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, rerunMigration } from "./db";

const MIGRATION = "20261128123105_chess_round_robin.sql";

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
}, 120_000);

afterAll(async () => {
  await db?.close();
});

async function pairings() {
  const { rows } = await db.query<{ round: number; home: number; away: number }>(`
    select dense_rank() over (order by f.kickoff_at)::int as round, h.year as home, a.year as away
    from public.fixtures f
    join public.events e on e.id = f.event_id
    join public.teams h on h.id = f.home_team_id
    join public.teams a on a.id = f.away_team_id
    where e.slug = 'board-games-chess-men'
    order by f.kickoff_at, h.year`);
  return rows.map((r) => `R${r.round} Y${r.home} v Y${r.away}`).sort();
}

const SCHEDULE = [
  "R1 Y2 v Y5", "R1 Y4 v Y3",
  "R2 Y5 v Y1", "R2 Y2 v Y3",
  "R3 Y1 v Y4", "R3 Y3 v Y5",
  "R4 Y3 v Y1", "R4 Y4 v Y2",
  "R5 Y1 v Y2", "R5 Y5 v Y4",
].sort();

describe("chess round robin", () => {
  it("makes one Chess event on two boards", async () => {
    const { rows } = await db.query<{ name: string; boards: number }>(
      "select name, boards from public.events where slug like 'board-games-chess%'",
    );
    expect(rows).toEqual([{ name: "Chess", boards: 2 }]);
  });

  it("pairs the ten fixtures as the organisers' schedule, White first", async () => {
    expect(await pairings()).toEqual(SCHEDULE);
  });

  it("plays every year against every other year once", async () => {
    const pairs = (await pairings()).map((p) => p.slice(3).split(" v ").sort().join("-"));
    expect(new Set(pairs).size).toBe(10);
  });

  it("removes the women's chess fixtures", async () => {
    const { rows } = await db.query<{ n: number }>(`
      select count(*)::int as n from public.fixtures f join public.events e on e.id = f.event_id
      where e.slug = 'board-games-chess-women'`);
    expect(rows[0].n).toBe(0);
  });

  it("won't re-pair once matches have results, and leaves them as they are", async () => {
    // Later migrations (chess_results) record every match, so a second run must refuse.
    await expect(rerunMigration(db, MIGRATION)).rejects.toThrow(/already has match events/);
    expect(await pairings()).toEqual(SCHEDULE);
  });

  it("enters rounds 2–5 from the organisers' scoresheet", async () => {
    // Round 1 was entered live in production (Y2 2–0 Y5, Y4 1–1 Y3); adding
    // it gives the sheet's final table: Y3 7, Y4 6, Y2 5, Y1 1, Y5 1.
    const { rows } = await db.query<{ team_year: number; boards: number }>(`
      select s.team_year, s.score_for / 2.0 as boards from public.event_standings s
      join public.events e on e.id = s.event_id where e.slug = 'board-games-chess-men' order by s.team_year`);
    expect(rows.map((r) => [r.team_year, Number(r.boards)])).toEqual([[1, 1], [2, 3], [3, 6], [4, 5], [5, 1]]);
  });

  it("gives medals to the top three once every match is over (no final needed)", async () => {
    const medals = () =>
      db.query<{ medal: string; year: number }>(`
        select m.medal, t.year from public.event_medals m
        join public.events e on e.id = m.event_id join public.teams t on t.id = m.team_id
        where e.slug = 'board-games-chess-men' order by m.place`);
    // Round 1 isn't played here yet, so no medals.
    expect((await medals()).rows).toEqual([]);

    // Play round 1 as it went in production: Y2 won both boards against Y5; Y4 v Y3 drew both.
    const { rows: r1 } = await db.query<{ id: string; home: number; home_team: string; away_team: string }>(`
      select f.id, h.year as home, f.home_team_id as home_team, f.away_team_id as away_team from public.fixtures f
      join public.events e on e.id = f.event_id join public.teams h on h.id = f.home_team_id
      where e.slug = 'board-games-chess-men' and not exists (select 1 from public.match_events m where m.fixture_id = f.id)`);
    for (const f of r1) {
      const point = (team: string, side: string, points: number, board: number) =>
        db.query(
          `insert into public.match_events (fixture_id, client_event_id, type, team_id, side, points, board, occurred_at)
           values ($1, gen_random_uuid(), 'point', $2, $3, $4, $5, now())`,
          [f.id, team, side, points, board],
        );
      for (const board of [1, 2]) {
        if (f.home === 2) await point(f.home_team, "home", 2, board);
        else {
          await point(f.home_team, "home", 1, board);
          await point(f.away_team, "away", 1, board);
        }
      }
      await db.query(
        `insert into public.match_events (fixture_id, client_event_id, type, occurred_at) values ($1, gen_random_uuid(), 'full_time', now() + interval '1 second')`,
        [f.id],
      );
    }
    const { rows } = await medals();
    expect(rows).toEqual([
      { medal: "gold", year: 3 },
      { medal: "silver", year: 4 },
      { medal: "bronze", year: 2 },
    ]);
  });
});

describe("official placings (Connect Four)", () => {
  it("give Connect Four's medals from the organisers' final table", async () => {
    const { rows } = await db.query<{ medal: string; year: number; has_fixture: boolean }>(`
      select m.medal, t.year, m.fixture_id is not null as has_fixture from public.event_medals m
      join public.events e on e.id = m.event_id join public.teams t on t.id = m.team_id
      where e.slug = 'board-games-connect-four' order by m.place`);
    expect(rows).toEqual([
      { medal: "gold", year: 5, has_fixture: true },
      { medal: "silver", year: 4, has_fixture: true },
      { medal: "bronze", year: 3, has_fixture: true },
    ]);
  });
});
