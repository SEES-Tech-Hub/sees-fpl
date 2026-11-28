// Database tests for keeper saves (supabase/migrations/*_live_save*.sql):
// record_match_event accepts 'save' only for a named keeper while the ball is
// in play, and player_match_stats counts saves plus penalties saved.
// Runs on PGlite with all migrations applied (supabase/tests/db.ts).
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb, errorCode } from "./db";

let db: PGlite;
let admin: string;
let football: { event: string; home: string; away: string };
let keeper: string; // plays for `home`
let striker: string; // plays for `away`

beforeAll(async () => {
  db = await createTestDb();
  await db.exec("alter table public.match_events disable trigger match_events_kickoff_window");
  const { rows } = await db.query<{ event: string; home: string; away: string }>(`
    select e.id as event,
      (select id from public.teams where year = 1) as home,
      (select id from public.teams where year = 2) as away
    from public.events e join public.sports s on s.id = e.sport_id
    where s.slug = 'football' order by e.name limit 1`);
  football = rows[0];
  const player = async (team: string, position: string, name: string) =>
    (
      await db.query<{ id: string }>(
        `insert into public.players (team_id, full_name, display_name, position, price_tenths)
         values ($1, $2, $2, $3::public.player_position, 50) returning id`,
        [team, name, position],
      )
    ).rows[0].id;
  keeper = await player(football.home, "GK", "Test Keeper");
  striker = await player(football.away, "FWD", "Test Striker");
  admin = randomUUID();
  await db.query("insert into auth.users (id, email) values ($1, 'admin@test')", [admin]);
  await db.query("update public.profiles set role = 'admin' where id = $1", [admin]);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

async function freshFixture() {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.fixtures (event_id, stage, home_team_id, away_team_id, kickoff_at)
     values ($1, 'league', $2, $3, now()) returning id`,
    [football.event, football.home, football.away],
  );
  return rows[0].id;
}

async function kickOff(fixture: string) {
  await db.query(
    `insert into public.match_events (fixture_id, client_event_id, type, period, occurred_at, recorded_at)
     values ($1, gen_random_uuid(), 'period_start', 'first_half', now() - interval '10 minutes', now() - interval '10 minutes')`,
    [fixture],
  );
}

function save(fixture: string, team: string, player: string | null) {
  return asUser(db, admin, (tx) =>
    tx.query(
      `select public.record_match_event(p_fixture_id => $1, p_client_event_id => $2, p_type => 'save',
         p_team_id => $3, p_player_id => $4)`,
      [fixture, randomUUID(), team, player],
    ),
  );
}

async function keeperStats(fixture: string) {
  const { rows } = await db.query<{ saves: number; penalties_saved: number }>(
    "select saves, penalties_saved from public.player_match_stats where fixture_id = $1 and player_id = $2",
    [fixture, keeper],
  );
  return rows[0];
}

describe("keeper saves", () => {
  it("records a save for the keeper while the ball is in play", async () => {
    const f = await freshFixture();
    await kickOff(f);
    await save(f, football.home, keeper);
    await save(f, football.home, keeper);
    expect(await keeperStats(f)).toEqual({ saves: 2, penalties_saved: 0 });
  });

  it("counts a penalty save as a save too", async () => {
    const f = await freshFixture();
    await kickOff(f);
    await save(f, football.home, keeper);
    await asUser(db, admin, (tx) =>
      tx.query(
        `select public.record_match_event(p_fixture_id => $1, p_client_event_id => $2, p_type => 'penalty_miss',
           p_team_id => $3, p_player_id => $4, p_other_player_id => $5)`,
        [f, randomUUID(), football.away, striker, keeper],
      ),
    );
    expect(await keeperStats(f)).toEqual({ saves: 2, penalties_saved: 1 });
  });

  it("refuses a save before kick-off", async () => {
    const f = await freshFixture();
    expect(await errorCode(save(f, football.home, keeper))).toBe("live.invalid_state");
  });

  it("refuses a save with no keeper named", async () => {
    const f = await freshFixture();
    await kickOff(f);
    expect(await errorCode(save(f, football.home, null))).toBe("live.invalid_input");
  });

  it("refuses a keeper who isn't on that team", async () => {
    const f = await freshFixture();
    await kickOff(f);
    expect(await errorCode(save(f, football.away, keeper))).toMatch(/^live\./);
  });

  it("adds the save-points rule: 1 point per 3 saves", async () => {
    const { rows } = await db.query<{ pts_saves: number; pts_saves_step: number }>(
      "select pts_saves, pts_saves_step from public.fantasy_rules where id = 1",
    );
    expect(rows[0]).toEqual({ pts_saves: 1, pts_saves_step: 3 });
  });
});
