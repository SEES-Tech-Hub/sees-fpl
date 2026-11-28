import {
  FantasyPlayer,
  FantasyRules,
  ManagerMatchdayScoreResult,
  PickInput,
  PlayerMatchStats,
  PlayerPosition,
  PlayerScoreBreakdown,
  ScoreBreakdownItem,
} from "./engine-types";
import { isValidStartingFormation } from "./validation";

const POSITION_ORDER: Record<PlayerPosition, number> = {
  GK: 0,
  DEF: 1,
  MID: 2,
  FWD: 3,
};

function didPlay(stats: PlayerMatchStats | undefined): boolean {
  if (!stats || stats.walkover) return false;
  return Boolean(stats.appeared || stats.minutesPlayed > 0);
}

export function calculatePlayerPoints(
  position: PlayerPosition,
  stats: PlayerMatchStats | undefined,
  rules: FantasyRules,
): { points: number; playedMinutes: number; items: ScoreBreakdownItem[] } {
  if (!stats || !didPlay(stats)) {
    return { points: 0, playedMinutes: 0, items: [] };
  }

  const items: ScoreBreakdownItem[] = [];

  if (rules.pts_appearance !== 0) {
    items.push({
      key: "appeared",
      label: "Appearance",
      count: 1,
      points: rules.pts_appearance,
    });
  }

  if (
    stats.minutesPlayed >= rules.min_minutes_threshold &&
    rules.pts_30_mins !== 0
  ) {
    items.push({
      key: "played_30",
      label: `Played ${rules.min_minutes_threshold}+ mins`,
      count: 1,
      points: rules.pts_30_mins,
    });
  }

  if (stats.goals > 0) {
    const perGoal =
      position === "GK"
        ? rules.pts_goal_gk
        : position === "DEF"
          ? rules.pts_goal_def
          : position === "MID"
            ? rules.pts_goal_mid
            : rules.pts_goal_fwd;
    if (perGoal !== 0) {
      items.push({
        key: "goal",
        label: stats.goals === 1 ? "Goal" : "Goals",
        count: stats.goals,
        points: stats.goals * perGoal,
      });
    }
  }

  if (stats.assists > 0 && rules.pts_assist !== 0) {
    items.push({
      key: "assist",
      label: stats.assists === 1 ? "Assist" : "Assists",
      count: stats.assists,
      points: stats.assists * rules.pts_assist,
    });
  }

  if (
    stats.minutesPlayed >= rules.min_minutes_threshold &&
    stats.goalsConcededOnPitch === 0
  ) {
    const csPts =
      position === "GK"
        ? rules.pts_clean_sheet_gk
        : position === "DEF"
          ? rules.pts_clean_sheet_def
          : position === "MID"
            ? rules.pts_clean_sheet_mid
            : rules.pts_clean_sheet_fwd;
    if (csPts !== 0) {
      items.push({
        key: "clean_sheet",
        label: "Clean sheet",
        count: 1,
        points: csPts,
      });
    }
  }

  if (stats.goalsConcededOnPitch >= rules.pts_goals_conceded_step) {
    const intervals = Math.floor(
      stats.goalsConcededOnPitch / rules.pts_goals_conceded_step,
    );
    const perStep =
      position === "GK"
        ? rules.pts_goals_conceded_gk
        : position === "DEF"
          ? rules.pts_goals_conceded_def
          : position === "MID"
            ? rules.pts_goals_conceded_mid
            : rules.pts_goals_conceded_fwd;
    if (perStep !== 0) {
      items.push({
        key: "goals_conceded_2",
        label: "Goals conceded",
        count: intervals,
        points: intervals * perStep,
      });
    }
  }

  if (stats.penaltiesSaved > 0 && rules.pts_penalty_save !== 0) {
    items.push({
      key: "penalty_saved",
      label: stats.penaltiesSaved === 1 ? "Penalty saved" : "Penalties saved",
      count: stats.penaltiesSaved,
      points: stats.penaltiesSaved * rules.pts_penalty_save,
    });
  }

  // Saves: pts_saves for every pts_saves_step saves (penalty saves count too).
  const saveStep = rules.pts_saves_step ?? 0;
  const perSaves = rules.pts_saves ?? 0;
  if (saveStep > 0 && perSaves !== 0 && stats.saves >= saveStep) {
    const steps = Math.floor(stats.saves / saveStep);
    items.push({
      key: "saves",
      label: `${stats.saves} saves`,
      count: steps,
      points: steps * perSaves,
    });
  }

  if (stats.penaltiesMissed > 0 && rules.pts_penalty_miss !== 0) {
    items.push({
      key: "penalty_missed",
      label: stats.penaltiesMissed === 1 ? "Penalty missed" : "Penalties missed",
      count: stats.penaltiesMissed,
      points: stats.penaltiesMissed * rules.pts_penalty_miss,
    });
  }

  if (stats.yellowCards > 0 && rules.pts_yellow_card !== 0) {
    items.push({
      key: "yellow_card",
      label: stats.yellowCards === 1 ? "Yellow card" : "Yellow cards",
      count: stats.yellowCards,
      points: stats.yellowCards * rules.pts_yellow_card,
    });
  }

  if (stats.redCards > 0 && rules.pts_red_card !== 0) {
    items.push({
      key: "red_card",
      label: stats.redCards === 1 ? "Red card" : "Red cards",
      count: stats.redCards,
      points: stats.redCards * rules.pts_red_card,
    });
  }

  if (stats.ownGoals > 0 && rules.pts_own_goal !== 0) {
    items.push({
      key: "own_goal",
      label: stats.ownGoals === 1 ? "Own goal" : "Own goals",
      count: stats.ownGoals,
      points: stats.ownGoals * rules.pts_own_goal,
    });
  }

  if (stats.manOfTheMatch && rules.pts_motm !== 0) {
    items.push({
      key: "man_of_the_match",
      label: "Man of the Match",
      count: 1,
      points: rules.pts_motm,
    });
  }

  const points = items.reduce((sum, item) => sum + item.points, 0);
  return { points, playedMinutes: stats.minutesPlayed, items };
}

export function aggregatePlayerStats(
  rows: PlayerMatchStats[],
): Map<string, PlayerMatchStats> {
  const byPlayer = new Map<string, PlayerMatchStats>();
  for (const row of rows) {
    if (row.walkover) continue;
    const existing = byPlayer.get(row.playerId);
    if (!existing) {
      byPlayer.set(row.playerId, { ...row });
    } else {
      existing.appeared = Boolean(existing.appeared || row.appeared);
      existing.minutesPlayed += row.minutesPlayed;
      existing.goals += row.goals;
      existing.assists += row.assists;
      existing.ownGoals += row.ownGoals;
      existing.goalsConcededOnPitch += row.goalsConcededOnPitch;
      existing.yellowCards += row.yellowCards;
      existing.redCards += row.redCards;
      existing.penaltiesMissed += row.penaltiesMissed;
      existing.penaltiesSaved += row.penaltiesSaved;
      existing.saves += row.saves;
      existing.manOfTheMatch = existing.manOfTheMatch || row.manOfTheMatch;
      existing.fixtureFinished = existing.fixtureFinished && row.fixtureFinished;
    }
  }
  return byPlayer;
}

export function calculateManagerMatchdayScore(params: {
  picks: PickInput[];
  players: FantasyPlayer[];
  statsRows: PlayerMatchStats[];
  rules: FantasyRules;
  transferCost: number;
}): ManagerMatchdayScoreResult {
  const { picks, players, statsRows, rules, transferCost } = params;
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const statsMap = aggregatePlayerStats(statsRows);

  const activeIds = new Set(
    picks.filter((p) => p.is_starter).map((p) => p.player_id),
  );
  const benchPicks = picks
    .filter((p) => !p.is_starter)
    .sort((a, b) => (a.bench_order ?? 99) - (b.bench_order ?? 99));

  const autoSubs: { out_player_id: string; in_player_id: string }[] = [];
  const subbedOutIds = new Set<string>();
  const subbedInIds = new Set<string>();

  const nonPlayingStarters = picks
    .filter((p) => p.is_starter && !didPlay(statsMap.get(p.player_id)))
    .sort((a, b) => {
      const posA = playerMap.get(a.player_id)?.position ?? "FWD";
      const posB = playerMap.get(b.player_id)?.position ?? "FWD";
      return POSITION_ORDER[posA] - POSITION_ORDER[posB];
    });

  for (const starter of nonPlayingStarters) {
    const starterPlayer = playerMap.get(starter.player_id);
    if (!starterPlayer) continue;

    for (const benchPick of benchPicks) {
      if (subbedInIds.has(benchPick.player_id)) continue;
      const benchPlayer = playerMap.get(benchPick.player_id);
      if (!benchPlayer) continue;

      if (!didPlay(statsMap.get(benchPick.player_id))) continue;

      if (starterPlayer.position === "GK" && benchPlayer.position !== "GK") {
        continue;
      }
      if (starterPlayer.position !== "GK" && benchPlayer.position === "GK") {
        continue;
      }

      const candidateIds = new Set(activeIds);
      candidateIds.delete(starter.player_id);
      candidateIds.add(benchPick.player_id);

      const candidatePlayers = Array.from(candidateIds)
        .map((id) => playerMap.get(id))
        .filter((p): p is FantasyPlayer => Boolean(p));

      if (isValidStartingFormation(candidatePlayers, rules)) {
        activeIds.delete(starter.player_id);
        activeIds.add(benchPick.player_id);
        subbedOutIds.add(starter.player_id);
        subbedInIds.add(benchPick.player_id);
        autoSubs.push({
          out_player_id: starter.player_id,
          in_player_id: benchPick.player_id,
        });
        break;
      }
    }
  }

  const captainPick = picks.find((p) => p.is_captain);
  const vicePick = picks.find((p) => p.is_vice_captain);

  const captainPlayed = captainPick
    ? didPlay(statsMap.get(captainPick.player_id))
    : false;
  const vicePlayed = vicePick
    ? didPlay(statsMap.get(vicePick.player_id))
    : false;

  let doubledPlayerId: string | null = null;
  let captainUsed: "captain" | "vice_captain" | "none" = "none";

  if (captainPick && captainPlayed && activeIds.has(captainPick.player_id)) {
    doubledPlayerId = captainPick.player_id;
    captainUsed = "captain";
  } else if (vicePick && vicePlayed && activeIds.has(vicePick.player_id)) {
    doubledPlayerId = vicePick.player_id;
    captainUsed = "vice_captain";
  }

  let grossPoints = 0;
  const breakdown: PlayerScoreBreakdown[] = [];

  for (const pick of picks) {
    const player = playerMap.get(pick.player_id);
    if (!player) continue;

    const calc = calculatePlayerPoints(
      player.position,
      statsMap.get(pick.player_id),
      rules,
    );
    const isPlayingSlot = activeIds.has(pick.player_id);
    const multiplier = isPlayingSlot
      ? doubledPlayerId === pick.player_id
        ? rules.captain_multiplier
        : 1
      : 0;
    const appliedPoints = calc.points * multiplier;
    grossPoints += appliedPoints;

    breakdown.push({
      player_id: pick.player_id,
      is_starter: pick.is_starter,
      played_minutes: calc.playedMinutes,
      subbed_in: subbedInIds.has(pick.player_id),
      subbed_out: subbedOutIds.has(pick.player_id),
      multiplier,
      base_points: calc.points,
      applied_points: appliedPoints,
      items: calc.items,
    });
  }

  return {
    gross_points: grossPoints,
    transfer_cost: transferCost,
    net_points: grossPoints - transferCost,
    captain_used: captainUsed,
    auto_subs: autoSubs,
    breakdown,
  };
}