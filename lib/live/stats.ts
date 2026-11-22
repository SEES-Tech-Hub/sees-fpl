import "server-only";
import type { PlayerMatchStats, StandingRow, TopScorerRow } from "./types";

// Live scores: derived football data. PHASE 2.
//
// These are placeholders with the agreed shapes, so the fantasy engine,
// tables and stats pages can be built now against made-up data. They return
// empty lists until the phase 2 migration (player_match_stats, standings,
// top scorers) is applied. The signatures won't change.

/** One row per player per fixture. Mary's fantasy engine reads only this. */
export async function getPlayerMatchStats(
  filter: { fixtureId: string } | { matchdayId: string },
): Promise<PlayerMatchStats[]> {
  void filter;
  return [];
}

/** The football league table, in rulebook order (points, GD, goals, head-to-head). */
export async function getFootballStandings(): Promise<StandingRow[]> {
  return [];
}

/** Top scorers (with assists), most goals first. */
export async function getTopScorers(limit = 10): Promise<TopScorerRow[]> {
  void limit;
  return [];
}
