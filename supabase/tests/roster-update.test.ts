// The 27 Nov roster update (supabase/migrations/*_roster_update.sql): the
// captains' new prices and positions, Malik added, Zeus marked as left, and
// the guard that stops a position change breaking someone's squad.
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, errorCode, rerunMigration } from "./db";

const MIGRATION = "20261127081200_roster_update.sql";

type Row = { year: number; display_name: string; position: string; price_tenths: number; status: string };

let db: PGlite;
// Loading every migration takes a few seconds, longer when all test files run at once.
beforeAll(async () => {
  db = await createTestDb();
}, 60_000);
afterAll(async () => {
  await db.close();
});

async function player(year: number, name: string) {
  const { rows } = await db.query<Row>(
    `select t.year, p.display_name, p.position, p.price_tenths, p.status
     from public.players p join public.teams t on t.id = p.team_id
     where t.year = $1 and p.display_name = $2`,
    [year, name],
  );
  return rows;
}

async function alvinY4() {
  const { rows } = await db.query<{ id: string }>(
    "select p.id from public.players p join public.teams t on t.id = p.team_id where t.year = 4 and p.display_name = 'Alvin'",
  );
  return rows[0].id;
}

/** A manager with this id (and a user and profile behind it). */
async function newManager(id: string) {
  const user = randomUUID();
  await db.query("insert into auth.users (id) values ($1)", [user]);
  await db.query("insert into public.profiles (id) values ($1) on conflict do nothing", [user]);
  await db.query("insert into public.managers (id, user_id, team_name) values ($1, $2, 'Test FC')", [id, user]);
  return id;
}

async function count(table: "squads" | "picks" | "managers", managerId: string, column = "manager_id") {
  const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from public.${table} where ${column} = $1`, [managerId]);
  return rows[0].n;
}

describe("roster update", () => {
  it("sets the new prices", async () => {
    expect((await player(1, "Ezekiel"))[0].price_tenths).toBe(50);
    expect((await player(1, "Oluwadamilola"))[0].price_tenths).toBe(55);
    expect((await player(5, "Korede"))[0].price_tenths).toBe(65);
  });

  it("moves Marshall, Alvin, Success (Year 4) and Fame (Year 5) to midfield", async () => {
    for (const [year, name] of [[4, "Marshall"], [4, "Alvin"], [4, "Success"], [5, "Fame"]] as const) {
      expect((await player(year, name))[0].position).toBe("MID");
    }
    // Year 5's Alvin was already a midfielder; unchanged.
    expect((await player(5, "Alvin"))[0]).toMatchObject({ position: "MID", price_tenths: 50 });
  });

  it("adds Year 4's Malik and leaves Year 2's alone", async () => {
    expect(await player(4, "Malik")).toEqual([{ year: 4, display_name: "Malik", position: "MID", price_tenths: 50, status: "available" }]);
    expect(await player(2, "Malik")).toHaveLength(1);
  });

  it("marks Zeus as left", async () => {
    expect((await player(4, "Zeus"))[0].status).toBe("left");
  });

  it("is safe to run twice", async () => {
    await rerunMigration(db, MIGRATION);
    expect(await player(4, "Malik")).toHaveLength(1);
    expect((await player(5, "Korede"))[0].price_tenths).toBe(65);
  });

  it("clears the three named squads, and only while they hold a player about to move", async () => {
    const ldr = "c85feb21-36b9-435a-a7be-b1bf91786413";
    const alvin = await alvinY4();
    const md = await db.query<{ id: string }>("select id from public.matchdays order by number limit 1");
    await newManager(ldr);
    await db.query("update public.players set position = 'FWD' where id = $1", [alvin]);
    await db.query("insert into public.squads (manager_id, player_id) values ($1, $2)", [ldr, alvin]);
    await db.query("insert into public.picks (manager_id, matchday_id, player_id, is_starter) values ($1, $2, $3, true)", [
      ldr,
      md.rows[0].id,
      alvin,
    ]);

    await rerunMigration(db, MIGRATION);
    expect(await count("squads", ldr)).toBe(0);
    expect(await count("picks", ldr)).toBe(0);
    expect(await count("managers", ldr, "id")).toBe(1);
    expect((await player(4, "Alvin"))[0].position).toBe("MID");

    // Their new squad (Alvin now a midfielder) is left alone on a rerun.
    await db.query("insert into public.squads (manager_id, player_id) values ($1, $2)", [ldr, alvin]);
    await rerunMigration(db, MIGRATION);
    expect(await count("squads", ldr)).toBe(1);
  });

  it("stops if a squad holds a player whose position would change", async () => {
    const other = await newManager(randomUUID());
    const alvin = await alvinY4();
    await db.query("update public.players set position = 'FWD' where id = $1", [alvin]);
    await db.query("insert into public.squads (manager_id, player_id) values ($1, $2)", [other, alvin]);

    expect(await errorCode(rerunMigration(db, MIGRATION))).toMatch(/would change position: Alvin/);
    expect((await player(4, "Alvin"))[0].position).toBe("FWD");
  });
});
