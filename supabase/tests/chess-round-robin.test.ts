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
});
