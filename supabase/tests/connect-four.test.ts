// Connect Four as best of three (supabase/migrations/*_connect_four_best_of_three.sql):
// a third board can be recorded, a 2–0 ends without it, and a match ended
// before the change can be reopened by the admin to add its third game.
// Runs on PGlite with all migrations applied (supabase/tests/db.ts).
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb, errorCode, rerunMigration } from "./db";

const MIGRATION = "20261128130828_connect_four_best_of_three.sql";

let db: PGlite;
let admin: string;
let c4: { event: string; y1: string; y3: string };

beforeAll(async () => {
  db = await createTestDb();
  await db.exec("alter table public.match_events disable trigger match_events_kickoff_window");
  const { rows } = await db.query<{ event: string; y1: string; y3: string }>(`
    select e.id as event,
      (select id from public.teams where year = 1) as y1,
      (select id from public.teams where year = 3) as y3
    from public.events e where e.slug = 'board-games-connect-four'`);
  c4 = rows[0];
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
     values ($1, 'group', $2, $3, now()) returning id`,
    [c4.event, c4.y1, c4.y3],
  );
  return rows[0].id;
}

const call = (sql: string, args: unknown[]) => asUser(db, admin, (tx) => tx.query(sql, args));

/** One board's result, as the console sends it: a win is 2 points, a draw 1 to each side. */
async function board(fixture: string, n: number, result: "y1" | "y3" | "draw") {
  const point = (team: string, points: number) =>
    call(
      `select public.record_match_event(p_fixture_id => $1, p_client_event_id => $2, p_type => 'point',
         p_team_id => $3, p_points => $4::smallint, p_board => $5::smallint)`,
      [fixture, randomUUID(), team, points, n],
    );
  if (result === "draw") {
    await point(c4.y1, 1);
    await point(c4.y3, 1);
  } else {
    await point(result === "y1" ? c4.y1 : c4.y3, 2);
  }
}

async function endMatch(fixture: string) {
  const id = randomUUID();
  await call(`select public.record_match_event(p_fixture_id => $1, p_client_event_id => $2, p_type => 'full_time')`, [
    fixture,
    id,
  ]);
  return id;
}

async function fixtureRow(id: string) {
  const { rows } = await db.query<{ status: string; home_score: number; away_score: number; winner: number | null }>(
    `select f.status, f.home_score, f.away_score, t.year as winner
     from public.fixtures f left join public.teams t on t.id = f.winner_team_id where f.id = $1`,
    [id],
  );
  return rows[0];
}

describe("Connect Four: best of three", () => {
  it("gives Connect Four 3 boards and leaves the other board games alone", async () => {
    const { rows } = await db.query<{ slug: string; boards: number }>(
      "select slug, boards from public.events where slug like 'board-games-%' order by slug",
    );
    const boards = Object.fromEntries(rows.map((r) => [r.slug, r.boards]));
    expect(boards["board-games-connect-four"]).toBe(3);
    expect(boards["board-games-chess-men"]).toBe(2);
    for (const slug of ["board-games-draughts", "board-games-ludo", "board-games-scrabble"]) expect(boards[slug]).toBe(2);
  });

  it("records a deciding third game at 1–1", async () => {
    const f = await freshFixture();
    await board(f, 1, "y1");
    await board(f, 2, "y3");
    await board(f, 3, "y1");
    await endMatch(f);
    expect(await fixtureRow(f)).toEqual({ status: "full_time", home_score: 4, away_score: 2, winner: 1 });
  });

  it("ends 2–0 without a third game", async () => {
    const f = await freshFixture();
    await board(f, 1, "y3");
    await board(f, 2, "y3");
    await endMatch(f);
    expect(await fixtureRow(f)).toEqual({ status: "full_time", home_score: 0, away_score: 4, winner: 3 });
  });

  it("can still end level, as a draw in the group", async () => {
    const f = await freshFixture();
    await board(f, 1, "y1");
    await board(f, 2, "draw");
    await board(f, 3, "y3");
    await endMatch(f);
    expect(await fixtureRow(f)).toEqual({ status: "full_time", home_score: 3, away_score: 3, winner: null });
  });

  it("still refuses a fourth board and a second result on a board", async () => {
    const f = await freshFixture();
    await board(f, 1, "y1");
    expect(await errorCode(board(f, 4, "y1"))).toBe("live.invalid_input");
    expect(await errorCode(board(f, 1, "y3"))).toBe("live.board_done");
    await board(f, 2, "y1");
    await endMatch(f);
  });

  it("lets the admin reopen a match ended at 1–1 and add the third game", async () => {
    // A match from before the change: two boards, ended as a draw.
    const f = await freshFixture();
    await board(f, 1, "y1");
    await board(f, 2, "y3");
    const fullTime = await endMatch(f);
    expect((await fixtureRow(f)).winner).toBeNull();

    // Admin → Fixtures: void "Full time" with a reason, then the third game and End match.
    await call("select public.void_match_event($1, $2)", [fullTime, "Game 3 to record"]);
    expect((await fixtureRow(f)).status).not.toBe("full_time");
    await board(f, 3, "y3");
    await endMatch(f);
    expect(await fixtureRow(f)).toEqual({ status: "full_time", home_score: 2, away_score: 4, winner: 3 });
  });

  it("counts every game in the table, third games included", async () => {
    const { rows } = await db.query<{ team_year: number; played: number; score_for: number }>(
      `select st.team_year, st.played, st.score_for from public.event_standings st
       where st.event_id = $1 order by st.position, st.team_year`,
      [c4.event],
    );
    const y3 = rows.find((r) => r.team_year === 3)!;
    const y1 = rows.find((r) => r.team_year === 1)!;
    // Board points (doubled) from the five matches above: Year 1 4+0+3+4+2 = 13,
    // Year 3 2+4+3+0+4 = 13. Level on games, so match points decide:
    // Year 1 won 2, drew 1, lost 2 (5 points); Year 3 the other way round (5).
    expect(y1.score_for).toBe(13);
    expect(y3.score_for).toBe(13);
    expect(y1.played).toBe(5);
  });

  it("is safe to run twice", async () => {
    await rerunMigration(db, MIGRATION);
    const { rows } = await db.query<{ boards: number }>("select boards from public.events where slug = 'board-games-connect-four'");
    expect(rows[0].boards).toBe(3);
  });
});
