import type { FixtureState } from "./live-state-types";
import type { ResultFormat, TeamSummary } from "./types";

/** A fixture as lists and cards show it. `state` is the live part. */
export type FixtureCard = {
  id: string;
  stage: string;
  kickoffAt: string | null;
  venue: string | null;
  matchdayNumber: number | null;
  home: TeamSummary | null;
  away: TeamSummary | null;
  event: { id: string; name: string; periodMinutes: number | null; extraPeriodMinutes: number | null };
  sport: { slug: string; name: string; resultFormat: ResultFormat; sortOrder: number };
  state: FixtureState;
};
