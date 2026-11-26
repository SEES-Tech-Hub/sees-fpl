// The race for the championship in words, shared by the Home card, the
// championship page and its share images. Pure functions.
import { festivalDay } from "./festival";
import type { MedalTableRow } from "./types";
import { formatWAT } from "@/lib/utils";

export type ChampionshipProgress = {
  /** Events with a gold awarded. */
  decided: number;
  /** Every event that awards medals. */
  total: number;
  /** The first and last scheduled matches, for "day 4 of 13". */
  firstAt: string | null;
  lastAt: string | null;
};

export const raceStarted = (rows: MedalTableRow[]) => rows.some((r) => r.points > 0);
export const raceFinished = (p: ChampionshipProgress) => p.total > 0 && p.decided >= p.total;

/** "12 of 34 events decided · day 4 of 13". Without `now` (cached share images), just the count. */
export function progressLine(progress: ChampionshipProgress, now: number | null) {
  const decided = `${progress.decided} of ${progress.total} events decided`;
  if (now === null || !progress.firstAt || !progress.lastAt) return decided;
  const when = festivalDay(now, progress.firstAt, progress.lastAt);
  if (when.phase === "before") return `${decided} · starts ${formatWAT(progress.firstAt, "date")}`;
  if (when.phase === "during") return `${decided} · day ${when.day} of ${when.days}`;
  return decided;
}

/** "Year 3 lead on golds.", "Level at the top.", "Year 3 are champions." */
export function raceHeadline(rows: MedalTableRow[], progress: ChampionshipProgress) {
  if (rows.length === 0 || !raceStarted(rows)) return "All five on the start line.";
  const [first, second] = rows;
  if (raceFinished(progress)) return `${first.team.name} are champions.`;
  if (second && second.position === 1) return "Level at the top.";
  return `${first.team.name} lead${first.rankBy === "points" ? " on points" : " on golds"}.`;
}

/** "5G 2S 1B" */
export const medalShort = (r: MedalTableRow) => `${r.gold}G ${r.silver}S ${r.bronze}B`;

/** How far down the track a year has run, as a % of the lane (9 at the start line). */
export function lanePercent(r: MedalTableRow, rows: MedalTableRow[], progress: ChampionshipProgress) {
  const top = Math.max(0, ...rows.map((x) => x.points));
  if (top === 0) return 9;
  return 9 + (r.points / top) * (raceFinished(progress) ? 80 : 72);
}
