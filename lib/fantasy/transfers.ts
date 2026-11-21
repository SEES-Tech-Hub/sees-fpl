import type {
  FantasyPlayer,
  FantasyRules,
  MatchdayInfo,
  ValidationResult,
} from "./engine-types";
import { validateSquad } from "./validation";

export function isUnlimitedTransferMatchday(
  matchday: Pick<MatchdayInfo, "number">,
  rules?: Pick<FantasyRules, "unlimited_transfer_matchdays">,
): boolean {
  const unlimitedMatchdays = rules?.unlimited_transfer_matchdays ?? [1, 6];
  return unlimitedMatchdays.includes(matchday.number);
}

export function calculateTransferCost(params: {
  matchday: Pick<MatchdayInfo, "number">;
  transfersCount: number;
  freeTransfersAvailable: number;
  wildcardActive: boolean;
  rules: FantasyRules;
}): {
  pointsCost: number;
  freeTransfersUsed: number;
  freeTransfersRemaining: number;
} {
  const {
    matchday,
    transfersCount,
    freeTransfersAvailable,
    wildcardActive,
    rules,
  } = params;

  if (transfersCount <= 0) {
    return {
      pointsCost: 0,
      freeTransfersUsed: 0,
      freeTransfersRemaining: freeTransfersAvailable,
    };
  }

  if (wildcardActive || isUnlimitedTransferMatchday(matchday, rules)) {
    return {
      pointsCost: 0,
      freeTransfersUsed: 0,
      freeTransfersRemaining: freeTransfersAvailable,
    };
  }

  const freeUsed = Math.min(transfersCount, freeTransfersAvailable);
  const extraTransfers = Math.max(0, transfersCount - freeUsed);
  return {
    pointsCost: extraTransfers * rules.extra_transfer_cost,
    freeTransfersUsed: freeUsed,
    freeTransfersRemaining: freeTransfersAvailable - freeUsed,
  };
}

export function nextMatchdayFreeTransfers(
  remainingBeforeRollover: number,
  rules: FantasyRules,
): number {
  return Math.min(
    rules.max_saved_transfers,
    Math.max(0, remainingBeforeRollover) + rules.free_transfers_per_md,
  );
}

export function validateTransfersAndResultingSquad(params: {
  currentSquad: FantasyPlayer[];
  swaps: { outPlayer: FantasyPlayer; inPlayer: FantasyPlayer }[];
  rules: FantasyRules;
}):
  | { valid: true; newSquad: FantasyPlayer[] }
  | { valid: false; reason: string } {
  const { currentSquad, swaps, rules } = params;

  if (swaps.length === 0) {
    return { valid: false, reason: "Select at least one player to transfer." };
  }

  const squadMap = new Map(currentSquad.map((p) => [p.id, p]));
  const outIds = new Set<string>();
  const inIds = new Set<string>();

  for (const { outPlayer, inPlayer } of swaps) {
    if (!squadMap.has(outPlayer.id)) {
      return {
        valid: false,
        reason: `${outPlayer.display_name} is not in your current squad.`,
      };
    }
    if (outIds.has(outPlayer.id)) {
      return {
        valid: false,
        reason: "Cannot transfer out the same player twice.",
      };
    }
    if (inIds.has(inPlayer.id)) {
      return {
        valid: false,
        reason: "Cannot transfer in the same player twice.",
      };
    }
    if (squadMap.has(inPlayer.id) && !outIds.has(inPlayer.id)) {
      return {
        valid: false,
        reason: `${inPlayer.display_name} is already in your squad.`,
      };
    }
    if (outPlayer.position !== inPlayer.position) {
      return {
        valid: false,
        reason: `Position mismatch: ${inPlayer.display_name} (${inPlayer.position}) cannot replace ${outPlayer.display_name} (${outPlayer.position}).`,
      };
    }
    outIds.add(outPlayer.id);
    inIds.add(inPlayer.id);
  }

  for (const outId of outIds) {
    squadMap.delete(outId);
  }
  for (const { inPlayer } of swaps) {
    squadMap.set(inPlayer.id, inPlayer);
  }

  const newSquad = Array.from(squadMap.values());
  const check: ValidationResult = validateSquad(newSquad, rules);
  if (check.valid === false) {
    return { valid: false, reason: check.reason };
  }

  return { valid: true, newSquad };
}