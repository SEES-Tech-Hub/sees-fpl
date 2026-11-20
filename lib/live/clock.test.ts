import { describe, expect, it } from "vitest";
import { formatMinute, getClockState, matchMinute, msUntilNextMinute, type ClockFixture } from "./clock";

const KICKOFF = "2026-11-28T13:00:00.000Z";
const at = (minutes: number, seconds = 0) =>
  new Date(Date.parse(KICKOFF) + minutes * 60_000 + seconds * 1000);

const football = { periodMinutes: 25, extraPeriodMinutes: 7 };

describe("matchMinute", () => {
  it("counts the first seconds as minute 1", () => {
    expect(matchMinute({ ...football, period: "first_half", periodStartedAt: KICKOFF, at: at(0, 0) })).toEqual({
      minute: 1,
      addedMinutes: 0,
    });
    expect(matchMinute({ ...football, period: "first_half", periodStartedAt: KICKOFF, at: at(0, 59) })?.minute).toBe(1);
    expect(matchMinute({ ...football, period: "first_half", periodStartedAt: KICKOFF, at: at(1, 0) })?.minute).toBe(2);
  });

  it("shows added time after the end of a half", () => {
    expect(matchMinute({ ...football, period: "first_half", periodStartedAt: KICKOFF, at: at(24, 59) })).toEqual({
      minute: 25,
      addedMinutes: 0,
    });
    expect(matchMinute({ ...football, period: "first_half", periodStartedAt: KICKOFF, at: at(25, 30) })).toEqual({
      minute: 25,
      addedMinutes: 1,
    });
  });

  it("offsets the second half and extra time", () => {
    const start = KICKOFF;
    expect(matchMinute({ ...football, period: "second_half", periodStartedAt: start, at: at(0, 10) })?.minute).toBe(26);
    expect(matchMinute({ ...football, period: "second_half", periodStartedAt: start, at: at(26, 0) })).toEqual({
      minute: 50,
      addedMinutes: 2,
    });
    expect(matchMinute({ ...football, period: "extra_first", periodStartedAt: start, at: at(3, 0) })?.minute).toBe(54);
    expect(matchMinute({ ...football, period: "extra_second", periodStartedAt: start, at: at(0, 0) })?.minute).toBe(58);
    expect(matchMinute({ ...football, period: "extra_second", periodStartedAt: start, at: at(8, 0) })).toEqual({
      minute: 64,
      addedMinutes: 2,
    });
  });

  it("has no minute for penalties, missing data or bad dates", () => {
    expect(matchMinute({ ...football, period: "penalties", periodStartedAt: KICKOFF, at: at(1) })).toBeNull();
    expect(matchMinute({ ...football, period: null, periodStartedAt: KICKOFF, at: at(1) })).toBeNull();
    expect(matchMinute({ ...football, period: "first_half", periodStartedAt: null, at: at(1) })).toBeNull();
    expect(matchMinute({ ...football, period: "first_half", periodStartedAt: "not a date", at: at(1) })).toBeNull();
    expect(matchMinute({ periodMinutes: 25, extraPeriodMinutes: null, period: "extra_first", periodStartedAt: KICKOFF, at: at(1) })).toBeNull();
  });

  it("treats a phone clock behind the server as minute 1", () => {
    expect(matchMinute({ ...football, period: "first_half", periodStartedAt: KICKOFF, at: at(0, -20) })?.minute).toBe(1);
  });
});

describe("formatMinute", () => {
  it("formats normal and added time", () => {
    expect(formatMinute(34)).toBe("34'");
    expect(formatMinute(25, 2)).toBe("25+2'");
  });
});

describe("getClockState", () => {
  const base: ClockFixture = {
    status: "live",
    currentPeriod: "first_half",
    periodStartedAt: KICKOFF,
    periodMinutes: 25,
    extraPeriodMinutes: 7,
  };

  it("runs while a period is live", () => {
    expect(getClockState(base, at(12, 5))).toMatchObject({ kind: "running", label: "13'", minute: 13 });
  });

  it("labels breaks by the period that just ended", () => {
    expect(getClockState({ ...base, status: "half_time", periodStartedAt: null }, at(30)).label).toBe("HT");
    expect(
      getClockState({ ...base, status: "half_time", currentPeriod: "second_half", periodStartedAt: null }).label,
    ).toBe("End of normal time");
  });

  it("covers every other status", () => {
    expect(getClockState({ ...base, status: "scheduled" }).kind).toBe("not_started");
    expect(getClockState({ ...base, status: "full_time" }).label).toBe("FT");
    expect(getClockState({ ...base, status: "walkover" }).label).toBe("W/O");
    expect(getClockState({ ...base, status: "postponed" }).kind).toBe("postponed");
    expect(getClockState({ ...base, status: "cancelled" }).kind).toBe("cancelled");
    expect(getClockState({ ...base, currentPeriod: "penalties" }).kind).toBe("penalties");
  });
});

describe("msUntilNextMinute", () => {
  const base: ClockFixture = {
    status: "live",
    currentPeriod: "first_half",
    periodStartedAt: KICKOFF,
    periodMinutes: 25,
    extraPeriodMinutes: 7,
  };

  it("waits until the next minute boundary", () => {
    expect(msUntilNextMinute(base, at(3, 45))).toBe(15_000);
    expect(msUntilNextMinute(base, at(0, -5))).toBe(65_000);
  });

  it("is null when the clock isn't running", () => {
    expect(msUntilNextMinute({ ...base, status: "half_time" })).toBeNull();
    expect(msUntilNextMinute({ ...base, currentPeriod: "penalties" })).toBeNull();
  });
});
