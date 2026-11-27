// Database tests for live reactions (supabase/migrations/*_live_reactions.sql):
// every limit add_reactions() enforces, the totals, and who may touch the
// tables. Runs on PGlite with all migrations applied (supabase/tests/db.ts).
import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asUser, createTestDb, errorCode, rerunMigration } from "./db";

const MIGRATION = readdirSync(join(fileURLToPath(new URL(".", import.meta.url)), "..", "migrations")).find((f) =>
  f.endsWith("_live_reactions.sql"),
)!;

type Counts = Record<string, unknown>;
type Fixture = { id: string; home: string; away: string };

let db: PGlite;
let football: { event: string; home: string; away: string };

beforeAll(async () => {
  db = await createTestDb();
  // Tests set match times freely; the console's kick-off window doesn't apply.
  await db.exec("alter table public.match_events disable trigger match_events_kickoff_window");
  const { rows } = await db.query<{ event: string; home: string; away: string }>(`
    select e.id as event,
      (select id from public.teams where year = 1) as home,
      (select id from public.teams where year = 2) as away
    from public.events e join public.sports s on s.id = e.sport_id
    where s.slug = 'football' order by e.name limit 1`);
  football = rows[0];
}, 60_000);

afterAll(async () => {
  await db?.close();
});

/** A new scheduled football match between Year 1 and Year 2, for one test. */
async function freshFixture(): Promise<Fixture> {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.fixtures (event_id, stage, home_team_id, away_team_id, kickoff_at)
     values ($1, 'league', $2, $3, now()) returning id`,
    [football.event, football.home, football.away],
  );
  return { id: rows[0].id, home: football.home, away: football.away };
}

async function event(fixtureId: string, type: string, period: string | null, minutesAgo: number) {
  await db.query(
    `insert into public.match_events (fixture_id, client_event_id, type, period, occurred_at, recorded_at)
     values ($1, gen_random_uuid(), $2::public.match_event_type, $3::public.match_period,
             now() - make_interval(mins => $4), now() - make_interval(mins => $4))`,
    [fixtureId, type, period, minutesAgo],
  );
}

/** Kicks the match off (live). */
async function kickOff(f: Fixture, minutesAgo = 5) {
  await event(f.id, "period_start", "first_half", minutesAgo);
}

/** Kicks off and blows the final whistle `minutesAgo` minutes ago (full time). */
async function fullTime(f: Fixture, minutesAgo: number) {
  await event(f.id, "period_start", "first_half", minutesAgo + 60);
  await event(f.id, "full_time", null, minutesAgo);
}

async function status(f: Fixture) {
  const { rows } = await db.query<{ status: string }>("select status from public.fixtures where id = $1", [f.id]);
  return rows[0].status;
}

/** A visitor's add_reactions call; resolves to what was added. */
function send(f: Fixture, session: string, counts: Counts | null) {
  return asAnon(db, async (tx) => {
    const { rows } = await tx.query<{ added: Record<string, number> }>(
      "select public.add_reactions($1, $2, $3::jsonb) as added",
      [f.id, session, counts === null ? null : JSON.stringify(counts)],
    );
    return rows[0].added;
  });
}

/** Moves a phone's last send back, as if 5 seconds had passed. */
async function later(f: Fixture, session: string) {
  await db.query(
    "update public.reaction_senders set last_at = last_at - interval '5 seconds' where fixture_id = $1 and session_id = $2",
    [f.id, session],
  );
}

async function totals(f: Fixture) {
  return asAnon(db, async (tx) => {
    const { rows } = await tx.query<{ kind: string; total: number }>("select kind, total::int as total from public.match_reaction_totals($1)", [f.id]);
    return Object.fromEntries(rows.map((r) => [r.kind, r.total]));
  });
}

const ZERO = { fire: 0, shock: 0, clap: 0, laugh: 0, heartbreak: 0, cheer_home: 0, cheer_away: 0 };

describe("the window", () => {
  it("is closed before kick-off", async () => {
    const f = await freshFixture();
    expect(await status(f)).toBe("scheduled");
    expect(await errorCode(send(f, randomUUID(), { fire: 1 }))).toBe("live.reactions_closed");
  });

  it("is open while the match is live and at half time", async () => {
    const f = await freshFixture();
    await kickOff(f, 30);
    expect(await status(f)).toBe("live");
    const phone = randomUUID();
    expect(await send(f, phone, { fire: 1 })).toEqual({ fire: 1 });

    await event(f.id, "period_end", "first_half", 1);
    expect(await status(f)).toBe("half_time");
    await later(f, phone);
    expect(await send(f, phone, { clap: 2 })).toEqual({ clap: 2 });
  });

  it("stays open for 15 minutes after full time, then closes", async () => {
    const recent = await freshFixture();
    await fullTime(recent, 14);
    expect(await status(recent)).toBe("full_time");
    expect(await send(recent, randomUUID(), { clap: 3 })).toEqual({ clap: 3 });

    const old = await freshFixture();
    await fullTime(old, 16);
    expect(await status(old)).toBe("full_time");
    expect(await errorCode(send(old, randomUUID(), { clap: 3 }))).toBe("live.reactions_closed");
  });

  it("counts from the latest active event, so a late correction reopens it and voiding it closes it again", async () => {
    const f = await freshFixture();
    await fullTime(f, 20);
    expect(await errorCode(send(f, randomUUID(), { fire: 1 }))).toBe("live.reactions_closed");

    // An official adds a goal they missed: it happened in the first half but
    // was recorded a minute ago, so the 15 minutes run from now.
    await db.query(
      `insert into public.match_events (fixture_id, client_event_id, type, period, team_id, side, points, occurred_at, recorded_at)
       values ($1, gen_random_uuid(), 'goal', 'first_half', $2, 'home', 1, now() - interval '70 minutes', now() - interval '1 minute')`,
      [f.id, f.home],
    );
    expect(await send(f, randomUUID(), { fire: 1 })).toEqual({ fire: 1 });

    // Voided: it no longer counts as the match's last moment.
    await db.query("alter table public.match_events disable trigger match_events_append_only");
    await db.query("update public.match_events set voided_at = now() where fixture_id = $1 and type = 'goal'", [f.id]);
    await db.query("alter table public.match_events enable trigger match_events_append_only");
    expect(await errorCode(send(f, randomUUID(), { fire: 1 }))).toBe("live.reactions_closed");
  });

  it("is closed for a match that doesn't exist", async () => {
    expect(await errorCode(send({ id: randomUUID(), home: "", away: "" }, randomUUID(), { fire: 1 }))).toBe(
      "live.reactions_closed",
    );
  });
});

describe("the counts in one send", () => {
  it("takes up to 20 of one kind and 30 in all", async () => {
    const f = await freshFixture();
    await kickOff(f);
    const phone = randomUUID();
    expect(await send(f, phone, { fire: 20, clap: 10 })).toEqual({ fire: 20, clap: 10 });
  });

  it("refuses 21 of one kind", async () => {
    const f = await freshFixture();
    await kickOff(f);
    expect(await errorCode(send(f, randomUUID(), { fire: 21 }))).toBe("live.invalid_input");
  });

  it("refuses 31 in all", async () => {
    const f = await freshFixture();
    await kickOff(f);
    expect(await errorCode(send(f, randomUUID(), { fire: 20, clap: 11 }))).toBe("live.invalid_input");
  });

  it("refuses unknown kinds and anything that isn't a whole number from 1 to 20", async () => {
    const f = await freshFixture();
    await kickOff(f);
    const bad: (Counts | null)[] = [
      { thumbs_up: 1 },
      { fire: 0 },
      { fire: -1 },
      { fire: 1.5 },
      { fire: "3" },
      { fire: null },
      { fire: 1e9 },
      {},
      null,
    ];
    for (const counts of bad) {
      expect(await errorCode(send(f, randomUUID(), counts)), JSON.stringify(counts)).toBe("live.invalid_input");
    }
    expect(await errorCode(asAnon(db, (tx) => tx.query("select public.add_reactions($1, $2, '[1]'::jsonb)", [f.id, randomUUID()])))).toBe(
      "live.invalid_input",
    );
    expect(await totals(f)).toEqual(ZERO);
  });
});

describe("each phone's limits", () => {
  it("refuses a second send within 4 seconds, and takes it after", async () => {
    const f = await freshFixture();
    await kickOff(f);
    const phone = randomUUID();
    await send(f, phone, { fire: 2 });
    expect(await errorCode(send(f, phone, { fire: 2 }))).toBe("live.reactions_too_fast");
    await later(f, phone);
    expect(await send(f, phone, { fire: 2 })).toEqual({ fire: 2 });
    expect((await totals(f)).fire).toBe(4);
  });

  it("draws the line at exactly 4 seconds", async () => {
    const f = await freshFixture();
    await kickOff(f);
    const phone = randomUUID();
    await send(f, phone, { fire: 1 });
    const back = (seconds: number) =>
      db.query("update public.reaction_senders set last_at = now() - make_interval(secs => $3) where fixture_id = $1 and session_id = $2", [
        f.id,
        phone,
        seconds,
      ]);
    await back(3.5);
    expect(await errorCode(send(f, phone, { fire: 1 }))).toBe("live.reactions_too_fast");
    await back(4.1);
    expect(await send(f, phone, { fire: 1 })).toEqual({ fire: 1 });
  });

  it("lets other phones send at the same time", async () => {
    const f = await freshFixture();
    await kickOff(f);
    for (let i = 0; i < 5; i++) await send(f, randomUUID(), { laugh: 1 });
    expect((await totals(f)).laugh).toBe(5);
  });

  it("refuses a send that would take a phone past 1,000 for the match", async () => {
    const f = await freshFixture();
    await kickOff(f);
    const phone = randomUUID();
    await send(f, phone, { fire: 1 });
    await db.query("update public.reaction_senders set sent = 990 where fixture_id = $1 and session_id = $2", [f.id, phone]);
    await later(f, phone);
    expect(await errorCode(send(f, phone, { fire: 11 }))).toBe("live.reactions_limit");
    expect(await send(f, phone, { fire: 10 })).toEqual({ fire: 10 });
    const { rows } = await db.query<{ sent: number }>("select sent from public.reaction_senders where fixture_id = $1 and session_id = $2", [f.id, phone]);
    expect(rows[0].sent).toBe(1000);
    await later(f, phone);
    expect(await errorCode(send(f, phone, { fire: 1 }))).toBe("live.reactions_limit");
  });

  it("counts limits per match: a phone can react in two matches", async () => {
    const a = await freshFixture();
    const b = await freshFixture();
    await kickOff(a);
    await kickOff(b);
    const phone = randomUUID();
    await send(a, phone, { fire: 1 });
    expect(await send(b, phone, { fire: 1 })).toEqual({ fire: 1 });
  });
});

describe("cheering", () => {
  it("sets the phone's side on its first cheer and drops later cheers for the other side", async () => {
    const f = await freshFixture();
    await kickOff(f);
    const phone = randomUUID();
    expect(await send(f, phone, { cheer_home: 3 })).toEqual({ cheer_home: 3 });
    await later(f, phone);
    // Cheers for the other side are dropped; the rest of the call still counts.
    expect(await send(f, phone, { cheer_away: 5, fire: 2 })).toEqual({ fire: 2 });
    await later(f, phone);
    expect(await send(f, phone, { cheer_home: 4 })).toEqual({ cheer_home: 4 });

    const t = await totals(f);
    expect(t.cheer_home).toBe(7);
    expect(t.cheer_away).toBe(0);
    expect(t.fire).toBe(2);
    const { rows } = await db.query<{ cheer_side: string; sent: number }>(
      "select cheer_side, sent from public.reaction_senders where fixture_id = $1 and session_id = $2",
      [f.id, phone],
    );
    expect(rows[0]).toEqual({ cheer_side: "home", sent: 9 });
  });

  it("keeps the phone's side through sends without cheers", async () => {
    const f = await freshFixture();
    await kickOff(f);
    const phone = randomUUID();
    await send(f, phone, { cheer_home: 1 });
    await later(f, phone);
    await send(f, phone, { fire: 1 });
    await later(f, phone);
    expect(await send(f, phone, { cheer_away: 2, clap: 1 })).toEqual({ clap: 1 });
    expect((await totals(f)).cheer_away).toBe(0);
  });

  it("takes a send with only the other side's cheers as an empty call", async () => {
    const f = await freshFixture();
    await kickOff(f);
    const phone = randomUUID();
    await send(f, phone, { cheer_away: 1 });
    await later(f, phone);
    expect(await send(f, phone, { cheer_home: 6 })).toEqual({});
    expect((await totals(f)).cheer_home).toBe(0);
    // It still counts as this phone's send for the 4-second rule.
    expect(await errorCode(send(f, phone, { fire: 1 }))).toBe("live.reactions_too_fast");
  });

  it("lets different phones cheer for different sides", async () => {
    const f = await freshFixture();
    await kickOff(f);
    await send(f, randomUUID(), { cheer_home: 2 });
    await send(f, randomUUID(), { cheer_away: 5 });
    const t = await totals(f);
    expect([t.cheer_home, t.cheer_away]).toEqual([2, 5]);
  });

  it("refuses cheers for both sides in one send", async () => {
    const f = await freshFixture();
    await kickOff(f);
    expect(await errorCode(send(f, randomUUID(), { cheer_home: 1, cheer_away: 1 }))).toBe("live.invalid_input");
  });
});

describe("totals", () => {
  it("come back as one row per kind, 0 for kinds nobody tapped", async () => {
    const f = await freshFixture();
    expect(await totals(f)).toEqual(ZERO);
  });

  it("add up across shards", async () => {
    const f = await freshFixture();
    await kickOff(f);
    let expected = 0;
    for (let i = 0; i < 40; i++) {
      const n = (i % 7) + 1;
      expected += n;
      await send(f, randomUUID(), { shock: n });
    }
    expect((await totals(f)).shock).toBe(expected);
    const { rows } = await db.query<{ shards: number; total: number }>(
      "select count(*)::int as shards, sum(count)::int as total from public.match_reactions where fixture_id = $1 and kind = 'shock'",
      [f.id],
    );
    expect(rows[0].total).toBe(expected);
    expect(rows[0].shards).toBeGreaterThan(1);
    expect(rows[0].shards).toBeLessThanOrEqual(8);
  });
});

describe("who may touch the tables", () => {
  it("lets anyone read the totals table", async () => {
    const f = await freshFixture();
    await kickOff(f);
    await send(f, randomUUID(), { fire: 1 });
    const rows = await asAnon(db, (tx) => tx.query("select * from public.match_reactions where fixture_id = $1", [f.id]));
    expect(rows.rows.length).toBe(1);
  });

  it("refuses direct inserts and updates, signed in or not", async () => {
    const f = await freshFixture();
    await kickOff(f);
    await send(f, randomUUID(), { fire: 1 });
    const user = randomUUID();
    const attempts = [
      (tx: Parameters<Parameters<typeof asAnon>[1]>[0]) =>
        tx.query("insert into public.match_reactions (fixture_id, kind, shard, count) values ($1, 'fire', 0, 500)", [f.id]),
      (tx: Parameters<Parameters<typeof asAnon>[1]>[0]) => tx.query("update public.match_reactions set count = 500 where fixture_id = $1", [f.id]),
      (tx: Parameters<Parameters<typeof asAnon>[1]>[0]) => tx.query("delete from public.match_reactions where fixture_id = $1", [f.id]),
      (tx: Parameters<Parameters<typeof asAnon>[1]>[0]) =>
        tx.query("insert into public.reaction_senders (session_id, fixture_id) values ($1, $2)", [randomUUID(), f.id]),
      (tx: Parameters<Parameters<typeof asAnon>[1]>[0]) => tx.query("update public.reaction_senders set sent = 0"),
      (tx: Parameters<Parameters<typeof asAnon>[1]>[0]) => tx.query("select * from public.reaction_senders"),
    ];
    for (const attempt of attempts) {
      expect(await errorCode(asAnon(db, attempt))).toMatch(/permission denied|row-level security/);
      expect(await errorCode(asUser(db, user, attempt))).toMatch(/permission denied|row-level security/);
    }
    expect((await totals(f)).fire).toBe(1);
  });
});

describe("the migration", () => {
  it("is safe to run twice and keeps the totals", async () => {
    const f = await freshFixture();
    await kickOff(f);
    await send(f, randomUUID(), { heartbreak: 4 });
    await rerunMigration(db, MIGRATION);
    expect((await totals(f)).heartbreak).toBe(4);
    expect(await send(f, randomUUID(), { heartbreak: 1 })).toEqual({ heartbreak: 1 });
  });
});
