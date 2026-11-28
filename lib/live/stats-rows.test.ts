import { describe, expect, expectTypeOf, it } from "vitest";
import type { Tables } from "@/lib/supabase/types";
import type { PlayerMatchStats as FantasyEngineStats } from "@/lib/fantasy/engine-types";
import { toLiveError } from "./errors";
import {
  compareAssisters,
  compareScorers,
  mapRows,
  toPlayerMatchStats,
  toPlayerTotalsRow,
  toStandingRow,
  toSuspensionRow,
} from "./stats-rows";
import type { PlayerMatchStats, PlayerTotalsRow } from "./types";

const FIXTURE = "11111111-1111-4111-8111-111111111111";
const EVENT = "22222222-2222-4222-8222-222222222222";
const MATCHDAY = "33333333-3333-4333-8333-333333333333";
const PLAYER = "44444444-4444-4444-8444-444444444444";
const TEAM = "55555555-5555-4555-8555-555555555555";

const team = { team_id: TEAM, team_name: "Year 1", team_short_name: "Y1", team_year: 1 };

function statsRow(overrides: Partial<Tables<"player_match_stats">> = {}): Tables<"player_match_stats"> {
  return {
    fixture_id: FIXTURE,
    event_id: EVENT,
    matchday_id: MATCHDAY,
    player_id: PLAYER,
    team_id: TEAM,
    position: "DEF",
    lineup_role: "bench",
    lineup_set: true,
    started: false,
    appeared: true,
    minutes_played: 30,
    goals: 1,
    assists: 2,
    own_goals: 0,
    goals_conceded_on_pitch: 3,
    saves: 4,
    own_goals_conceded_on_pitch: 1,
    yellow_cards: 1,
    red_cards: 1,
    red_from_second_yellow: true,
    penalties_missed: 1,
    penalties_saved: 0,
    man_of_the_match: false,
    walkover: false,
    fixture_finished: true,
    ...overrides,
  };
}

describe("toPlayerMatchStats", () => {
  it("maps every column", () => {
    expect(toPlayerMatchStats(statsRow())).toEqual({
      fixtureId: FIXTURE,
      eventId: EVENT,
      matchdayId: MATCHDAY,
      playerId: PLAYER,
      teamId: TEAM,
      position: "DEF",
      lineupSet: true,
      started: false,
      appeared: true,
      minutesPlayed: 30,
      goals: 1,
      assists: 2,
      ownGoals: 0,
      goalsConcededOnPitch: 3,
      ownGoalsConcededOnPitch: 1,
      yellowCards: 1,
      redCards: 1,
      redFromSecondYellow: true,
      penaltiesMissed: 1,
      penaltiesSaved: 0,
      saves: 4,
      manOfTheMatch: false,
      walkover: false,
      fixtureFinished: true,
    } satisfies PlayerMatchStats);
  });

  it("defaults nullable counts and flags to 0 and false", () => {
    const stats = toPlayerMatchStats(
      statsRow({ minutes_played: null, goals: null, appeared: null, red_from_second_yellow: null, matchday_id: null }),
    );
    expect(stats).toMatchObject({ minutesPlayed: 0, goals: 0, appeared: false, redFromSecondYellow: false, matchdayId: null });
  });

  it("skips a row without its keys", () => {
    expect(toPlayerMatchStats(statsRow({ player_id: null }))).toBeNull();
    expect(toPlayerMatchStats(statsRow({ position: null }))).toBeNull();
  });

  it("gives the fantasy engine every field it reads", () => {
    expectTypeOf<PlayerMatchStats>().toExtend<FantasyEngineStats>();
  });
});

describe("toStandingRow", () => {
  const row: Tables<"football_standings"> = {
    event_id: EVENT,
    position: 2,
    position_shared: false,
    ...team,
    played: 4,
    won: 2,
    drawn: 1,
    lost: 1,
    goals_for: 4,
    goals_against: 2,
    goal_difference: 2,
    points: 7,
    h2h_points: 3,
    live: true,
  };

  it("maps the table row with its team", () => {
    expect(toStandingRow(row)).toEqual({
      position: 2,
      positionShared: false,
      team: { id: TEAM, name: "Year 1", shortName: "Y1", year: 1 },
      played: 4,
      won: 2,
      drawn: 1,
      lost: 1,
      goalsFor: 4,
      goalsAgainst: 2,
      goalDifference: 2,
      points: 7,
      live: true,
    });
  });

  it("skips a row without a team or position", () => {
    expect(toStandingRow({ ...row, team_name: null })).toBeNull();
    expect(toStandingRow({ ...row, position: null })).toBeNull();
  });
});

describe("toSuspensionRow", () => {
  it("keeps an unknown banned fixture as null", () => {
    expect(
      toSuspensionRow({
        event_id: EVENT,
        player_id: PLAYER,
        display_name: "Ada O.",
        team_id: TEAM,
        team_short_name: "Y1",
        red_card_fixture_id: FIXTURE,
        red_card_event_id: 7,
        banned_fixture_id: null,
        banned_fixture_kickoff_at: null,
        ban_served: false,
      }),
    ).toEqual({
      playerId: PLAYER,
      name: "Ada O.",
      teamId: TEAM,
      teamShortName: "Y1",
      redCardFixtureId: FIXTURE,
      bannedFixtureId: null,
      bannedFixtureKickoffAt: null,
      banServed: false,
    });
  });
});

describe("top scorers and assisters", () => {
  function totals(name: string, goals: number, assists: number, minutesPlayed: number): PlayerTotalsRow {
    const row = toPlayerTotalsRow({
      event_id: EVENT,
      player_id: PLAYER,
      display_name: name,
      position: "FWD",
      ...team,
      appearances: 1,
      minutes_played: minutesPlayed,
      goals,
      assists,
      own_goals: 0,
      clean_sheets: 0,
      yellow_cards: 0,
      red_cards: 0,
      man_of_the_match: 0,
    });
    if (!row) throw new Error("row should map");
    return row;
  }

  const rows = [
    totals("Bayo", 2, 0, 100),
    totals("Ada", 2, 1, 150),
    totals("Chi", 3, 0, 150),
    totals("Dele", 2, 1, 100),
    totals("Eze", 0, 4, 50),
  ];

  it("orders scorers by goals, then assists, then fewer minutes, then name", () => {
    expect([...rows].sort(compareScorers).map((r) => r.name)).toEqual(["Chi", "Dele", "Ada", "Bayo", "Eze"]);
  });

  it("orders assisters by assists, then goals", () => {
    expect([...rows].sort(compareAssisters).map((r) => r.name)).toEqual(["Eze", "Dele", "Ada", "Chi", "Bayo"]);
  });
});

describe("mapRows", () => {
  it("drops rows that don't map and handles null", () => {
    expect(mapRows([1, 2, 3], (x) => (x === 2 ? null : x * 10))).toEqual([10, 30]);
    expect(mapRows(null, (x: number) => x)).toEqual([]);
  });
});

describe("phase 2 error codes", () => {
  it.each(["player_banned", "league_not_finished", "standings_tied"])("passes %s through from the database", (code) => {
    expect(toLiveError({ code: "P0001", hint: `live.${code}`, message: "Message for the admin." })).toEqual({
      code,
      message: "Message for the admin.",
      retryable: false,
    });
  });
});
