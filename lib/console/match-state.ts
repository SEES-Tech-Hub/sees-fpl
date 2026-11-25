// Match console: the match as the official's phone sees it.
//
// The console must keep working offline: after "Kick off" the Goal button has
// to appear, and after a substitution the new player has to be on the pitch,
// even if neither action has reached the server yet. So the console works the
// match state out itself from the event log: the server's events, plus the
// events waiting in the offline queue, minus anything undone. It folds them
// with the same rules as the database's refresh_fixture_state() and
// fixture_player_state().
//
// availableControls() then says which buttons to show, following the rules
// in record_match_event() (supabase/migrations/*_live_record_event_wording.sql).
// The server checks everything again, so a mismatch here shows an error
// message rather than recording something wrong.
//
// Pure functions, safe on server and client. Tests: match-state.test.ts.
import type {
  CardColour,
  FixtureStatus,
  LineupRole,
  MatchEventType,
  MatchPeriod,
  RecordEventInput,
  TimelineEntry,
} from "@/lib/live/types";

/** One event, from the server's timeline or from the offline queue. */
export type ConsoleEvent = {
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
  /** Head-to-head: home or away (two players from one year), and the board for board games. */
  side?: "home" | "away" | null;
  board?: number | null;
  occurredAt: string;
  /** Not confirmed by the server yet. */
  pending: boolean;
};

export type PlayerState = {
  playerId: string;
  teamId: string;
  role: LineupRole;
  appeared: boolean;
  onPitch: boolean;
  sentOff: boolean;
  yellowCards: number;
};

export type LineupEntry = { playerId: string; teamId: string; role: LineupRole };

export type MatchInput = {
  homeTeamId: string;
  awayTeamId: string;
  /** Any stage other than "league" (final, third_place). */
  isKnockout: boolean;
  /** The server's status. Postponed and cancelled come only from here. */
  serverStatus: FixtureStatus;
  /** Both teams' lineups (each team's newest, including one waiting to send). */
  lineups: LineupEntry[];
  /** Active events in order. */
  events: ConsoleEvent[];
};

export type MatchState = {
  status: FixtureStatus;
  currentPeriod: MatchPeriod | null;
  periodStartedAt: string | null;
  homeScore: number;
  awayScore: number;
  homeShootout: number | null;
  awayShootout: number | null;
  isKnockout: boolean;
  homeTeamId: string;
  awayTeamId: string;
  motmPlayerId: string | null;
  hasLineup: { home: boolean; away: boolean };
  players: Map<string, PlayerState>;
};

// -----------------------------------------------------------------------------
// Turning server and queue data into ConsoleEvents
// -----------------------------------------------------------------------------

export function fromTimelineEntry(entry: TimelineEntry): ConsoleEvent {
  return {
    clientEventId: entry.clientEventId,
    type: entry.type,
    period: entry.period,
    teamId: entry.teamId,
    playerId: entry.playerId,
    otherPlayerId: entry.otherPlayerId,
    card: entry.card,
    isPenalty: entry.isPenalty,
    isOwnGoal: entry.isOwnGoal,
    scored: entry.scored,
    points: entry.points,
    occurredAt: entry.occurredAt,
    pending: false,
  };
}

/** An event the official tapped, as it will look once the server has it. */
export function fromRecordInput(input: RecordEventInput, pending: boolean): ConsoleEvent {
  const event: ConsoleEvent = {
    clientEventId: input.clientEventId,
    type: input.type,
    period: null,
    teamId: null,
    playerId: null,
    otherPlayerId: null,
    card: null,
    isPenalty: false,
    isOwnGoal: false,
    scored: null,
    points: null,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    pending,
  };
  switch (input.type) {
    case "period_start":
      event.period = input.period;
      break;
    case "goal":
      event.teamId = input.teamId;
      event.playerId = input.scorerId ?? null;
      event.otherPlayerId = input.assistId ?? null;
      event.isPenalty = input.penalty ?? false;
      event.isOwnGoal = input.ownGoal ?? false;
      event.points = input.points ?? 1;
      break;
    case "card":
      event.teamId = input.teamId;
      event.playerId = input.playerId;
      event.card = input.colour;
      break;
    case "substitution":
      event.teamId = input.teamId;
      event.playerId = input.playerOffId;
      event.otherPlayerId = input.playerOnId;
      break;
    case "penalty_miss":
      event.teamId = input.teamId;
      event.playerId = input.takerId;
      event.otherPlayerId = input.savedById ?? null;
      break;
    case "shootout_kick":
      event.teamId = input.teamId;
      event.playerId = input.takerId ?? null;
      event.scored = input.scored;
      break;
    case "man_of_the_match":
      event.playerId = input.playerId;
      break;
    case "walkover":
      event.teamId = input.teamId;
      event.points = input.points ?? 3;
      break;
    case "point":
      event.teamId = input.teamId;
      event.points = input.points ?? 1;
      event.side = input.side ?? null;
      event.board = input.board ?? null;
      break;
    case "full_time":
      event.teamId = input.winnerTeamId ?? null;
      event.side = input.winnerSide ?? null;
      break;
    case "period_end":
    case "set_end":
      break;
  }
  return event;
}

/**
 * The console's event log: server events, then events the server confirmed
 * that the timeline hasn't caught up with yet, then queued events. Anything
 * undone on this phone is left out. Each clientEventId appears once.
 */
export function mergeEvents(
  server: ConsoleEvent[],
  confirmed: ConsoleEvent[],
  queued: ConsoleEvent[],
  undone: ReadonlySet<string>,
): ConsoleEvent[] {
  const seen = new Set<string>();
  const merged: ConsoleEvent[] = [];
  for (const event of [...server, ...confirmed, ...queued]) {
    if (seen.has(event.clientEventId) || undone.has(event.clientEventId)) continue;
    seen.add(event.clientEventId);
    merged.push(event);
  }
  return merged;
}

// -----------------------------------------------------------------------------
// Folding the events into a match state
// -----------------------------------------------------------------------------

export function deriveMatchState(input: MatchInput): MatchState {
  const state: MatchState = {
    status: "scheduled",
    currentPeriod: null,
    periodStartedAt: null,
    homeScore: 0,
    awayScore: 0,
    homeShootout: null,
    awayShootout: null,
    isKnockout: input.isKnockout,
    homeTeamId: input.homeTeamId,
    awayTeamId: input.awayTeamId,
    motmPlayerId: null,
    hasLineup: {
      home: input.lineups.some((p) => p.teamId === input.homeTeamId),
      away: input.lineups.some((p) => p.teamId === input.awayTeamId),
    },
    players: new Map(),
  };

  for (const entry of input.lineups) {
    state.players.set(entry.playerId, {
      playerId: entry.playerId,
      teamId: entry.teamId,
      role: entry.role,
      appeared: false,
      onPitch: entry.role === "starter",
      sentOff: false,
      yellowCards: 0,
    });
  }

  const isHome = (teamId: string | null) => teamId === input.homeTeamId;

  for (const event of input.events) {
    switch (event.type) {
      case "period_start":
        if (state.status === "scheduled") {
          for (const p of state.players.values()) if (p.role === "starter") p.appeared = true;
        }
        state.status = "live";
        state.currentPeriod = event.period;
        state.periodStartedAt = event.occurredAt;
        if (event.period === "penalties") {
          state.homeShootout = 0;
          state.awayShootout = 0;
        }
        break;
      case "period_end":
        state.status = "half_time";
        break;
      case "full_time":
        state.status = "full_time";
        break;
      case "walkover":
        state.status = "walkover";
        if (isHome(event.teamId)) state.homeScore = event.points ?? 3;
        else state.awayScore = event.points ?? 3;
        break;
      case "goal":
        if (isHome(event.teamId)) state.homeScore += event.points ?? 1;
        else state.awayScore += event.points ?? 1;
        break;
      case "shootout_kick":
        if (!event.scored) break;
        if (isHome(event.teamId)) state.homeShootout = (state.homeShootout ?? 0) + 1;
        else state.awayShootout = (state.awayShootout ?? 0) + 1;
        break;
      case "card": {
        const player = event.playerId ? state.players.get(event.playerId) : undefined;
        if (!player) break;
        if (event.card === "yellow") player.yellowCards += 1;
        else {
          player.sentOff = true;
          player.onPitch = false;
        }
        break;
      }
      case "substitution": {
        const off = event.playerId ? state.players.get(event.playerId) : undefined;
        const on = event.otherPlayerId ? state.players.get(event.otherPlayerId) : undefined;
        if (off) off.onPitch = false;
        if (on) {
          on.onPitch = true;
          on.appeared = true;
        }
        break;
      }
      case "man_of_the_match":
        state.motmPlayerId = event.playerId;
        break;
      case "penalty_miss":
        break;
    }
  }

  // Postponed and cancelled are set by the admin, not by events.
  if (input.serverStatus === "postponed" || input.serverStatus === "cancelled") {
    state.status = input.serverStatus;
  }
  return state;
}

// -----------------------------------------------------------------------------
// Which buttons to show
// -----------------------------------------------------------------------------

export type PeriodCommand =
  | { type: "period_start"; period: MatchPeriod }
  | { type: "period_end" }
  | { type: "full_time" };

export type PeriodButton = { key: string; label: string; command: PeriodCommand };

export type Controls = {
  phase: "not_started" | "in_play" | "break" | "penalties" | "finished" | "closed";
  /** Kick off, Half time, Full time and so on, most likely first. */
  periodButtons: PeriodButton[];
  canGoal: boolean;
  canPenaltyMiss: boolean;
  canCard: boolean;
  canSub: boolean;
  canShootout: boolean;
  canMotm: boolean;
};

const start = (period: MatchPeriod, label: string): PeriodButton => ({
  key: `start:${period}`,
  label,
  command: { type: "period_start", period },
});
const END = (label: string): PeriodButton => ({ key: "end", label, command: { type: "period_end" } });
const FULL_TIME: PeriodButton = { key: "full_time", label: "Full time", command: { type: "full_time" } };

/** How the event's match is split: football and handball halves, basketball quarters. */
export type PeriodRules = {
  /** 2 halves (default) or 4 quarters. */
  periodCount?: number | null;
  /** False when a level knockout goes straight to penalties (handball's 7-metre throws). */
  hasExtraTime?: boolean;
};

export function availableControls(state: MatchState, rules: PeriodRules = {}): Controls {
  if (rules.periodCount === 4) return quarterControls(state);
  const hasExtraTime = rules.hasExtraTime ?? true;
  const none: Controls = {
    phase: "closed",
    periodButtons: [],
    canGoal: false,
    canPenaltyMiss: false,
    canCard: false,
    canSub: false,
    canShootout: false,
    canMotm: false,
  };
  const level = state.homeScore === state.awayScore;
  const knockoutLevel = state.isKnockout && level;
  const period = state.currentPeriod;

  switch (state.status) {
    case "postponed":
    case "cancelled":
    case "walkover":
      return none;

    case "scheduled":
      return { ...none, phase: "not_started", periodButtons: [start("first_half", "Kick off")] };

    case "full_time":
      return { ...none, phase: "finished", canMotm: state.motmPlayerId === null };

    case "live": {
      if (period === "penalties") {
        const decided = (state.homeShootout ?? 0) !== (state.awayShootout ?? 0);
        return {
          ...none,
          phase: "penalties",
          periodButtons: decided ? [FULL_TIME] : [],
          canShootout: true,
          canCard: true,
        };
      }
      const inPlay = { ...none, phase: "in_play" as const, canGoal: true, canPenaltyMiss: true, canCard: true, canSub: true };
      switch (period) {
        case "first_half":
          return { ...inPlay, periodButtons: [END("Half time")] };
        case "second_half":
          return { ...inPlay, periodButtons: [knockoutLevel ? END("End of normal time") : FULL_TIME] };
        case "extra_first":
          return { ...inPlay, periodButtons: [END("Half time in extra time")] };
        case "extra_second":
          return { ...inPlay, periodButtons: [knockoutLevel ? END("End of extra time") : FULL_TIME] };
        default:
          return inPlay;
      }
    }

    case "half_time": {
      const brk = { ...none, phase: "break" as const, canCard: true, canSub: true };
      switch (period) {
        case "first_half":
          return { ...brk, periodButtons: [start("second_half", "Second half")] };
        case "second_half":
          return {
            ...brk,
            periodButtons: knockoutLevel
              ? hasExtraTime
                ? [start("extra_first", "Extra time"), start("penalties", "Penalties")]
                : [start("penalties", "Penalties")]
              : [FULL_TIME],
          };
        case "extra_first":
          return { ...brk, periodButtons: [start("extra_second", "Extra time, 2nd half")] };
        case "extra_second":
          return { ...brk, periodButtons: knockoutLevel ? [start("penalties", "Penalties")] : [FULL_TIME] };
        default:
          return brk;
      }
    }
  }
}

/**
 * Basketball: four quarters, then overtime (as many as it takes) when a
 * knockout is level. A level group game ends after the fourth quarter.
 */
function quarterControls(state: MatchState): Controls {
  const none: Controls = {
    phase: "closed",
    periodButtons: [],
    canGoal: false,
    canPenaltyMiss: false,
    canCard: false,
    canSub: false,
    canShootout: false,
    canMotm: false,
  };
  const knockoutLevel = state.isKnockout && state.homeScore === state.awayScore;
  const period = state.currentPeriod;
  const NEXT: Partial<Record<MatchPeriod, [MatchPeriod, string]>> = {
    first_quarter: ["second_quarter", "Second quarter"],
    second_quarter: ["third_quarter", "Third quarter"],
    third_quarter: ["fourth_quarter", "Fourth quarter"],
  };
  const QUARTER_END: Partial<Record<MatchPeriod, string>> = {
    first_quarter: "End of Q1",
    second_quarter: "Half time",
    third_quarter: "End of Q3",
  };

  switch (state.status) {
    case "postponed":
    case "cancelled":
    case "walkover":
      return none;
    case "scheduled":
      return { ...none, phase: "not_started", periodButtons: [start("first_quarter", "Tip-off")] };
    case "full_time":
      return { ...none, phase: "finished", canMotm: state.motmPlayerId === null };
    case "live": {
      const inPlay = { ...none, phase: "in_play" as const, canGoal: true, canCard: true, canSub: true };
      if (period && QUARTER_END[period]) return { ...inPlay, periodButtons: [END(QUARTER_END[period]!)] };
      if (period === "fourth_quarter") return { ...inPlay, periodButtons: [knockoutLevel ? END("End of Q4") : FULL_TIME] };
      if (period === "overtime") return { ...inPlay, periodButtons: [knockoutLevel ? END("End of overtime") : FULL_TIME] };
      return inPlay;
    }
    case "half_time": {
      const brk = { ...none, phase: "break" as const, canCard: true, canSub: true };
      const next = period ? NEXT[period] : undefined;
      if (next) return { ...brk, periodButtons: [start(next[0], next[1])] };
      if (period === "fourth_quarter" || period === "overtime") {
        return { ...brk, periodButtons: knockoutLevel ? [start("overtime", "Overtime")] : [FULL_TIME] };
      }
      return brk;
    }
  }
}

// -----------------------------------------------------------------------------
// Who can be picked
// -----------------------------------------------------------------------------

export type Eligibility =
  /** Scorer, assister, penalty taker, goalkeeper, player coming off. */
  | "on_pitch"
  /** Player coming on: an unused substitute. */
  | "unused_sub"
  /** Card: anyone in the lineup not sent off (bench players included). */
  | "in_lineup"
  /** Man of the Match: anyone who played. */
  | "appeared";

/**
 * Player IDs from `squad` who can be picked. With no lineup for the team the
 * server only checks squad membership, so the whole squad is offered
 * (except for a player coming on, who must then also be off the pitch, which
 * the console can't know: the whole squad again).
 */
export function eligiblePlayers(
  state: MatchState,
  teamId: string,
  squad: readonly { id: string }[],
  need: Eligibility,
): string[] {
  const hasLineup = teamId === state.homeTeamId ? state.hasLineup.home : state.hasLineup.away;
  if (!hasLineup) return squad.map((p) => p.id);

  return squad
    .map((p) => state.players.get(p.id))
    .filter((p): p is PlayerState => p !== undefined && p.teamId === teamId)
    .filter((p) => {
      switch (need) {
        case "on_pitch":
          return p.onPitch && !p.sentOff;
        case "unused_sub":
          return p.role === "bench" && !p.appeared && !p.sentOff;
        case "in_lineup":
          return !p.sentOff;
        case "appeared":
          return p.appeared;
      }
    })
    .map((p) => p.playerId);
}
