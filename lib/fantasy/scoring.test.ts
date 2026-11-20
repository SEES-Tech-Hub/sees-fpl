import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateManagerMatchdayScore, calculatePlayerPoints } from "./scoring";
import { calculateTransferCost, nextMatchdayFreeTransfers } from "./transfers";
import type { FantasyPlayer, FantasyRules, PickInput, PlayerMatchStats } from "./types";
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

describe("Fantasy validation and scoring", () => {
  it("validates a 15-player squad within budget and team quotas", () => {
    const squad = makeSquad();
    assert.deepEqual(validateSquad(squad, defaultRules), { valid: true });
    assert.deepEqual(
      validateLineupAndCaptains(makeDefaultPicks(squad), squad, defaultRules),
      { valid: true },
    );
  });

  it("rejects squads over budget or over max per team", () => {
    const overBudget = makeSquad().map((p) => ({ ...p, price_tenths: 100 }));
    assert.equal(validateSquad(overBudget, defaultRules).valid, false);

    const tooManySameTeam = makeSquad().map((p) => ({ ...p, team_id: "t1" }));
    assert.equal(validateSquad(tooManySameTeam, defaultRules).valid, false);
  });

  it("calculates defender points including goals, clean sheet, card, and MOTM", () => {
    const stats: PlayerMatchStats = {
      playerId: "p3",
      fixtureId: "f1",
      minutes: 50,
      goals: 1,
      assists: 1,
      ownGoals: 0,
      goalsConceded: 0,
      yellowCards: 1,
      redCards: 0,
      penaltiesMissed: 0,
      penaltiesSaved: 0,
      manOfTheMatch: true,
      walkover: false,
      fixtureFinished: true,
    };
    const res = calculatePlayerPoints("DEF", stats, defaultRules);
    assert.equal(res.points, 1 + 1 + 6 + 3 + 4 - 1 + 3);
  });

  it("applies automatic substitution and vice-captain multiplier when captain does not play", () => {
    const squad = makeSquad();
    const picks = makeDefaultPicks(squad);

    const statsRows: PlayerMatchStats[] = [
      {
        playerId: "p1",
        fixtureId: "f1",
        minutes: 50,
        goals: 0,
        assists: 0,
        ownGoals: 0,
        goalsConceded: 2,
        yellowCards: 0,
        redCards: 0,
        penaltiesMissed: 0,
        penaltiesSaved: 1,
        manOfTheMatch: false,
        walkover: false,
        fixtureFinished: true,
      },
      {
        playerId: "p7",
        fixtureId: "f1",
        minutes: 40,
        goals: 0,
        assists: 1,
        ownGoals: 0,
        goalsConceded: 0,
        yellowCards: 0,
        redCards: 0,
        penaltiesMissed: 0,
        penaltiesSaved: 0,
        manOfTheMatch: false,
        walkover: false,
        fixtureFinished: true,
      },
      {
        playerId: "p13",
        fixtureId: "f1",
        minutes: 50,
        goals: 2,
        assists: 0,
        ownGoals: 0,
        goalsConceded: 1,
        yellowCards: 0,
        redCards: 0,
        penaltiesMissed: 0,
        penaltiesSaved: 0,
        manOfTheMatch: true,
        walkover: false,
        fixtureFinished: true,
      },
    ];

    const score = calculateManagerMatchdayScore({
      picks,
      players: squad,
      statsRows,
      rules: defaultRules,
      transferCost: 4,
    });

    assert.equal(score.captain_used, "vice_captain");
    assert.deepEqual(score.auto_subs, [{ out_player_id: "p3", in_player_id: "p7" }]);
    assert.equal(score.gross_points, 6 + 9 + 13 * 2);
    assert.equal(score.net_points, 37);
  });

  it("ignores walkover fixtures", () => {
    const stats: PlayerMatchStats = {
      playerId: "p13",
      fixtureId: "f2",
      minutes: 50,
      goals: 3,
      assists: 0,
      ownGoals: 0,
      goalsConceded: 0,
      yellowCards: 0,
      redCards: 0,
      penaltiesMissed: 0,
      penaltiesSaved: 0,
      manOfTheMatch: true,
      walkover: true,
      fixtureFinished: true,
    };
    assert.equal(calculatePlayerPoints("FWD", stats, defaultRules).points, 0);
  });

  it("computes transfer hits, free matchdays, and banked transfers", () => {
    assert.deepEqual(
      calculateTransferCost({
        matchday: { number: 2 },
        transfersCount: 3,
        freeTransfersAvailable: 1,
        wildcardActive: false,
        rules: defaultRules,
      }),
      {
        pointsCost: 8,
        freeTransfersUsed: 1,
        freeTransfersRemaining: 0,
      },
    );

    assert.equal(
      calculateTransferCost({
        matchday: { number: 6 },
        transfersCount: 5,
        freeTransfersAvailable: 2,
        wildcardActive: false,
        rules: defaultRules,
      }).pointsCost,
      0,
    );

    assert.equal(nextMatchdayFreeTransfers(1, defaultRules), 2);
    assert.equal(nextMatchdayFreeTransfers(2, defaultRules), 2);
  });
});