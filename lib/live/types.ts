// Live scores: shared types.
//
// The contract between the live scores backend and the people who build on
// it: the console (Samuel), the match and sport pages (Fortune) and the
// fantasy engine (Mary). Safe to import from server and client code.
// Guide: docs/live-scores.md
import type { Database } from "@/lib/supabase/types";

type PublicEnums = Database["public"]["Enums"];

export type MatchEventType = PublicEnums["match_event_type"];
export type MatchPeriod = PublicEnums["match_period"];
export type FixtureStatus = PublicEnums["fixture_status"];
export type CardColour = PublicEnums["card_colour"];
export type LineupRole = PublicEnums["lineup_role"];
export type PlayerPosition = PublicEnums["player_position"];
export type ResultFormat = PublicEnums["result_format"];

// -----------------------------------------------------------------------------
// Console requests
// -----------------------------------------------------------------------------

/**
 * Fields every recorded event needs.
 *
 * - `clientEventId`: a UUID made on the phone when the button is tapped
 *   (`crypto.randomUUID()`). Sending the same event again (for example from
 *   the offline queue) is safe: the server returns the event it already has.
 * - `occurredAt`: when the official tapped, as an ISO string. Leave it out to
 *   use the server's time. The server never accepts a time in the future or
 *   before the previous event.
 */
type RecordEventBase = {
  fixtureId: string;
  clientEventId: string;
  occurredAt?: string;
};

/** One console action. The `type` decides which other fields are needed. */
export type RecordEventInput = RecordEventBase &
  (
    | { type: "period_start"; period: MatchPeriod }
    | { type: "period_end" }
    | {
        type: "goal";
        /** The team the goal counts for. For an own goal, the team that benefits. */
        teamId: string;
        /** Scorer. For an own goal, the opponent who put it in their own net. */
        scorerId?: string | null;
        assistId?: string | null;
        penalty?: boolean;
        ownGoal?: boolean;
        /** 1 for football. Basketball can use 2 or 3. */
        points?: 1 | 2 | 3;
      }
    | { type: "card"; teamId: string; playerId: string; colour: CardColour }
    | { type: "substitution"; teamId: string; playerOffId: string; playerOnId: string }
    | {
        type: "penalty_miss";
        teamId: string;
        takerId: string;
        /** The goalkeeper, when the penalty was saved. Leave out if it went wide. */
        savedById?: string | null;
      }
    | { type: "shootout_kick"; teamId: string; takerId?: string | null; scored: boolean }
    | { type: "man_of_the_match"; playerId: string }
    | { type: "full_time" }
    | {
        type: "walkover";
        /** The team awarded the match. Admin only. */
        teamId: string;
        /** The awarded score. Defaults to 3 (football: 3-0). */
        points?: number;
      }
  );

export type UndoEventInput = {
  clientEventId: string;
  /** Required for admin corrections; optional for the holder's undo. */
  reason?: string;
};

export type SetLineupInput = {
  fixtureId: string;
  teamId: string;
  starters: string[];
  bench: string[];
};

// -----------------------------------------------------------------------------
// Results and errors
// -----------------------------------------------------------------------------

/**
 * Error codes returned by the console actions. Most come straight from the
 * database (raised with the code in HINT). See docs/live-scores.md for when
 * each one happens.
 */
export const LIVE_ERROR_CODES = [
  // Who you are
  "not_signed_in",
  "not_official",
  "not_holder",
  "already_held",
  "holder_not_official",
  "admin_only",
  "forbidden",
  // The fixture
  "fixture_not_found",
  "fixture_closed",
  "teams_not_set",
  "wrong_format",
  "has_events",
  "derived_column",
  "derived_status",
  // The match state
  "invalid_state",
  "invalid_period",
  "needs_winner",
  "invalid_time",
  "too_old",
  // Players and lineups
  "wrong_team",
  "player_not_found",
  "player_left",
  "player_suspended",
  "player_banned",
  "invalid_lineup",
  "lineup_locked",
  "not_on_pitch",
  "not_in_lineup",
  "not_on_bench",
  "sent_off",
  "duplicate_motm",
  // Undo and corrections
  "event_not_found",
  "undo_not_allowed",
  "undo_expired",
  "undo_not_latest",
  "reason_required",
  "already_voided",
  "append_only",
  // Standings and knockouts (admin)
  "league_not_finished",
  "standings_tied",
  // Requests
  "invalid_input",
  "duplicate_id",
  // Not the caller's fault
  "unavailable",
  "unknown",
] as const;

export type LiveErrorCode = (typeof LIVE_ERROR_CODES)[number];

export type LiveError = {
  code: LiveErrorCode;
  /** A sentence that can be shown to the official as it is. */
  message: string;
  /**
   * True when sending the same request again later may work (network or
   * database busy). The offline queue keeps retryable actions and drops the
   * rest, showing the message.
   */
  retryable: boolean;
};

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: LiveError };

// -----------------------------------------------------------------------------
// What the backend returns
// -----------------------------------------------------------------------------

/** One row of match_events, in camelCase. Voided rows have `voidedAt` set. */
export type MatchEvent = {
  id: number;
  fixtureId: string;
  clientEventId: string;
  type: MatchEventType;
  period: MatchPeriod | null;
  teamId: string | null;
  playerId: string | null;
  otherPlayerId: string | null;
  card: CardColour | null;
  isPenalty: boolean;
  isOwnGoal: boolean;
  scored: boolean | null;
  points: number | null;
  occurredAt: string;
  recordedAt: string;
  voidedAt: string | null;
  voidReason: string | null;
};

export type TeamSummary = {
  id: string;
  name: string;
  shortName: string;
  year: number;
};

/** A fixture with everything the score header and live clock need. */
export type LiveFixture = {
  id: string;
  stage: string;
  status: FixtureStatus;
  kickoffAt: string | null;
  venue: string | null;
  matchdayId: string | null;
  consoleHolderId: string | null;
  home: TeamSummary | null;
  away: TeamSummary | null;
  homeScore: number | null;
  awayScore: number | null;
  homeShootout: number | null;
  awayShootout: number | null;
  winnerTeamId: string | null;
  currentPeriod: MatchPeriod | null;
  periodStartedAt: string | null;
  event: {
    id: string;
    name: string;
    periodMinutes: number | null;
    extraPeriodMinutes: number | null;
  };
  sport: { slug: string; name: string; resultFormat: ResultFormat };
};

/** One line of the match timeline, ready to display. */
export type TimelineEntry = {
  id: number;
  clientEventId: string;
  type: MatchEventType;
  period: MatchPeriod | null;
  teamId: string | null;
  teamShortName: string | null;
  playerId: string | null;
  playerName: string | null;
  otherPlayerId: string | null;
  otherPlayerName: string | null;
  card: CardColour | null;
  isPenalty: boolean;
  isOwnGoal: boolean;
  scored: boolean | null;
  points: number | null;
  occurredAt: string;
  /** Match minute; null for penalties. Show as 25+2' when addedMinutes > 0. */
  minute: number | null;
  addedMinutes: number | null;
};

/** A player in a fixture's lineup, with their state in the match so far. */
export type LineupPlayer = {
  playerId: string;
  teamId: string;
  name: string;
  position: PlayerPosition;
  shirtNumber: number | null;
  role: LineupRole;
  appeared: boolean;
  onPitch: boolean;
  sentOff: boolean;
  yellowCards: number;
};

// -----------------------------------------------------------------------------
// Derived football data (phase 2): read with lib/live/stats.ts
// -----------------------------------------------------------------------------

/**
 * One row per player per fixture, worked out from match_events and lineups.
 * The fantasy engine reads only this. Rule values (30 minutes, points per
 * goal and so on) are not applied here; they live in the fantasy rules table.
 *
 * A row exists for everyone in the fixture's lineups and anyone named in an
 * event. Penalty shootout kicks never count.
 */
export type PlayerMatchStats = {
  fixtureId: string;
  eventId: string;
  matchdayId: string | null;
  playerId: string;
  teamId: string;
  position: PlayerPosition;
  /** False when the team had no lineup: minutes then assume the player started. */
  lineupSet: boolean;
  started: boolean;
  /** Started, or came on as a substitute, once the match kicked off. */
  appeared: boolean;
  /**
   * Match-clock minutes: half time and stoppage time don't count, extra time
   * does. Came on at 20' in a 50-minute match: 30. During a match, minutes
   * run up to the current clock minute.
   */
  minutesPlayed: number;
  goals: number;
  assists: number;
  ownGoals: number;
  /** Goals for the other team while this player was on the pitch (own goals by teammates included). */
  goalsConcededOnPitch: number;
  /** How many of goalsConcededOnPitch were own goals, for rules that leave them out. */
  ownGoalsConcededOnPitch: number;
  yellowCards: number;
  redCards: number;
  /** The red card came after a yellow in the same match (a second yellow). */
  redFromSecondYellow: boolean;
  penaltiesMissed: number;
  penaltiesSaved: number;
  manOfTheMatch: boolean;
  /** The fixture was a walkover: no player points. */
  walkover: boolean;
  /** True once the fixture is at full time (stats can still change after an admin correction). */
  fixtureFinished: boolean;
};

/** One row of the football league table. */
export type StandingRow = {
  position: number;
  /** Level with another team on every tie-breaker. */
  positionShared: boolean;
  team: TeamSummary;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  /** The team is playing now, so the row will change. */
  live: boolean;
};

export type TopScorerRow = {
  playerId: string;
  name: string;
  team: TeamSummary;
  goals: number;
  assists: number;
};

/** A player's totals for a football event, for the stats pages. */
export type PlayerTotalsRow = TopScorerRow & {
  position: PlayerPosition;
  appearances: number;
  minutesPlayed: number;
  ownGoals: number;
  /** Finished match, 30+ minutes on the pitch, nothing conceded while on it. */
  cleanSheets: number;
  yellowCards: number;
  redCards: number;
  manOfTheMatch: number;
};

/** A red card means a 1-match ban in the team's next fixture. */
export type SuspensionRow = {
  playerId: string;
  name: string;
  teamId: string;
  teamShortName: string;
  redCardFixtureId: string;
  /** Null until the team's next fixture is known (for example the final). */
  bannedFixtureId: string | null;
  bannedFixtureKickoffAt: string | null;
  banServed: boolean;
};
