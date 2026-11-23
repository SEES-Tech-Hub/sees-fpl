import { describe, expect, it } from "vitest";
import type { Tables } from "@/lib/supabase/types";
import {
  compareRaceResults,
  formatRaceTime,
  toEventStandingRow,
  toMedalRow,
  toMedalTableRow,
  toRaceResultRow,
  toSetScore,
} from "./results-rows";
import type { RaceResultRow } from "./types";

const FIXTURE = "11111111-1111-4111-8111-111111111111";
const EVENT = "22222222-2222-4222-8222-222222222222";
const TEAM = "55555555-5555-4555-8555-555555555555";
const team = { team_id: TEAM, team_name: "Year 1", team_short_name: "Y1", team_year: 1 };
const teamSummary = { id: TEAM, name: "Year 1", shortName: "Y1", year: 1 };

describe("toSetScore", () => {
  it("maps a finished set and the set in play", () => {
    expect(
      toSetScore({ fixture_id: FIXTURE, set_number: 1, home_points: 25, away_points: 23, complete: true, winner_team_id: TEAM }),
    ).toEqual({ setNumber: 1, homePoints: 25, awayPoints: 23, complete: true, winnerTeamId: TEAM });
    expect(
      toSetScore({ fixture_id: FIXTURE, set_number: 2, home_points: null, away_points: 4, complete: false, winner_team_id: null }),
    ).toEqual({ setNumber: 2, homePoints: 0, awayPoints: 4, complete: false, winnerTeamId: null });
  });
});

describe("toEventStandingRow", () => {
  const row: Tables<"event_standings"> = {
    event_id: EVENT,
    position: 2,
    position_shared: true,
    ...team,
    played: 2,
    won: 1,
    drawn: 0,
    lost: 1,
    score_for: 94,
    score_against: 93,
    score_difference: 1,
    sets_for: 2,
    sets_against: 2,
    points: 3,
    h2h_points: 0,
    live: false,
  };

  it("maps a group-table row", () => {
    expect(toEventStandingRow(row)).toEqual({
      position: 2,
      positionShared: true,
      team: teamSummary,
      played: 2,
      won: 1,
      drawn: 0,
      lost: 1,
      scoreFor: 94,
      scoreAgainst: 93,
      scoreDifference: 1,
      setsFor: 2,
      setsAgainst: 2,
      points: 3,
      live: false,
    });
  });

  it("skips a row without a team", () => {
    expect(toEventStandingRow({ ...row, team_id: null })).toBeNull();
  });
});

describe("race results", () => {
  function raceRow(overrides: Partial<Tables<"race_results">>): Tables<"race_results"> {
    return {
      id: 1,
      fixture_id: FIXTURE,
      event_id: EVENT,
      stage: "final",
      race_status: "full_time",
      ...team,
      player_id: null,
      athlete_name: "Ada",
      lane: 3,
      outcome: "finished",
      position: 1,
      time_ms: 11850,
      mark_mm: null,
      note: null,
      medal: "gold",
      ...overrides,
    };
  }

  it("maps a result with its medal", () => {
    expect(toRaceResultRow(raceRow({}))).toMatchObject({
      entryId: 1,
      stage: "final",
      athleteName: "Ada",
      outcome: "finished",
      position: 1,
      timeMs: 11850,
      medal: "gold",
    });
    expect(toRaceResultRow(raceRow({ medal: "platinum" }))?.medal).toBeNull();
  });

  it("orders finishers by place, then DNF, DQ, DNS, then entrants without results", () => {
    const rows = [
      raceRow({ id: 1, athlete_name: "Dns", outcome: "dns", position: null }),
      raceRow({ id: 2, athlete_name: "Second", position: 2, time_ms: 12000 }),
      raceRow({ id: 3, athlete_name: "Waiting", outcome: null, position: null, lane: 1 }),
      raceRow({ id: 4, athlete_name: "Dq", outcome: "dq", position: null }),
      raceRow({ id: 5, athlete_name: "First", position: 1 }),
      raceRow({ id: 6, athlete_name: "Dnf", outcome: "dnf", position: null }),
    ]
      .map(toRaceResultRow)
      .filter((row): row is RaceResultRow => row !== null);
    expect(rows.sort(compareRaceResults).map((r) => r.athleteName)).toEqual([
      "First",
      "Second",
      "Dnf",
      "Dq",
      "Dns",
      "Waiting",
    ]);
  });

  it("formats times", () => {
    expect(formatRaceTime(12410)).toBe("12.41 s");
    expect(formatRaceTime(245_300)).toBe("4:05.30");
    expect(formatRaceTime(59_999)).toBe("1:00.00");
  });
});

describe("medals", () => {
  it("maps a medal and skips an unknown one", () => {
    const row: Tables<"event_medals"> = {
      event_id: EVENT,
      fixture_id: FIXTURE,
      medal: "bronze",
      place: 3,
      team_id: TEAM,
      athlete_name: null,
    };
    expect(toMedalRow(row)).toEqual({
      eventId: EVENT,
      fixtureId: FIXTURE,
      medal: "bronze",
      place: 3,
      teamId: TEAM,
      athleteName: null,
    });
    expect(toMedalRow({ ...row, medal: "tin" })).toBeNull();
  });

  it("maps a medal-table row", () => {
    expect(
      toMedalTableRow({
        position: 1,
        ...team,
        gold: 2,
        silver: 0,
        bronze: 1,
        total: 3,
        points: 7,
        rank_by: "points",
      }),
    ).toEqual({ position: 1, team: teamSummary, gold: 2, silver: 0, bronze: 1, total: 3, points: 7, rankBy: "points" });
  });
});
