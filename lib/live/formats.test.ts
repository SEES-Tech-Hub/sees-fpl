import { describe, expect, it } from "vitest";
import { getClockState, matchMinute } from "./clock";
import {
  parseRecordEventInput,
  parseRecordRaceResultsInput,
  parseSetRaceEntriesInput,
  toRaceEntriesJson,
  toRaceResultsJson,
  toRecordEventArgs,
} from "./commands";
import type { RecordEventInput } from "./types";

// Phase 3 requests: points and sets, head-to-head results, races, and the
// basketball clock.

const FIXTURE = "6f1c2a4e-8a1b-4c3d-9e5f-0a1b2c3d4e5f";
const EVENT = "0b7e9c1d-2f3a-4b5c-8d6e-7f8091a2b3c4";
const TEAM = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const P1 = "11111111-2222-4333-8444-555555555555";
const base = { fixtureId: FIXTURE, clientEventId: EVENT };

function args(input: RecordEventInput) {
  return toRecordEventArgs(input);
}

describe("points and sets", () => {
  it("accepts a point, with or without a player and a count", () => {
    expect(parseRecordEventInput({ ...base, type: "point", teamId: TEAM })).toMatchObject({
      ok: true,
      data: { type: "point", teamId: TEAM },
    });
    expect(parseRecordEventInput({ ...base, type: "point", teamId: TEAM, playerId: P1, points: 25 }).ok).toBe(true);
  });

  it("rejects a point without a team or with a bad count", () => {
    expect(parseRecordEventInput({ ...base, type: "point" }).ok).toBe(false);
    for (const points of [0, 100, 1.5, "2"]) {
      expect(parseRecordEventInput({ ...base, type: "point", teamId: TEAM, points }).ok).toBe(false);
    }
  });

  it("maps a point and set_end to the database call", () => {
    expect(args({ ...base, type: "point", teamId: TEAM, playerId: P1, points: 3 })).toEqual({
      p_fixture_id: FIXTURE,
      p_client_event_id: EVENT,
      p_type: "point",
      p_team_id: TEAM,
      p_player_id: P1,
      p_points: 3,
    });
    expect(args({ ...base, type: "set_end" })).toEqual({ p_fixture_id: FIXTURE, p_client_event_id: EVENT, p_type: "set_end" });
  });

  it("sends full time's winner as the team (head-to-head, retirements)", () => {
    const parsed = parseRecordEventInput({ ...base, type: "full_time", winnerTeamId: TEAM });
    expect(parsed).toEqual({ ok: true, data: { ...base, type: "full_time", winnerTeamId: TEAM } });
    if (parsed.ok) expect(args(parsed.data).p_team_id).toBe(TEAM);
    expect(args({ ...base, type: "full_time" }).p_team_id).toBeUndefined();
    expect(parseRecordEventInput({ ...base, type: "full_time", winnerTeamId: "x" }).ok).toBe(false);
  });
});

describe("race entrants", () => {
  it("accepts named athletes and relay teams, and builds the JSON", () => {
    const parsed = parseSetRaceEntriesInput({
      fixtureId: FIXTURE,
      entries: [{ teamId: TEAM, athleteName: "  Ada  ", lane: 3 }, { teamId: TEAM }],
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(toRaceEntriesJson(parsed.data.entries)).toEqual([
        { teamId: TEAM, athleteName: "Ada", lane: 3 },
        { teamId: TEAM },
      ]);
    }
  });

  it("rejects empty lists, bad lanes and an athlete given twice over", () => {
    expect(parseSetRaceEntriesInput({ fixtureId: FIXTURE, entries: [] }).ok).toBe(false);
    expect(parseSetRaceEntriesInput({ fixtureId: FIXTURE, entries: [{ teamId: TEAM, lane: 21 }] }).ok).toBe(false);
    expect(
      parseSetRaceEntriesInput({ fixtureId: FIXTURE, entries: [{ teamId: TEAM, athleteName: "Ada", playerId: P1 }] }).ok,
    ).toBe(false);
    expect(parseSetRaceEntriesInput({ fixtureId: FIXTURE, entries: [{ athleteName: "Ada" }] }).ok).toBe(false);
  });
});

describe("race results", () => {
  it("accepts finishers with places and others without", () => {
    const parsed = parseRecordRaceResultsInput({
      fixtureId: FIXTURE,
      publish: true,
      results: [
        { teamId: TEAM, athleteName: "Ada", outcome: "finished", position: 1, timeMs: 11850 },
        { teamId: TEAM, athleteName: "Bayo", outcome: "dq", note: " False start " },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.publish).toBe(true);
      expect(toRaceResultsJson(parsed.data.results)).toEqual([
        { teamId: TEAM, athleteName: "Ada", outcome: "finished", position: 1, timeMs: 11850 },
        { teamId: TEAM, athleteName: "Bayo", outcome: "dq", note: "False start" },
      ]);
    }
  });

  it("rejects a finisher without a place, a place for a DNF and unknown outcomes", () => {
    const result = (r: Record<string, unknown>) =>
      parseRecordRaceResultsInput({ fixtureId: FIXTURE, results: [{ teamId: TEAM, ...r }] }).ok;
    expect(result({ outcome: "finished" })).toBe(false);
    expect(result({ outcome: "dnf", position: 3 })).toBe(false);
    expect(result({ outcome: "won", position: 1 })).toBe(false);
    expect(result({ outcome: "finished", position: 1, timeMs: -5 })).toBe(false);
    expect(result({ outcome: "dns" })).toBe(true);
  });
});

describe("basketball clock", () => {
  const start = "2026-11-30T10:00:00Z";

  it("counts quarters from 0, 10, 20, 30 and overtime from 40", () => {
    const at = "2026-11-30T10:04:30Z";
    const minute = (period: "first_quarter" | "third_quarter" | "fourth_quarter" | "overtime") =>
      matchMinute({ period, periodStartedAt: start, at, periodMinutes: 10, extraPeriodMinutes: 3 });
    expect(minute("first_quarter")).toEqual({ minute: 5, addedMinutes: 0 });
    expect(minute("third_quarter")).toEqual({ minute: 25, addedMinutes: 0 });
    expect(minute("fourth_quarter")).toEqual({ minute: 35, addedMinutes: 0 });
    // Overtime is 3 minutes long: 4:30 in is 43+2.
    expect(minute("overtime")).toEqual({ minute: 43, addedMinutes: 2 });
  });

  it("labels the breaks between quarters", () => {
    const fixture = (currentPeriod: "first_quarter" | "second_quarter" | "overtime") => ({
      status: "half_time" as const,
      currentPeriod,
      periodStartedAt: null,
      periodMinutes: 10,
      extraPeriodMinutes: 3,
    });
    expect(getClockState(fixture("first_quarter")).label).toBe("End of Q1");
    expect(getClockState(fixture("second_quarter")).label).toBe("HT");
    expect(getClockState(fixture("overtime")).label).toBe("End of OT");
  });
});
