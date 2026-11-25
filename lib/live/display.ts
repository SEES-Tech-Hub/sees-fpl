import type { TeamSummary } from "./types";

// Display helpers shared by the public pages and the console, for the
// formats beyond football: players named on each side, board-game scores in
// half points, and who won when both players are from the same year.

type Side = "home" | "away";

type Sides = {
  home: TeamSummary | null;
  away: TeamSummary | null;
  homeEntrant?: string | null;
  awayEntrant?: string | null;
};

/** The name to show for a side: the player when named, else the year, else TBD. */
export function sideName(f: Sides, side: Side): string {
  const entrant = side === "home" ? f.homeEntrant : f.awayEntrant;
  const team = side === "home" ? f.home : f.away;
  return entrant ?? team?.name ?? "TBD";
}

/** The year under a player's name ("Year 2"), or nothing for a year-vs-year match. */
export function sideYear(f: Sides, side: Side): string | null {
  const entrant = side === "home" ? f.homeEntrant : f.awayEntrant;
  const team = side === "home" ? f.home : f.away;
  return entrant && team ? team.name : null;
}

/**
 * A score as people read it. Board games store board points doubled (a win
 * is 2, a draw 1 each), so they show as halves: 3 → "1½".
 */
export function formatScore(value: number | null, boards: number | null | undefined): string {
  if (value === null) return "–";
  if (!boards) return String(value);
  const whole = Math.floor(value / 2);
  const half = value % 2 === 1;
  return half ? (whole === 0 ? "½" : `${whole}½`) : String(whole);
}

/** Did this side win? Uses winner_side (same-year players), else the winning year. */
export function sideWon(
  f: Sides,
  state: { status: string; winnerTeamId: string | null; winnerSide?: Side | null },
  side: Side,
): boolean {
  if (state.status !== "full_time" && state.status !== "walkover") return false;
  if (state.winnerSide) return state.winnerSide === side;
  const team = side === "home" ? f.home : f.away;
  return !!team && state.winnerTeamId === team.id;
}

/** "QF1 · Leg 2", "M3", or null when the fixture has no label. */
export function tieLabel(f: { tie: string | null; leg: number | null }): string | null {
  if (!f.tie) return null;
  return f.leg ? `${f.tie} · Leg ${f.leg}` : f.tie;
}

/** Leg 1 and leg 2 scores added up from leg 2's point of view (hosts swap between legs). */
export function aggregateScore(
  leg2: { homeScore: number | null; awayScore: number | null; home: TeamSummary | null; homeEntrant: string | null },
  leg1: { homeScore: number | null; awayScore: number | null; homeTeamId: string | null; homeEntrant: string | null } | null,
) {
  if (!leg1) return null;
  const sameWay = leg1.homeTeamId === (leg2.home?.id ?? null) && leg1.homeEntrant === leg2.homeEntrant;
  const h1 = leg1.homeScore ?? 0;
  const a1 = leg1.awayScore ?? 0;
  return {
    home: (leg2.homeScore ?? 0) + (sameWay ? h1 : a1),
    away: (leg2.awayScore ?? 0) + (sameWay ? a1 : h1),
  };
}
