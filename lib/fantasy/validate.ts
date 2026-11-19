// Instant feedback for the fantasy screens. These checks mirror the backend
// rules (docs/fantasy-backend-contract.md §3) so managers see problems before
// they tap Save, but the backend is the source of truth: it re-checks
// everything and its answer wins. No scoring happens here.

import { formatMoney } from "./format";
import { POSITIONS, type FantasyRules, type Player, type Position, type TransferState } from "./types";

export type Issue = {
  code: "SQUAD_SIZE" | "SQUAD_POSITIONS" | "OVER_BUDGET" | "TEAM_LIMIT" | "PLAYER_DUPLICATE";
  message: string;
  playerIds?: string[];
  /** Blocking issues stop saving; "incomplete" just means keep picking. */
  blocking: boolean;
};

export function countByPosition(players: Pick<Player, "position">[]): Record<Position, number> {
  const counts: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const p of players) counts[p.position] += 1;
  return counts;
}

export function squadCost(players: Pick<Player, "priceTenths">[]) {
  return players.reduce((sum, p) => sum + p.priceTenths, 0);
}

export function countByTeam(players: Pick<Player, "teamId">[]) {
  const counts = new Map<string, number>();
  for (const p of players) counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1);
  return counts;
}

/** Every problem with a (possibly incomplete) squad, most important first. */
export function squadIssues(players: Player[], rules: FantasyRules): Issue[] {
  const issues: Issue[] = [];

  const ids = players.map((p) => p.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) {
    issues.push({ code: "PLAYER_DUPLICATE", message: "A player is in your squad twice.", playerIds: dupes, blocking: true });
  }

  const cost = squadCost(players);
  if (cost > rules.budgetTenths) {
    issues.push({
      code: "OVER_BUDGET",
      message: `Your squad costs ${formatMoney(cost)}. The budget is ${formatMoney(rules.budgetTenths)}.`,
      blocking: true,
    });
  }

  for (const [teamId, n] of countByTeam(players)) {
    if (n > rules.maxPerTeam) {
      const sample = players.find((p) => p.teamId === teamId);
      issues.push({
        code: "TEAM_LIMIT",
        message: `You have ${n} players from Year ${sample?.teamYear}. The limit is ${rules.maxPerTeam}.`,
        playerIds: players.filter((p) => p.teamId === teamId).map((p) => p.id),
        blocking: true,
      });
    }
  }

  const counts = countByPosition(players);
  for (const pos of POSITIONS) {
    if (counts[pos] > rules.squadPositions[pos]) {
      issues.push({
        code: "SQUAD_POSITIONS",
        message: `You can have only ${rules.squadPositions[pos]} ${pos}. You have ${counts[pos]}.`,
        blocking: true,
      });
    }
  }

  if (players.length < rules.squadSize) {
    const missing = POSITIONS.filter((pos) => counts[pos] < rules.squadPositions[pos])
      .map((pos) => `${rules.squadPositions[pos] - counts[pos]} ${pos}`)
      .join(", ");
    issues.push({
      code: "SQUAD_SIZE",
      message: `Pick ${rules.squadSize - players.length} more: ${missing}.`,
      blocking: false,
    });
  }

  return issues;
}

/** Why a player can't be added right now, or null if they can. */
export function cannotAddReason(player: Player, selected: Player[], rules: FantasyRules): string | null {
  if (selected.some((p) => p.id === player.id)) return "Already in your squad";
  const counts = countByPosition(selected);
  if (counts[player.position] >= rules.squadPositions[player.position]) {
    return `You have all ${rules.squadPositions[player.position]} ${player.position}`;
  }
  const fromTeam = selected.filter((p) => p.teamId === player.teamId).length;
  if (fromTeam >= rules.maxPerTeam) return `Already ${rules.maxPerTeam} from Year ${player.teamYear}`;
  const left = rules.budgetTenths - squadCost(selected);
  if (player.priceTenths > left) return `Only ${formatMoney(left)} left`;
  return null;
}

// ---------------------------------------------------------------------------
// Lineup
// ---------------------------------------------------------------------------

/** "4-4-2" from the XI's positions (GK not shown). */
export function formationLabel(xi: Pick<Player, "position">[]) {
  const c = countByPosition(xi);
  return `${c.DEF}-${c.MID}-${c.FWD}`;
}

/** Why an XI breaks the formation rules, or null if it's valid. */
export function formationIssue(xi: Pick<Player, "position">[], rules: FantasyRules): string | null {
  if (xi.length !== rules.startingSize) return `Pick ${rules.startingSize} starters.`;
  const c = countByPosition(xi);
  for (const pos of POSITIONS) {
    const { min, max } = rules.formation[pos];
    if (c[pos] < min) return `You need at least ${min} ${pos} in your starting XI.`;
    if (c[pos] > max) return `You can start at most ${max} ${pos}.`;
  }
  return null;
}

/** Every formation the rules allow, e.g. ["3-4-3", "3-5-2", …]. */
export function allowedFormations(rules: FantasyRules) {
  const out: string[] = [];
  const outfield = rules.startingSize - rules.formation.GK.min;
  for (let d = rules.formation.DEF.min; d <= rules.formation.DEF.max; d++) {
    for (let m = rules.formation.MID.min; m <= rules.formation.MID.max; m++) {
      const f = outfield - d - m;
      if (f >= rules.formation.FWD.min && f <= rules.formation.FWD.max) out.push(`${d}-${m}-${f}`);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Transfers
// ---------------------------------------------------------------------------

export type TransferPreview = {
  count: number;
  free: number | null;
  extra: number;
  costPoints: number;
};

/**
 * What `count` more transfers would cost this matchday. Display only: the
 * backend charges the real cost and returns it in TransferState.
 */
export function previewTransferCost(state: TransferState, count: number, rules: FantasyRules): TransferPreview {
  if (state.freeTransfers === null || state.wildcard.activeThisMatchday) {
    return { count, free: null, extra: 0, costPoints: 0 };
  }
  const extra = Math.max(0, count - state.freeTransfers);
  return { count, free: state.freeTransfers, extra, costPoints: extra * rules.transferHitPoints };
}
