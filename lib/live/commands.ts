// Live scores: checking console requests and turning them into database calls.
//
// Server actions receive whatever the browser sends, so every request is
// checked here before it reaches the database. The database checks the
// rules again (who holds the match, what the match state allows); this file
// only makes sure the request is well formed.
// Pure functions, safe on server and client.
import { Constants } from "@/lib/supabase/types";
import { liveError } from "./errors";
import type {
  ActionResult,
  CardColour,
  MatchEvent,
  MatchEventType,
  MatchPeriod,
  RaceEntrant,
  RaceResultInput,
  RecordEventInput,
  RecordRaceResultsInput,
  SetLineupInput,
  SetRaceEntriesInput,
  UndoEventInput,
} from "./types";

const MATCH_EVENT_TYPES: readonly string[] = Constants.public.Enums.match_event_type;
const MATCH_PERIODS: readonly string[] = Constants.public.Enums.match_period;
const CARD_COLOURS: readonly string[] = Constants.public.Enums.card_colour;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

type Parsed<T> = ActionResult<T>;

function invalid<T>(message: string): Parsed<T> {
  return { ok: false, error: liveError("invalid_input", message) };
}

function isMatchEventType(value: unknown): value is MatchEventType {
  return typeof value === "string" && MATCH_EVENT_TYPES.includes(value);
}

function isMatchPeriod(value: unknown): value is MatchPeriod {
  return typeof value === "string" && MATCH_PERIODS.includes(value);
}

function isCardColour(value: unknown): value is CardColour {
  return typeof value === "string" && CARD_COLOURS.includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalUuid(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || isUuid(value);
}

function optionalSide(value: unknown): value is "home" | "away" | null | undefined {
  return value === undefined || value === null || value === "home" || value === "away";
}

function optionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === "boolean";
}

// -----------------------------------------------------------------------------
// Record an event
// -----------------------------------------------------------------------------

/** Checks an unknown value is a well-formed RecordEventInput. */
export function parseRecordEventInput(input: unknown): Parsed<RecordEventInput> {
  if (!isRecord(input)) return invalid("The request is empty.");
  const { fixtureId, clientEventId, occurredAt, type } = input;

  if (!isUuid(fixtureId)) return invalid("fixtureId must be a UUID.");
  if (!isUuid(clientEventId)) return invalid("clientEventId must be a UUID.");
  if (occurredAt !== undefined) {
    if (typeof occurredAt !== "string" || Number.isNaN(Date.parse(occurredAt))) {
      return invalid("occurredAt must be an ISO date string.");
    }
  }
  if (!isMatchEventType(type)) return invalid("type is not a known match event type.");

  const base = { fixtureId, clientEventId, ...(occurredAt ? { occurredAt } : {}) };

  switch (type) {
    case "period_start": {
      const { period } = input;
      if (!isMatchPeriod(period)) return invalid("period_start needs a valid period.");
      return { ok: true, data: { ...base, type, period } };
    }
    case "period_end":
    case "set_end":
      return { ok: true, data: { ...base, type } };

    case "full_time": {
      const { winnerTeamId, winnerSide } = input;
      if (!optionalUuid(winnerTeamId)) return invalid("winnerTeamId must be a UUID.");
      if (!optionalSide(winnerSide)) return invalid("winnerSide must be home or away.");
      return {
        ok: true,
        data: { ...base, type, ...(winnerTeamId ? { winnerTeamId } : {}), ...(winnerSide ? { winnerSide } : {}) },
      };
    }

    case "point": {
      const { teamId, playerId, points, side, board } = input;
      if (!isUuid(teamId)) return invalid("A point needs teamId.");
      if (!optionalUuid(playerId)) return invalid("playerId must be a UUID.");
      if (points !== undefined && !(typeof points === "number" && Number.isInteger(points) && points >= 1 && points <= 99)) {
        return invalid("points must be a whole number from 1 to 99.");
      }
      if (!optionalSide(side)) return invalid("side must be home or away.");
      if (board != null && !(typeof board === "number" && Number.isInteger(board) && board >= 1 && board <= 4)) {
        return invalid("board must be 1 to 4.");
      }
      return {
        ok: true,
        data: {
          ...base,
          type,
          teamId,
          playerId,
          ...(points !== undefined ? { points } : {}),
          ...(side ? { side } : {}),
          ...(board != null ? { board } : {}),
        },
      };
    }

    case "goal": {
      const { teamId, scorerId, assistId, penalty, ownGoal, points } = input;
      if (!isUuid(teamId)) return invalid("A goal needs teamId.");
      if (!optionalUuid(scorerId) || !optionalUuid(assistId)) {
        return invalid("scorerId and assistId must be UUIDs.");
      }
      if (!optionalBoolean(penalty) || !optionalBoolean(ownGoal)) {
        return invalid("penalty and ownGoal must be true or false.");
      }
      const goalPoints =
        points === undefined ? undefined : points === 1 || points === 2 || points === 3 ? points : null;
      if (goalPoints === null) return invalid("points must be 1, 2 or 3.");
      if (ownGoal && (assistId || penalty)) {
        return invalid("An own goal has no assist and isn't a penalty.");
      }
      if (scorerId && scorerId === assistId) {
        return invalid("A player can't assist their own goal.");
      }
      return {
        ok: true,
        data: { ...base, type, teamId, scorerId, assistId, penalty, ownGoal, points: goalPoints },
      };
    }

    case "card": {
      const { teamId, playerId, colour } = input;
      if (!isUuid(teamId) || !isUuid(playerId)) return invalid("A card needs teamId and playerId.");
      if (!isCardColour(colour)) return invalid("colour must be yellow or red.");
      return { ok: true, data: { ...base, type, teamId, playerId, colour } };
    }

    case "substitution": {
      const { teamId, playerOffId, playerOnId } = input;
      if (!isUuid(teamId) || !isUuid(playerOffId) || !isUuid(playerOnId)) {
        return invalid("A substitution needs teamId, playerOffId and playerOnId.");
      }
      if (playerOffId === playerOnId) return invalid("A player can't replace themselves.");
      return { ok: true, data: { ...base, type, teamId, playerOffId, playerOnId } };
    }

    case "penalty_miss": {
      const { teamId, takerId, savedById } = input;
      if (!isUuid(teamId) || !isUuid(takerId)) return invalid("A missed penalty needs teamId and takerId.");
      if (!optionalUuid(savedById)) return invalid("savedById must be a UUID.");
      return { ok: true, data: { ...base, type, teamId, takerId, savedById } };
    }

    case "save": {
      const { teamId, playerId } = input;
      if (!isUuid(teamId) || !isUuid(playerId)) return invalid("A save needs teamId and the goalkeeper's playerId.");
      return { ok: true, data: { ...base, type, teamId, playerId } };
    }

    case "shootout_kick": {
      const { teamId, takerId, scored } = input;
      if (!isUuid(teamId)) return invalid("A shootout kick needs teamId.");
      if (!optionalUuid(takerId)) return invalid("takerId must be a UUID.");
      if (typeof scored !== "boolean") return invalid("scored must be true or false.");
      return { ok: true, data: { ...base, type, teamId, takerId, scored } };
    }

    case "man_of_the_match": {
      if (!isUuid(input.playerId)) return invalid("Man of the Match needs playerId.");
      return { ok: true, data: { ...base, type, playerId: input.playerId } };
    }

    case "walkover": {
      const { teamId, points } = input;
      if (!isUuid(teamId)) return invalid("A walkover needs the awarded teamId.");
      const awarded =
        points === undefined
          ? undefined
          : typeof points === "number" && Number.isInteger(points) && points >= 1 && points <= 99
            ? points
            : null;
      if (awarded === null) return invalid("points must be a whole number from 1 to 99.");
      return { ok: true, data: { ...base, type, teamId, points: awarded } };
    }

    default:
      return invalid("type is not a known match event type.");
  }
}

/**
 * Arguments for the record_match_event database function. Fields that are
 * not needed are left out (not null), so the database uses its defaults.
 */
export type RecordEventRpcArgs = {
  p_fixture_id: string;
  p_client_event_id: string;
  p_type: RecordEventInput["type"];
  p_occurred_at?: string;
  p_period?: Extract<RecordEventInput, { type: "period_start" }>["period"];
  p_team_id?: string;
  p_player_id?: string;
  p_other_player_id?: string;
  p_card?: Extract<RecordEventInput, { type: "card" }>["colour"];
  p_is_penalty?: boolean;
  p_is_own_goal?: boolean;
  p_scored?: boolean;
  p_points?: number;
  p_side?: "home" | "away";
  p_board?: number;
};

export function toRecordEventArgs(input: RecordEventInput): RecordEventRpcArgs {
  const args: RecordEventRpcArgs = {
    p_fixture_id: input.fixtureId,
    p_client_event_id: input.clientEventId,
    p_type: input.type,
  };
  if (input.occurredAt) args.p_occurred_at = input.occurredAt;

  // The database stores every event in the same columns:
  // player_id is the main player, other_player_id the second one.
  switch (input.type) {
    case "period_start":
      args.p_period = input.period;
      break;
    case "goal":
      args.p_team_id = input.teamId;
      if (input.scorerId) args.p_player_id = input.scorerId;
      if (input.assistId) args.p_other_player_id = input.assistId;
      if (input.penalty) args.p_is_penalty = true;
      if (input.ownGoal) args.p_is_own_goal = true;
      if (input.points) args.p_points = input.points;
      break;
    case "card":
      args.p_team_id = input.teamId;
      args.p_player_id = input.playerId;
      args.p_card = input.colour;
      break;
    case "substitution":
      args.p_team_id = input.teamId;
      args.p_player_id = input.playerOffId;
      args.p_other_player_id = input.playerOnId;
      break;
    case "penalty_miss":
      args.p_team_id = input.teamId;
      args.p_player_id = input.takerId;
      if (input.savedById) args.p_other_player_id = input.savedById;
      break;
    case "save":
      args.p_team_id = input.teamId;
      args.p_player_id = input.playerId;
      break;
    case "shootout_kick":
      args.p_team_id = input.teamId;
      if (input.takerId) args.p_player_id = input.takerId;
      args.p_scored = input.scored;
      break;
    case "man_of_the_match":
      args.p_player_id = input.playerId;
      break;
    case "walkover":
      args.p_team_id = input.teamId;
      if (input.points) args.p_points = input.points;
      break;
    case "point":
      args.p_team_id = input.teamId;
      if (input.playerId) args.p_player_id = input.playerId;
      if (input.points) args.p_points = input.points;
      if (input.side) args.p_side = input.side;
      if (input.board) args.p_board = input.board;
      break;
    case "full_time":
      if (input.winnerTeamId) args.p_team_id = input.winnerTeamId;
      if (input.winnerSide) args.p_side = input.winnerSide;
      break;
    case "period_end":
    case "set_end":
      break;
  }
  return args;
}

// -----------------------------------------------------------------------------
// Undo, lineups, take and release
// -----------------------------------------------------------------------------

export function parseUndoEventInput(input: unknown): Parsed<UndoEventInput> {
  if (!isRecord(input)) return invalid("The request is empty.");
  const { clientEventId, reason } = input;
  if (!isUuid(clientEventId)) return invalid("clientEventId must be a UUID.");
  if (reason !== undefined && (typeof reason !== "string" || reason.length > 500)) {
    return invalid("reason must be text of at most 500 characters.");
  }
  return { ok: true, data: { clientEventId, ...(reason ? { reason } : {}) } };
}

export function parseSetLineupInput(input: unknown): Parsed<SetLineupInput> {
  if (!isRecord(input)) return invalid("The request is empty.");
  const { fixtureId, teamId, starters, bench } = input;
  if (!isUuid(fixtureId) || !isUuid(teamId)) return invalid("fixtureId and teamId must be UUIDs.");
  if (!Array.isArray(starters) || !starters.every(isUuid)) return invalid("starters must be a list of player IDs.");
  if (!Array.isArray(bench) || !bench.every(isUuid)) return invalid("bench must be a list of player IDs.");
  if (starters.length < 1 || starters.length > 11) return invalid("Pick between 1 and 11 starters.");
  if (bench.length > 30) return invalid("The bench is too long.");
  return { ok: true, data: { fixtureId, teamId, starters, bench } };
}

// -----------------------------------------------------------------------------
// Races
// -----------------------------------------------------------------------------

const RACE_OUTCOMES: readonly string[] = Constants.public.Enums.race_outcome;

function isWholeNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function optionalName(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || (typeof value === "string" && value.trim().length <= 80);
}

/** The JSON shape the race functions take (camelCase keys, nulls left out). */
type RaceJson = Record<string, string | number>;

function entrantJson(entrant: RaceEntrant): RaceJson {
  const json: RaceJson = { teamId: entrant.teamId };
  if (entrant.athleteName?.trim()) json.athleteName = entrant.athleteName.trim();
  if (entrant.playerId) json.playerId = entrant.playerId;
  return json;
}

function parseEntrant(value: Record<string, unknown>): string | null {
  const { teamId, athleteName, playerId } = value;
  if (!isUuid(teamId)) return "Each entrant needs teamId.";
  if (!optionalName(athleteName)) return "athleteName must be text of at most 80 characters.";
  if (!optionalUuid(playerId)) return "playerId must be a UUID.";
  if (playerId && typeof athleteName === "string" && athleteName.trim()) {
    return "Give playerId or athleteName, not both.";
  }
  return null;
}

export function parseSetRaceEntriesInput(input: unknown): Parsed<SetRaceEntriesInput> {
  if (!isRecord(input)) return invalid("The request is empty.");
  const { fixtureId, entries } = input;
  if (!isUuid(fixtureId)) return invalid("fixtureId must be a UUID.");
  if (!Array.isArray(entries) || entries.length === 0) return invalid("Add at least one entrant.");
  if (entries.length > 40) return invalid("A race can have at most 40 entrants.");
  for (const entry of entries) {
    if (!isRecord(entry)) return invalid("Each entrant must be an object.");
    const problem = parseEntrant(entry);
    if (problem) return invalid(problem);
    if (entry.lane !== undefined && entry.lane !== null && !isWholeNumber(entry.lane, 1, 20)) {
      return invalid("lane must be a whole number from 1 to 20.");
    }
  }
  return { ok: true, data: { fixtureId, entries: entries as SetRaceEntriesInput["entries"] } };
}

export function parseRecordRaceResultsInput(input: unknown): Parsed<RecordRaceResultsInput> {
  if (!isRecord(input)) return invalid("The request is empty.");
  const { fixtureId, results, publish } = input;
  if (!isUuid(fixtureId)) return invalid("fixtureId must be a UUID.");
  if (!Array.isArray(results)) return invalid("results must be a list.");
  if (results.length > 40) return invalid("A race can have at most 40 results.");
  if (!optionalBoolean(publish)) return invalid("publish must be true or false.");
  for (const result of results) {
    if (!isRecord(result)) return invalid("Each result must be an object.");
    const problem = parseEntrant(result);
    if (problem) return invalid(problem);
    const { outcome, position, timeMs, markMm, note } = result;
    if (typeof outcome !== "string" || !RACE_OUTCOMES.includes(outcome)) {
      return invalid("outcome must be finished, dnf, dns or dq.");
    }
    const hasPosition = position !== undefined && position !== null;
    if (outcome === "finished" && !isWholeNumber(position, 1, 99)) return invalid("A finisher needs a place from 1 to 99.");
    if (outcome !== "finished" && hasPosition) return invalid("Only finishers have a place.");
    if (timeMs !== undefined && timeMs !== null && !isWholeNumber(timeMs, 1, 86_400_000)) {
      return invalid("timeMs must be a positive whole number of milliseconds.");
    }
    if (markMm !== undefined && markMm !== null && !isWholeNumber(markMm, 1, 1_000_000)) {
      return invalid("markMm must be a positive whole number of millimetres.");
    }
    if (note !== undefined && note !== null && (typeof note !== "string" || note.length > 200)) {
      return invalid("note must be text of at most 200 characters.");
    }
  }
  return {
    ok: true,
    data: { fixtureId, results: results as RaceResultInput[], ...(publish ? { publish: true } : {}) },
  };
}

/** The p_entries argument of set_race_entries. */
export function toRaceEntriesJson(entries: SetRaceEntriesInput["entries"]): RaceJson[] {
  return entries.map((entry) => {
    const json = entrantJson(entry);
    if (entry.lane) json.lane = entry.lane;
    return json;
  });
}

/** The p_results argument of record_race_results. */
export function toRaceResultsJson(results: RaceResultInput[]): RaceJson[] {
  return results.map((result) => {
    const json = entrantJson(result);
    json.outcome = result.outcome;
    if (result.outcome === "finished" && result.position) json.position = result.position;
    if (result.timeMs) json.timeMs = result.timeMs;
    if (result.markMm) json.markMm = result.markMm;
    if (result.note?.trim()) json.note = result.note.trim();
    return json;
  });
}

export function parseFixtureId(input: unknown): Parsed<string> {
  return isUuid(input) ? { ok: true, data: input } : invalid("fixtureId must be a UUID.");
}

// -----------------------------------------------------------------------------
// Mapping database rows
// -----------------------------------------------------------------------------

/** The match_events columns the app reads. */
export type MatchEventRow = {
  id: number;
  fixture_id: string;
  client_event_id: string;
  type: MatchEvent["type"];
  period: MatchEvent["period"];
  team_id: string | null;
  player_id: string | null;
  other_player_id: string | null;
  card: MatchEvent["card"];
  is_penalty: boolean;
  is_own_goal: boolean;
  scored: boolean | null;
  points: number | null;
  side?: string | null;
  board?: number | null;
  occurred_at: string;
  recorded_at: string;
  voided_at: string | null;
  void_reason: string | null;
};

export function toMatchEvent(row: MatchEventRow): MatchEvent {
  return {
    id: row.id,
    fixtureId: row.fixture_id,
    clientEventId: row.client_event_id,
    type: row.type,
    period: row.period,
    teamId: row.team_id,
    playerId: row.player_id,
    otherPlayerId: row.other_player_id,
    card: row.card,
    isPenalty: row.is_penalty,
    isOwnGoal: row.is_own_goal,
    scored: row.scored,
    points: row.points,
    side: row.side === "home" || row.side === "away" ? row.side : null,
    board: row.board ?? null,
    occurredAt: row.occurred_at,
    recordedAt: row.recorded_at,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
  };
}
