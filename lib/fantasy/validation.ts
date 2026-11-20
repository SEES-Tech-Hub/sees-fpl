import type {
  FantasyPlayer,
  FantasyRules,
  MatchdayInfo,
  PickInput,
  PlayerPosition,
  ValidationResult,
} from "./types";

export function isDeadlinePassed(
  matchday: Pick<MatchdayInfo, "deadline_at" | "status">,
  now: Date = new Date(),
): boolean {
  if (matchday.status === "locked" || matchday.status === "finalised") {
    return true;
  }
  if (!matchday.deadline_at) return false;
  return now.getTime() >= new Date(matchday.deadline_at).getTime();
}

export function validateSquad(
  players: FantasyPlayer[],
  rules: FantasyRules,
): ValidationResult {
  if (players.length !== rules.squad_size) {
    return {
      valid: false,
      reason: `Squad must contain exactly ${rules.squad_size} players.`,
    };
  }

  const uniqueIds = new Set(players.map((p) => p.id));
  if (uniqueIds.size !== rules.squad_size) {
    return { valid: false, reason: "Squad cannot contain duplicate players." };
  }

  const totalPrice = players.reduce((sum, p) => sum + p.price_tenths, 0);
  if (totalPrice > rules.budget_tenths) {
    return {
      valid: false,
      reason: `Total squad cost (${(totalPrice / 10).toFixed(1)}m) exceeds budget (${(rules.budget_tenths / 10).toFixed(1)}m).`,
    };
  }

  const posCounts: Record<PlayerPosition, number> = {
    GK: 0,
    DEF: 0,
    MID: 0,
    FWD: 0,
  };
  const teamCounts = new Map<string, number>();

  for (const player of players) {
    if (player.status === "left") {
      return {
        valid: false,
        reason: `${player.display_name} has left their squad and cannot be selected.`,
      };
    }
    posCounts[player.position] += 1;
    const count = (teamCounts.get(player.team_id) ?? 0) + 1;
    if (count > rules.max_per_team) {
      return {
        valid: false,
        reason: `You can select at most ${rules.max_per_team} players from the same year team.`,
      };
    }
    teamCounts.set(player.team_id, count);
  }

  if (posCounts.GK !== rules.gk_quota) {
    return { valid: false, reason: `Squad must have exactly ${rules.gk_quota} goalkeepers.` };
  }
  if (posCounts.DEF !== rules.def_quota) {
    return { valid: false, reason: `Squad must have exactly ${rules.def_quota} defenders.` };
  }
  if (posCounts.MID !== rules.mid_quota) {
    return { valid: false, reason: `Squad must have exactly ${rules.mid_quota} midfielders.` };
  }
  if (posCounts.FWD !== rules.fwd_quota) {
    return { valid: false, reason: `Squad must have exactly ${rules.fwd_quota} forwards.` };
  }

  return { valid: true };
}

export function isValidStartingFormation(
  starters: Pick<FantasyPlayer, "position">[],
  rules: FantasyRules,
): boolean {
  if (starters.length !== rules.starting_size) return false;
  const counts: Record<PlayerPosition, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const s of starters) {
    counts[s.position] += 1;
  }
  return (
    counts.GK >= rules.min_start_gk &&
    counts.GK <= rules.max_start_gk &&
    counts.DEF >= rules.min_start_def &&
    counts.DEF <= rules.max_start_def &&
    counts.MID >= rules.min_start_mid &&
    counts.MID <= rules.max_start_mid &&
    counts.FWD >= rules.min_start_fwd &&
    counts.FWD <= rules.max_start_fwd
  );
}

export function validateLineupAndCaptains(
  picks: PickInput[],
  squadPlayers: FantasyPlayer[],
  rules: FantasyRules,
): ValidationResult {
  if (picks.length !== rules.squad_size) {
    return {
      valid: false,
      reason: `Lineup submission must include all ${rules.squad_size} squad players.`,
    };
  }

  const squadMap = new Map(squadPlayers.map((p) => [p.id, p]));
  const seenPlayers = new Set<string>();
  const starters: FantasyPlayer[] = [];
  const benchOrders = new Set<number>();
  let captainId: string | null = null;
  let viceCaptainId: string | null = null;

  for (const pick of picks) {
    const player = squadMap.get(pick.player_id);
    if (!player) {
      return { valid: false, reason: "All picks must belong to your current squad." };
    }
    if (seenPlayers.has(pick.player_id)) {
      return { valid: false, reason: "Duplicate player in lineup." };
    }
    seenPlayers.add(pick.player_id);

    if (pick.is_captain && pick.is_vice_captain) {
      return {
        valid: false,
        reason: "Captain and vice-captain must be different players.",
      };
    }

    if (pick.is_starter) {
      if (pick.bench_order !== null) {
        return { valid: false, reason: "Starting players cannot have a bench order." };
      }
      starters.push(player);
      if (pick.is_captain) {
        if (captainId) return { valid: false, reason: "Only one captain can be selected." };
        captainId = pick.player_id;
      }
      if (pick.is_vice_captain) {
        if (viceCaptainId) {
          return { valid: false, reason: "Only one vice-captain can be selected." };
        }
        viceCaptainId = pick.player_id;
      }
    } else {
      if (pick.is_captain || pick.is_vice_captain) {
        return {
          valid: false,
          reason: "Captain and vice-captain must be in the starting lineup.",
        };
      }
      if (
        pick.bench_order === null ||
        !Number.isInteger(pick.bench_order) ||
        pick.bench_order < 1 ||
        pick.bench_order > rules.squad_size - rules.starting_size
      ) {
        return { valid: false, reason: "Each bench player must have a unique bench order from 1 to 4." };
      }
      if (benchOrders.has(pick.bench_order)) {
        return { valid: false, reason: "Bench order numbers must be unique." };
      }
      benchOrders.add(pick.bench_order);
    }
  }

  if (starters.length !== rules.starting_size) {
    return {
      valid: false,
      reason: `Starting lineup must have exactly ${rules.starting_size} players.`,
    };
  }

  if (!isValidStartingFormation(starters, rules)) {
    return {
      valid: false,
      reason: "Invalid formation. Must have 1 GK, 3-5 DEF, 2-5 MID, and 1-3 FWD.",
    };
  }

  if (!captainId || !viceCaptainId || captainId === viceCaptainId) {
    return {
      valid: false,
      reason: "You must choose two distinct starting players as captain and vice-captain.",
    };
  }

  return { valid: true };
}