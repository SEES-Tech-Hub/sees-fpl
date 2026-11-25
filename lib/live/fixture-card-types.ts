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
  /** Player-vs-player events: the players' names (home and away are their years). */
  homeEntrant: string | null;
  awayEntrant: string | null;
  /** The match label from the schedule ("M1", "QF2") and, for two-leg ties, the leg. */
  tie: string | null;
  leg: number | null;
  event: {
    id: string;
    name: string;
    periodMinutes: number | null;
    extraPeriodMinutes: number | null;
    /** Board games: boards per match. Scores are board points doubled (a win is 2). */
    boards: number | null;
  };
  sport: { slug: string; name: string; resultFormat: ResultFormat; sortOrder: number };
  state: FixtureState;
};
