import { describe, expect, it } from "vitest";
import type {
  FantasyPlayer,
  FantasyRules,
  PickInput,
  PlayerMatchStats,
} from "./engine-types";
import {
  calculateManagerMatchdayScore,
  calculatePlayerPoints,
} from "./scoring";
import { calculateTransferCost, nextMatchdayFreeTransfers } from "./transfers";
import { validateLineupAndCaptains, validateSquad } from "./validation";

const defaultRules: FantasyRules = {
  id: 1,
  squad_size: 15,
  budget_tenths: 1000,
  max_per_team: 4,
  gk_quota: 2,
  def_quota: 5,
  mid_quota: 5,
  fwd_quota: 3,
  starting_size: 11,
  min_start_gk: 1,
  max_start_gk: 1,
  min_start_def: 3,
  max_start_def: 5,
  min_start_mid: 2,
  max_start_mid: 5,
  min_start_fwd: 1,
  max_start_fwd: 3,
  free_transfers_per_md: 1,
  max_saved_transfers: 2,
  extra_transfer_cost: 4,
  unlimited_transfer_matchdays: [1, 6],
  captain_multiplier: 2,
  min_minutes_threshold: 30,
  pts_appearance: 1,
  pts_30_mins: 1,
  pts_goal_gk: 6,
  pts_goal_def: 6,
  pts_goal_mid: 5,
  pts_goal_fwd: 4,
  pts_assist: 3,
  pts_clean_sheet_gk: 4,
  pts_clean_sheet_def: 4,
  pts_clean_sheet_mid: 1,
  pts_clean_sheet_fwd: 0,
  pts_goals_conceded_step: 2,
  pts_goals_conceded_gk: -1,
  pts_goals_conceded_def: -1,
  pts_goals_conceded_mid: 0,
  pts_goals_conceded_fwd: 0,
  pts_penalty_save: 5,
  pts_penalty_miss: -2,
  pts_yellow_card: -1,
  pts_red_card: -3,
  pts_own_goal: -2,
  pts_motm: 3,
};

function makeStats(
  playerId: string,
  overrides: Partial<PlayerMatchStats> = {},
): PlayerMatchStats {
  const minutesPlayed = overrides.minutesPlayed ?? 50;
  return {
    playerId,
    fixtureId: "f1",
    appeared: overrides.appeared ?? minutesPlayed > 0,
    minutesPlayed,
    goals: 0,
    assists: 0,
    ownGoals: 0,
    goalsConcededOnPitch: 0,
    yellowCards: 0,
    redCards: 0,
    penaltiesMissed: 0,
    penaltiesSaved: 0,
    manOfTheMatch: false,
    walkover: false,
    fixtureFinished: true,
    ...overrides,
  };
}

function makeSquad(): FantasyPlayer[] {
  const teams = ["t1", "t2", "t3", "t4", "t5"];
  const specs: { pos: FantasyPlayer["position"]; price: number }[] = [
    { pos: "GK", price: 50 },
    { pos: "GK", price: 45 },
    { pos: "DEF", price: 60 },
    { pos: "DEF", price: 55 },
    { pos: "DEF", price: 50 },
    { pos: "DEF", price: 50 },
    { pos: "DEF", price: 45 },
    { pos: "MID", price: 85 },
    { pos: "MID", price: 80 },
    { pos: "MID", price: 70 },
    { pos: "MID", price: 65 },
    { pos: "MID", price: 55 },
    { pos: "FWD", price: 95 },
    { pos: "FWD", price: 75 },
    { pos: "FWD", price: 60 },
  ];

  return specs.map((s, idx) => ({
    id: `p${idx + 1}`,
    team_id: teams[idx % teams.length],
    display_name: `Player ${idx + 1}`,
    position: s.pos,
    price_tenths: s.price,
    status: "available",
  }));
}

function makeDefaultPicks(squad: FantasyPlayer[]): PickInput[] {
  const starterIds = new Set([
    "p1",
    "p3",
    "p4",
    "p5",
    "p6",
    "p8",
    "p9",
    "p10",
    "p11",
    "p13",
    "p14",
  ]);
  const benchIds = ["p2", "p7", "p12", "p15"];
  return squad.map((p) => {
    const isStarter = starterIds.has(p.id);
    const benchIndex = benchIds.indexOf(p.id);
    return {
      player_id: p.id,
      is_starter: isStarter,
      bench_order: isStarter ? null : benchIndex + 1,
      is_captain: p.id === "p8",
      is_vice_captain: p.id === "p13",
    };
  });
}

describe("Fantasy validation and scoring (E1-E20)", () => {
  it("validates a 15-player squad within budget and team quotas", () => {
    const squad = makeSquad();
    expect(validateSquad(squad, defaultRules)).toEqual({ valid: true });
    expect(
      validateLineupAndCaptains(makeDefaultPicks(squad), squad, defaultRules),
    ).toEqual({ valid: true });
  });

  it("rejects squads over budget or over max per team", () => {
    const overBudget = makeSquad().map((p) => ({ ...p, price_tenths: 100 }));
    expect(validateSquad(overBudget, defaultRules).valid).toBe(false);

    const tooManySameTeam = makeSquad().map((p) => ({ ...p, team_id: "t1" }));
    expect(validateSquad(tooManySameTeam, defaultRules).valid).toBe(false);
  });

  it("E1-E3: computes goals, assists, and clean sheets by position", () => {
    const fwdStats = makeStats("p13", {
      minutesPlayed: 50,
      goals: 1,
      assists: 1,
      goalsConcededOnPitch: 1,
    });
    expect(calculatePlayerPoints("FWD", fwdStats, defaultRules).points).toBe(9);

    expect(
      calculatePlayerPoints(
        "GK",
        makeStats("p1", { goals: 1, goalsConcededOnPitch: 0 }),
        defaultRules,
      ).points,
    ).toBe(12);

    expect(
      calculatePlayerPoints(
        "DEF",
        makeStats("p3", { goals: 1, goalsConcededOnPitch: 0 }),
        defaultRules,
      ).points,
    ).toBe(12);

    expect(
      calculatePlayerPoints(
        "MID",
        makeStats("p8", { goals: 1, goalsConcededOnPitch: 0 }),
        defaultRules,
      ).points,
    ).toBe(8);

    expect(
      calculatePlayerPoints(
        "FWD",
        makeStats("p13", { goals: 1, goalsConcededOnPitch: 0 }),
        defaultRules,
      ).points,
    ).toBe(6);

    expect(
      calculatePlayerPoints(
        "DEF",
        makeStats("p3", { assists: 2, goalsConcededOnPitch: 0 }),
        defaultRules,
      ).points,
    ).toBe(12);

    expect(
      calculatePlayerPoints(
        "MID",
        makeStats("p8", { assists: 1, goalsConcededOnPitch: 0 }),
        defaultRules,
      ).points,
    ).toBe(6);

    expect(
      calculatePlayerPoints(
        "FWD",
        makeStats("p13", { assists: 1, goalsConcededOnPitch: 0 }),
        defaultRules,
      ).points,
    ).toBe(5);
  });

  it("E4 & E10: handles 30-min threshold, appeared=true subs, and extra time", () => {
    expect(
      calculatePlayerPoints(
        "MID",
        makeStats("p8", { minutesPlayed: 15, goalsConcededOnPitch: 1 }),
        defaultRules,
      ).points,
    ).toBe(1);

    expect(
      calculatePlayerPoints(
        "MID",
        makeStats("p8", { minutesPlayed: 30, goalsConcededOnPitch: 1 }),
        defaultRules,
      ).points,
    ).toBe(2);

    expect(
      calculatePlayerPoints(
        "MID",
        makeStats("p8", { minutesPlayed: 29, goalsConcededOnPitch: 1 }),
        defaultRules,
      ).points,
    ).toBe(1);

    expect(
      calculatePlayerPoints(
        "MID",
        makeStats("p8", { appeared: false, minutesPlayed: 0 }),
        defaultRules,
      ).points,
    ).toBe(0);

    expect(
      calculatePlayerPoints(
        "FWD",
        makeStats("p13", { appeared: true, minutesPlayed: 0 }),
        defaultRules,
      ).points,
    ).toBe(1);

    expect(
      calculatePlayerPoints(
        "FWD",
        makeStats("p13", { minutesPlayed: 34 }),
        defaultRules,
      ).points,
    ).toBe(2);
  });

  it("E5-E9: handles clean sheets, conceded intervals, cards, OGs, pens, and MOTM", () => {
    expect(
      calculatePlayerPoints(
        "DEF",
        makeStats("p3", { minutesPlayed: 25, goalsConcededOnPitch: 0 }),
        defaultRules,
      ).points,
    ).toBe(1);

    expect(
      calculatePlayerPoints(
        "GK",
        makeStats("p1", { minutesPlayed: 50, goalsConcededOnPitch: 3 }),
        defaultRules,
      ).points,
    ).toBe(1);

    expect(
      calculatePlayerPoints(
        "GK",
        makeStats("p1", { minutesPlayed: 50, goalsConcededOnPitch: 4 }),
        defaultRules,
      ).points,
    ).toBe(0);

    expect(
      calculatePlayerPoints(
        "DEF",
        makeStats("p3", { minutesPlayed: 20, redCards: 1 }),
        defaultRules,
      ).points,
    ).toBe(-2);

    expect(
      calculatePlayerPoints(
        "DEF",
        makeStats("p3", {
          minutesPlayed: 50,
          ownGoals: 1,
          goalsConcededOnPitch: 1,
        }),
        defaultRules,
      ).points,
    ).toBe(0);

    expect(
      calculatePlayerPoints(
        "GK",
        makeStats("p1", {
          minutesPlayed: 50,
          penaltiesSaved: 1,
          goalsConcededOnPitch: 2,
        }),
        defaultRules,
      ).points,
    ).toBe(6);

    expect(
      calculatePlayerPoints(
        "FWD",
        makeStats("p13", {
          minutesPlayed: 50,
          goals: 1,
          penaltiesMissed: 1,
          goalsConcededOnPitch: 1,
        }),
        defaultRules,
      ).points,
    ).toBe(4);

    expect(
      calculatePlayerPoints(
        "MID",
        makeStats("p8", {
          minutesPlayed: 50,
          assists: 1,
          goalsConcededOnPitch: 1,
          manOfTheMatch: true,
        }),
        defaultRules,
      ).points,
    ).toBe(8);
  });

  it("E14: ignores walkover fixtures completely", () => {
    const stats = makeStats("p13", {
      minutesPlayed: 50,
      goals: 3,
      manOfTheMatch: true,
      walkover: true,
    });
    expect(calculatePlayerPoints("FWD", stats, defaultRules).points).toBe(0);
  });

  it("E11-E12 & E17: handles captaincy, negative doubling, and auto-subs", () => {
    const squad = makeSquad();
    const picks = makeDefaultPicks(squad);

    const statsRows: PlayerMatchStats[] = [
      makeStats("p1", {
        minutesPlayed: 50,
        goalsConcededOnPitch: 2,
        penaltiesSaved: 1,
      }),
      makeStats("p7", {
        minutesPlayed: 40,
        assists: 1,
        goalsConcededOnPitch: 0,
      }),
      makeStats("p13", {
        minutesPlayed: 50,
        goals: 2,
        goalsConcededOnPitch: 1,
        manOfTheMatch: true,
      }),
    ];

    const score = calculateManagerMatchdayScore({
      picks,
      players: squad,
      statsRows,
      rules: defaultRules,
      transferCost: 4,
    });

    expect(score.captain_used).toBe("vice_captain");
    expect(score.auto_subs).toEqual([
      { out_player_id: "p3", in_player_id: "p7" },
    ]);
    expect(score.gross_points).toBe(6 + 9 + 13 * 2);
    expect(score.net_points).toBe(37);

    const redCardCaptainScore = calculateManagerMatchdayScore({
      picks,
      players: squad,
      statsRows: [makeStats("p8", { minutesPlayed: 20, redCards: 1 })],
      rules: defaultRules,
      transferCost: 0,
    });
    expect(redCardCaptainScore.captain_used).toBe("captain");
    expect(redCardCaptainScore.gross_points).toBe(-4);
  });

  it("E12d: respects formation maximums (max 5 DEF) during auto-subs", () => {
    const squad = makeSquad();
    const fiveDefPicks: PickInput[] = squad.map((p) => {
      const starters = new Set([
        "p1",
        "p3",
        "p4",
        "p5",
        "p6",
        "p11",
        "p8",
        "p9",
        "p10",
        "p13",
        "p14",
      ]);
      const bench = ["p2", "p7", "p12", "p15"];
      const isStarter = starters.has(p.id);
      return {
        player_id: p.id,
        is_starter: isStarter,
        bench_order: isStarter ? null : bench.indexOf(p.id) + 1,
        is_captain: p.id === "p8",
        is_vice_captain: p.id === "p13",
      };
    });

    const playingStarters = [
      "p1",
      "p3",
      "p4",
      "p5",
      "p6",
      "p11",
      "p8",
      "p9",
      "p13",
      "p14",
    ].map((id) =>
      makeStats(id, { minutesPlayed: 50, goalsConcededOnPitch: 1 }),
    );

    const statsRows = [
      ...playingStarters,
      makeStats("p7", { minutesPlayed: 50, goalsConcededOnPitch: 1 }),
      makeStats("p12", { minutesPlayed: 15 }),
    ];

    const res = calculateManagerMatchdayScore({
      picks: fiveDefPicks,
      players: squad,
      statsRows,
      rules: { ...defaultRules, max_start_def: 4 },
      transferCost: 0,
    });

    expect(res.auto_subs).toEqual([
      { out_player_id: "p10", in_player_id: "p12" },
    ]);
    expect(res.gross_points).toBe(23);
  });

  it("E15: computes transfer hits, unlimited matchdays, and banked transfers", () => {
    expect(
      calculateTransferCost({
        matchday: { number: 2 },
        transfersCount: 3,
        freeTransfersAvailable: 1,
        wildcardActive: false,
        rules: defaultRules,
      }),
    ).toEqual({
      pointsCost: 8,
      freeTransfersUsed: 1,
      freeTransfersRemaining: 0,
    });

    expect(
      calculateTransferCost({
        matchday: { number: 6 },
        transfersCount: 5,
        freeTransfersAvailable: 2,
        wildcardActive: false,
        rules: defaultRules,
      }).pointsCost,
    ).toBe(0);

    expect(nextMatchdayFreeTransfers(1, defaultRules)).toBe(2);
    expect(nextMatchdayFreeTransfers(2, defaultRules)).toBe(2);
  });
});