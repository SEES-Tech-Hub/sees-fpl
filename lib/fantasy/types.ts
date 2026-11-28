// Owner: Henry (fantasy frontend). Shared types for the fantasy screens and the
// backend contract in docs/fantasy-backend-contract.md. Mary's RPCs return these
// shapes; if a shape changes, change it here and in the contract together.

import type { Database } from "@/lib/supabase/types";

type Enums = Database["public"]["Enums"];

export type Position = Enums["player_position"]; // "GK" | "DEF" | "MID" | "FWD"
export type PlayerStatus = Enums["player_status"];
export type MatchdayStatus = Enums["matchday_status"];
export type FixtureStatus = Enums["fixture_status"];

export const POSITIONS: readonly Position[] = ["GK", "DEF", "MID", "FWD"] as const;

/** Money is always in tenths of a million naira, as in players.price_tenths (55 = ₦5.5m). */
export type Tenths = number;

// ---------------------------------------------------------------------------
// Rules (F1). Read from Mary's rules config table. Never hard-code these.
// ---------------------------------------------------------------------------

export type PositionRange = { min: number; max: number };

export type ScoringKey =
  | "appeared"
  | "played_30"
  | "goal"
  | "assist"
  | "clean_sheet"
  | "goals_conceded_2"
  | "penalty_saved"
  | "saves"
  | "penalty_missed"
  | "yellow_card"
  | "red_card"
  | "own_goal"
  | "man_of_the_match";

export type ScoringRule = {
  key: ScoringKey;
  label: string;
  /** Points per position. */
  points: Record<Position, number>;
  /** Short clarification shown on the rules page, e.g. "30+ min on the pitch". */
  note?: string;
};

export type FantasyRules = {
  budgetTenths: Tenths;
  squadSize: number;
  /** Exact number of each position in the 15-man squad. */
  squadPositions: Record<Position, number>;
  maxPerTeam: number;
  startingSize: number;
  /** Allowed count per position in the starting XI. */
  formation: Record<Position, PositionRange>;
  benchSize: number;
  captainMultiplier: number;
  freeTransfersPerMatchday: number;
  maxSavedFreeTransfers: number;
  transferHitPoints: number;
  /** Matchday numbers with unlimited free transfers (before MD1 and MD6). */
  unlimitedTransferMatchdays: number[];
  wildcardsPerManager: number;
  deadlineMinutesBeforeKickoff: number;
  leagueCodeLength: number;
  teamNameMaxLength: number;
  scoring: ScoringRule[];
};

// ---------------------------------------------------------------------------
// Reference data (real tables: teams, players, matchdays, fixtures)
// ---------------------------------------------------------------------------

export type Team = {
  id: string;
  year: number;
  name: string;
  shortName: string;
  classLabel: string;
};

export type Player = {
  id: string;
  teamId: string;
  teamShort: string;
  teamYear: number;
  displayName: string;
  fullName: string;
  position: Position;
  priceTenths: Tenths;
  status: PlayerStatus;
  shirtNumber: number | null;
  /** Fantasy points so far (Mary). 0 until the backend is live. */
  totalPoints: number;
  /** Share of managers who own the player, 0–100 (Mary). */
  selectedByPct: number;
  /** The player's face (public/players/<id>.webp), or null: show the year crest. */
  photoUrl: string | null;
  /** The team's next fantasy match that hasn't kicked off, for the player card. */
  nextMatch: { opponentShort: string | null; kickoffAt: string } | null;
};

export type Fixture = {
  id: string;
  matchdayId: string | null;
  stage: string;
  kickoffAt: string | null;
  status: FixtureStatus;
  venue: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeShort: string | null;
  awayShort: string | null;
  homeScore: number | null;
  awayScore: number | null;
};

export type Matchday = {
  id: string;
  number: number;
  name: string;
  deadlineAt: string | null;
  status: MatchdayStatus;
  fixtures: Fixture[];
};

/**
 * `next` is the matchday picks are being made for (its deadline hasn't passed).
 * `current` is the latest matchday whose deadline has passed (live or finished).
 */
export type MatchdayState = {
  matchdays: Matchday[];
  next: Matchday | null;
  current: Matchday | null;
  /** The server's clock (ms) when this was read, so countdowns can correct a wrong phone clock. */
  serverNow: number;
};

// ---------------------------------------------------------------------------
// Manager, squad and lineup (F2, F3, F4)
// ---------------------------------------------------------------------------

export type Manager = {
  id: string;
  teamName: string;
  managerName: string;
  yearGroup: number | null;
  createdAt: string;
};

/**
 * Slots 1–11 are the starting XI. Slot 12 is the bench goalkeeper.
 * Slots 13–15 are the outfield bench in auto-sub order.
 */
export type Pick = {
  playerId: string;
  slot: number;
  isCaptain: boolean;
  isViceCaptain: boolean;
};

export type MyTeam = {
  matchdayId: string;
  matchdayNumber: number;
  picks: Pick[];
  bankTenths: Tenths;
  squadValueTenths: Tenths;
  /** True once the matchday's deadline has passed: the picks are a snapshot. */
  locked: boolean;
};

export type LineupInput = {
  /** 11 player ids. */
  starters: string[];
  /** 4 player ids: [bench GK, outfield 1, outfield 2, outfield 3]. */
  bench: string[];
  captainId: string;
  viceCaptainId: string;
};

// ---------------------------------------------------------------------------
// Transfers and Wildcard (F7, F8)
// ---------------------------------------------------------------------------

export type TransferState = {
  matchdayId: string;
  matchdayNumber: number;
  /** null means unlimited (before MD1, before MD6, or Wildcard active). */
  freeTransfers: number | null;
  /** Transfers already made for this matchday. */
  made: number;
  /** Points already deducted for this matchday, as a positive number (e.g. 4). */
  costPoints: number;
  bankTenths: Tenths;
  wildcard: {
    available: boolean;
    activeThisMatchday: boolean;
    usedOnMatchday: number | null;
  };
  locked: boolean;
};

export type TransferInput = {
  /** Player ids leaving. Same length as `in`, matched by index and position. */
  out: string[];
  in: string[];
};

export type TransferRecord = {
  matchdayNumber: number;
  outPlayerId: string;
  inPlayerId: string;
  madeAt: string;
};

// ---------------------------------------------------------------------------
// Points (F5, F6). Calculated only by Mary's engine.
// ---------------------------------------------------------------------------

export type PointsItem = {
  key: ScoringKey;
  label: string;
  /** How many times it happened (goals, minutes band = 1, conceded pairs). */
  count: number;
  points: number;
};

export type PlayerPoints = {
  playerId: string;
  displayName: string;
  position: Position;
  teamShort: string;
  slot: number;
  /** 0 = stayed on the bench, 1 = counted, 2 = captain (or vice standing in). */
  multiplier: number;
  isCaptain: boolean;
  isViceCaptain: boolean;
  autoSubIn: boolean;
  autoSubOut: boolean;
  minutes: number;
  /** null when the player's team had no match (or a walkover). */
  fixtureLabel: string | null;
  items: PointsItem[];
  /** Points before the multiplier. */
  basePoints: number;
  /** Points that count for the manager: basePoints × multiplier. */
  totalPoints: number;
};

export type ManagerMatchdayPoints = {
  managerId: string;
  teamName: string;
  matchdayId: string;
  matchdayNumber: number;
  /** Points from the final XI, before transfer costs. */
  pointsBeforeCost: number;
  transferCost: number;
  total: number;
  provisional: boolean;
  wildcardPlayed: boolean;
  /** Average and highest manager total this matchday (design system §11.3 points hero). */
  averagePoints: number | null;
  highestPoints: number | null;
  /** Overall rank after this matchday and before it (null before the first). */
  overallRank: number | null;
  previousOverallRank: number | null;
  players: PlayerPoints[];
};

export type MatchdayHistoryRow = {
  matchdayNumber: number;
  points: number;
  transferCost: number;
  overallRank: number | null;
  provisional: boolean;
};

// ---------------------------------------------------------------------------
// Rankings and leagues (F6, F8)
// ---------------------------------------------------------------------------

export type RankingScope = { kind: "overall" } | { kind: "year"; year: number };

export type RankingRow = {
  rank: number;
  managerId: string;
  teamName: string;
  managerName: string;
  yearGroup: number | null;
  totalPoints: number;
  lastMatchdayPoints: number;
};

export type RankingPage = {
  rows: RankingRow[];
  page: number;
  pageSize: number;
  totalManagers: number;
  me: RankingRow | null;
  provisional: boolean;
};

export type League = {
  id: string;
  name: string;
  code: string;
  memberCount: number;
  isOwner: boolean;
  myRank: number | null;
};

export type LeagueStandings = {
  league: League;
  rows: RankingRow[];
  provisional: boolean;
};

// ---------------------------------------------------------------------------
// Write results
// ---------------------------------------------------------------------------

export type FantasyErrorCode =
  | "NOT_SIGNED_IN"
  | "NO_MANAGER"
  | "MANAGER_EXISTS"
  | "TEAM_NAME_INVALID"
  | "YEAR_GROUP_INVALID"
  | "NO_OPEN_MATCHDAY"
  | "DEADLINE_PASSED"
  | "SQUAD_EXISTS"
  | "NO_SQUAD"
  | "SQUAD_SIZE"
  | "SQUAD_POSITIONS"
  | "OVER_BUDGET"
  | "TEAM_LIMIT"
  | "PLAYER_UNKNOWN"
  | "PLAYER_UNAVAILABLE"
  | "PLAYER_DUPLICATE"
  | "LINEUP_NOT_IN_SQUAD"
  | "FORMATION_INVALID"
  | "BENCH_GK_INVALID"
  | "CAPTAIN_INVALID"
  | "TRANSFER_INVALID"
  | "TRANSFER_POSITION"
  | "WILDCARD_USED"
  | "WILDCARD_NOT_ALLOWED"
  | "LEAGUE_NAME_INVALID"
  | "LEAGUE_CODE_INVALID"
  | "LEAGUE_NOT_FOUND"
  | "LEAGUE_ALREADY_MEMBER"
  | "UNKNOWN";

export type FantasyError = {
  code: FantasyErrorCode;
  message: string;
  /** Optional ids the UI can highlight, e.g. the players breaking a rule. */
  playerIds?: string[];
};

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: FantasyError };
