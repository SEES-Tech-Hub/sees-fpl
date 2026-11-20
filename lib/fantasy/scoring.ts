import type {
  FantasyPlayer,
  FantasyRules,
  ManagerMatchdayScoreResult,
  PickInput,
  PlayerMatchStats,
  PlayerPosition,
  PlayerScoreBreakdown,
} from "./types";
import { isValidStartingFormation } from "./validation";

export function calculatePlayerPoints(
  position: PlayerPosition,
  stats: PlayerMatchStats | undefined,
  rules: FantasyRules,
): { points: number; playedMinutes: number; items: { label: string; points: number }[] } {
  if (!stats || stats.walkover || stats.minutes <= 0) {
    return { points: 0, playedMinutes: 0, items: [] };
  }

  const items: { label: string; points: number }[] = [];

  items.push({ label: "Appearance", points: rules.pts_appearance });

  if (stats.minutes >= rules.min_minutes_threshold) {
    items.push({
      label: `Played ${rules.min_minutes_threshold}+ mins`,
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
    items.push({ label: `Goals (${stats.goals})`, points: stats.goals * perGoal });
  }

  if (stats.assists > 0) {
    items.push({
      label: `Assists (${stats.assists})`,
      points: stats.assists * rules.pts_assist,
    });
  }

  if (stats.minutes >= rules.min_minutes_threshold && stats.goalsConceded === 0) {
    const csPts =
      position === "GK"
        ? rules.pts_clean_sheet_gk
        : position === "DEF"
          ? rules.pts_clean_sheet_def
          : position === "MID"
            ? rules.pts_clean_sheet_mid
            : rules.pts_clean_sheet_fwd;
    if (csPts !== 0) {
      items.push({ label: "Clean sheet", points: csPts });
    }
  }

  if (stats.goalsConceded >= rules.pts_goals_conceded_step) {
    const intervals = Math.floor(stats.goalsConceded / rules.pts_goals_conceded_step);
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
        label: `Goals conceded (${stats.goalsConceded})`,
        points: intervals * perStep,
      });
    }
  }

  if (stats.penaltiesSaved > 0) {
    items.push({
      label: `Penalties saved (${stats.penaltiesSaved})`,
      points: stats.penaltiesSaved * rules.pts_penalty_save,
    });
  }

  if (stats.penaltiesMissed > 0) {
    items.push({
      label: `Penalties missed (${stats.penaltiesMissed})`,
      points: stats.penaltiesMissed * rules.pts_penalty_miss,
    });
  }

  if (stats.yellowCards > 0) {
    items.push({
      label: `Yellow cards (${stats.yellowCards})`,
      points: stats.yellowCards * rules.pts_yellow_card,
    });
  }

  if (stats.redCards > 0) {
    items.push({
      label: `Red cards (${stats.redCards})`,
      points: stats.redCards * rules.pts_red_card,
    });
  }

  if (stats.ownGoals > 0) {
    items.push({
      label: `Own goals (${stats.ownGoals})`,
      points: stats.ownGoals * rules.pts_own_goal,
    });
  }

  if (stats.manOfTheMatch) {
    items.push({ label: "Man of the Match", points: rules.pts_motm });
  }

  const points = items.reduce((sum, item) => sum + item.points, 0);
  return { points, playedMinutes: stats.minutes, items };
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
      existing.minutes += row.minutes;
      existing.goals += row.goals;
      existing.assists += row.assists;
      existing.ownGoals += row.ownGoals;
      existing.goalsConceded += row.goalsConceded;
      existing.yellowCards += row.yellowCards;
      existing.redCards += row.redCards;
      existing.penaltiesMissed += row.penaltiesMissed;
      existing.penaltiesSaved += row.penaltiesSaved;
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

  const nonPlayingStarters = picks.filter((p) => {
    if (!p.is_starter) return false;
    const st = statsMap.get(p.player_id);
    return !st || st.minutes <= 0;
  });

  for (const starter of nonPlayingStarters) {
    const starterPlayer = playerMap.get(starter.player_id);
    if (!starterPlayer) continue;

    for (const benchPick of benchPicks) {
      if (subbedInIds.has(benchPick.player_id)) continue;
      const benchPlayer = playerMap.get(benchPick.player_id);
      if (!benchPlayer) continue;

      const benchStats = statsMap.get(benchPick.player_id);
      if (!benchStats || benchStats.minutes <= 0) continue;

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

  const captainMinutes = captainPick
    ? (statsMap.get(captainPick.player_id)?.minutes ?? 0)
    : 0;
  const viceMinutes = vicePick
    ? (statsMap.get(vicePick.player_id)?.minutes ?? 0)
    : 0;

  let doubledPlayerId: string | null = null;
  let captainUsed: "captain" | "vice_captain" | "none" = "none";

  if (captainPick && captainMinutes > 0 && activeIds.has(captainPick.player_id)) {
    doubledPlayerId = captainPick.player_id;
    captainUsed = "captain";
  } else if (vicePick && viceMinutes > 0 && activeIds.has(vicePick.player_id)) {
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