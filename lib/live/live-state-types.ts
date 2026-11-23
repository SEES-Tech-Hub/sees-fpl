import type { FixtureStatus, MatchPeriod } from "./types";

/** The parts of a fixture that change during a match, as the live endpoints send them. */
export type FixtureState = {
  id: string;
  status: FixtureStatus;
  kickoffAt: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeShootout: number | null;
  awayShootout: number | null;
  winnerTeamId: string | null;
  currentPeriod: MatchPeriod | null;
  periodStartedAt: string | null;
  currentSet: number | null;
  homeSetPoints: number | null;
  awaySetPoints: number | null;
  updatedAt: string;
};
