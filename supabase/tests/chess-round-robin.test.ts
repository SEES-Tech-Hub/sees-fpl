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

  it("is safe to run twice", async () => {
    await rerunMigration(db, MIGRATION);
    expect(await pairings()).toEqual(SCHEDULE);
  });
});
