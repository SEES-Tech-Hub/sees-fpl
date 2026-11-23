// Live scores: the match clock.
//
// The server stores when the current period started (fixtures.period_started_at).
// Every screen works out the minute from that and its own clock, so nothing
// has to be sent every second. Pure functions, safe on server and client.
//
// matchMinute() mirrors public.match_minute() in the database, which numbers
// the timeline. Change both together.
import type { FixtureStatus, MatchPeriod } from "./types";

type DateInput = Date | string;

function toMs(value: DateInput): number {
  return typeof value === "string" ? Date.parse(value) : value.getTime();
}

/**
 * How far into the match each period starts, in minutes. Null for penalties.
 * Basketball quarters start at 0, 10, 20 and 30; overtime at 40 (every
 * overtime counts from 40, as in the database).
 */
export function periodOffsetMinutes(
  period: MatchPeriod,
  periodMinutes: number,
  extraPeriodMinutes: number,
): number | null {
  switch (period) {
    case "first_half":
      return 0;
    case "second_half":
      return periodMinutes;
    case "extra_first":
      return 2 * periodMinutes;
    case "extra_second":
      return 2 * periodMinutes + extraPeriodMinutes;
    case "penalties":
      return null;
    case "first_quarter":
      return 0;
    case "second_quarter":
      return periodMinutes;
    case "third_quarter":
      return 2 * periodMinutes;
    case "fourth_quarter":
      return 3 * periodMinutes;
    case "overtime":
      return 4 * periodMinutes;
  }
}

/** Extra time (football) and overtime (basketball) use the extra period length. */
function isExtraPeriod(period: MatchPeriod): boolean {
  return period === "extra_first" || period === "extra_second" || period === "overtime";
}

export type MinuteInput = {
  period: MatchPeriod | null;
  periodStartedAt: DateInput | null;
  at: DateInput;
  /** Length of a normal period (football: 25, basketball: 10). */
  periodMinutes: number | null;
  /** Length of an extra-time or overtime period (football: 7, basketball: 3). */
  extraPeriodMinutes: number | null;
};

/**
 * The match minute at a moment. 0:00 to 0:59 into the match is minute 1.
 * Past the end of a period the minute stops at the period's end and the rest
 * is added time: 25:30 into a 25-minute half is { minute: 25, addedMinutes: 1 },
 * shown as 25+1'. Returns null for penalties, or when the period hasn't started.
 */
export function matchMinute(input: MinuteInput): { minute: number; addedMinutes: number } | null {
  const { period, periodStartedAt, at, periodMinutes, extraPeriodMinutes } = input;
  if (!period || !periodStartedAt || periodMinutes == null) return null;

  const isExtra = isExtraPeriod(period);
  if (isExtra && extraPeriodMinutes == null) return null;

  const offset = periodOffsetMinutes(period, periodMinutes, extraPeriodMinutes ?? 0);
  if (offset === null) return null;

  const elapsedMs = toMs(at) - toMs(periodStartedAt);
  if (Number.isNaN(elapsedMs)) return null;
  // A phone clock slightly behind the server would give a negative time.
  const elapsed = Math.max(Math.floor(elapsedMs / 60_000) + 1, 1);
  const length = isExtra ? (extraPeriodMinutes as number) : periodMinutes;

  return elapsed > length
    ? { minute: offset + length, addedMinutes: elapsed - length }
    : { minute: offset + elapsed, addedMinutes: 0 };
}

/** 34' or 25+2'. */
export function formatMinute(minute: number, addedMinutes = 0): string {
  return addedMinutes > 0 ? `${minute}+${addedMinutes}'` : `${minute}'`;
}

export type ClockFixture = {
  status: FixtureStatus;
  currentPeriod: MatchPeriod | null;
  periodStartedAt: string | null;
  periodMinutes: number | null;
  extraPeriodMinutes: number | null;
};

export type ClockState =
  | { kind: "not_started"; label: string }
  | { kind: "running"; label: string; period: MatchPeriod; minute: number; addedMinutes: number }
  | { kind: "break"; label: string; period: MatchPeriod | null }
  | { kind: "penalties"; label: string }
  | { kind: "finished"; label: string }
  | { kind: "walkover"; label: string }
  | { kind: "postponed"; label: string }
  | { kind: "cancelled"; label: string };

const BREAK_LABELS: Record<MatchPeriod, string> = {
  first_half: "HT",
  second_half: "End of normal time",
  extra_first: "ET half time",
  extra_second: "End of extra time",
  penalties: "Penalties",
  first_quarter: "End of Q1",
  second_quarter: "HT",
  third_quarter: "End of Q3",
  fourth_quarter: "End of Q4",
  overtime: "End of OT",
};

/** What the live clock should show for a fixture at `now`. */
export function getClockState(fixture: ClockFixture, now: DateInput = new Date()): ClockState {
  switch (fixture.status) {
    case "scheduled":
      return { kind: "not_started", label: "Not started" };
    case "postponed":
      return { kind: "postponed", label: "Postponed" };
    case "cancelled":
      return { kind: "cancelled", label: "Cancelled" };
    case "walkover":
      return { kind: "walkover", label: "W/O" };
    case "full_time":
      return { kind: "finished", label: "FT" };
    case "half_time": {
      const period = fixture.currentPeriod;
      return { kind: "break", label: period ? BREAK_LABELS[period] : "Break", period };
    }
    case "live": {
      if (fixture.currentPeriod === "penalties") return { kind: "penalties", label: "Penalties" };
      const result = fixture.currentPeriod
        ? matchMinute({
            period: fixture.currentPeriod,
            periodStartedAt: fixture.periodStartedAt,
            at: now,
            periodMinutes: fixture.periodMinutes,
            extraPeriodMinutes: fixture.extraPeriodMinutes,
          })
        : null;
      if (!result || !fixture.currentPeriod) return { kind: "break", label: "Live", period: fixture.currentPeriod };
      return {
        kind: "running",
        label: formatMinute(result.minute, result.addedMinutes),
        period: fixture.currentPeriod,
        minute: result.minute,
        addedMinutes: result.addedMinutes,
      };
    }
  }
}

/**
 * Milliseconds until the displayed minute next changes. Lets a clock
 * component update once a minute instead of every second, which saves
 * battery on phones. Null when the clock isn't running.
 */
export function msUntilNextMinute(fixture: ClockFixture, now: DateInput = new Date()): number | null {
  if (fixture.status !== "live" || !fixture.periodStartedAt || fixture.currentPeriod === "penalties") {
    return null;
  }
  const elapsedMs = toMs(now) - toMs(fixture.periodStartedAt);
  if (Number.isNaN(elapsedMs)) return null;
  // Before the period's first minute ends (including a phone clock that is
  // behind the server), the clock shows minute 1 until 60 s have passed.
  if (elapsedMs < 0) return 60_000 - elapsedMs;
  return 60_000 - (elapsedMs % 60_000);
}
