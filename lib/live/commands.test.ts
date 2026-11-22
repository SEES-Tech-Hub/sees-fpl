import { describe, expect, it } from "vitest";
import {
  parseRecordEventInput,
  parseSetLineupInput,
  parseUndoEventInput,
  toRecordEventArgs,
} from "./commands";
import type { RecordEventInput } from "./types";

const FIXTURE = "6f1c2a4e-8a1b-4c3d-9e5f-0a1b2c3d4e5f";
const EVENT = "0b7e9c1d-2f3a-4b5c-8d6e-7f8091a2b3c4";
const TEAM = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const P1 = "11111111-2222-4333-8444-555555555555";
const P2 = "66666666-7777-4888-9999-aaaaaaaaaaaa";

const base = { fixtureId: FIXTURE, clientEventId: EVENT };

function parse(input: unknown) {
  return parseRecordEventInput(input);
}

describe("parseRecordEventInput", () => {
  it("accepts a well-formed goal", () => {
    const result = parse({ ...base, type: "goal", teamId: TEAM, scorerId: P1, assistId: P2 });
    expect(result).toEqual({
      ok: true,
      data: { ...base, type: "goal", teamId: TEAM, scorerId: P1, assistId: P2, penalty: undefined, ownGoal: undefined, points: undefined },
    });
  });

  it("rejects anything that isn't an object", () => {
    for (const input of [null, undefined, "goal", 42, []]) {
      const result = parse(input);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("invalid_input");
    }
  });

  it("rejects bad IDs, types and times", () => {
    expect(parse({ ...base, fixtureId: "1", type: "full_time" }).ok).toBe(false);
    expect(parse({ ...base, clientEventId: "not-a-uuid", type: "full_time" }).ok).toBe(false);
    expect(parse({ ...base, type: "dance" }).ok).toBe(false);
    expect(parse({ ...base, type: "full_time", occurredAt: "yesterday-ish" }).ok).toBe(false);
    expect(parse({ ...base, type: "full_time", occurredAt: "2026-11-28T13:05:00Z" }).ok).toBe(true);
  });

  it("checks the fields each event type needs", () => {
    expect(parse({ ...base, type: "period_start" }).ok).toBe(false);
    expect(parse({ ...base, type: "period_start", period: "third_half" }).ok).toBe(false);
    expect(parse({ ...base, type: "period_start", period: "first_half" }).ok).toBe(true);
    expect(parse({ ...base, type: "goal" }).ok).toBe(false);
    expect(parse({ ...base, type: "goal", teamId: TEAM, points: 4 }).ok).toBe(false);
    expect(parse({ ...base, type: "card", teamId: TEAM, playerId: P1, colour: "green" }).ok).toBe(false);
    expect(parse({ ...base, type: "substitution", teamId: TEAM, playerOffId: P1, playerOnId: P1 }).ok).toBe(false);
    expect(parse({ ...base, type: "shootout_kick", teamId: TEAM }).ok).toBe(false);
    expect(parse({ ...base, type: "man_of_the_match" }).ok).toBe(false);
    expect(parse({ ...base, type: "walkover", teamId: TEAM, points: 2.5 }).ok).toBe(false);
  });

  it("rejects impossible goals", () => {
    expect(parse({ ...base, type: "goal", teamId: TEAM, scorerId: P1, assistId: P1 }).ok).toBe(false);
    expect(parse({ ...base, type: "goal", teamId: TEAM, scorerId: P1, assistId: P2, ownGoal: true }).ok).toBe(false);
    expect(parse({ ...base, type: "goal", teamId: TEAM, scorerId: P1, penalty: true, ownGoal: true }).ok).toBe(false);
  });
});

describe("toRecordEventArgs", () => {
  it("maps a goal to player_id (scorer) and other_player_id (assister)", () => {
    const input: RecordEventInput = { ...base, type: "goal", teamId: TEAM, scorerId: P1, assistId: P2, penalty: true };
    expect(toRecordEventArgs(input)).toEqual({
      p_fixture_id: FIXTURE,
      p_client_event_id: EVENT,
      p_type: "goal",
      p_team_id: TEAM,
      p_player_id: P1,
      p_other_player_id: P2,
      p_is_penalty: true,
    });
  });

  it("maps a substitution to player off and player on", () => {
    const args = toRecordEventArgs({ ...base, type: "substitution", teamId: TEAM, playerOffId: P1, playerOnId: P2 });
    expect(args.p_player_id).toBe(P1);
    expect(args.p_other_player_id).toBe(P2);
  });

  it("maps a saved penalty to the taker and the goalkeeper", () => {
    const args = toRecordEventArgs({ ...base, type: "penalty_miss", teamId: TEAM, takerId: P1, savedById: P2 });
    expect(args).toMatchObject({ p_player_id: P1, p_other_player_id: P2 });
  });

  it("leaves out fields that aren't needed, so the database uses its defaults", () => {
    expect(toRecordEventArgs({ ...base, type: "full_time" })).toEqual({
      p_fixture_id: FIXTURE,
      p_client_event_id: EVENT,
      p_type: "full_time",
    });
    const args = toRecordEventArgs({ ...base, type: "goal", teamId: TEAM, scorerId: null });
    expect(args).not.toHaveProperty("p_player_id");
    expect(args).not.toHaveProperty("p_points");
  });

  it("passes the tap time through", () => {
    const args = toRecordEventArgs({ ...base, type: "period_end", occurredAt: "2026-11-28T13:25:40Z" });
    expect(args.p_occurred_at).toBe("2026-11-28T13:25:40Z");
  });
});

describe("other parsers", () => {
  it("undo needs a UUID and a short reason", () => {
    expect(parseUndoEventInput({ clientEventId: EVENT }).ok).toBe(true);
    expect(parseUndoEventInput({ clientEventId: EVENT, reason: "x".repeat(501) }).ok).toBe(false);
    expect(parseUndoEventInput({ clientEventId: 7 }).ok).toBe(false);
  });

  it("a lineup needs 1 to 11 starters, all UUIDs", () => {
    expect(parseSetLineupInput({ fixtureId: FIXTURE, teamId: TEAM, starters: [P1], bench: [P2] }).ok).toBe(true);
    expect(parseSetLineupInput({ fixtureId: FIXTURE, teamId: TEAM, starters: [], bench: [] }).ok).toBe(false);
    expect(parseSetLineupInput({ fixtureId: FIXTURE, teamId: TEAM, starters: Array(12).fill(P1), bench: [] }).ok).toBe(false);
    expect(parseSetLineupInput({ fixtureId: FIXTURE, teamId: TEAM, starters: ["nope"], bench: [] }).ok).toBe(false);
  });
});
