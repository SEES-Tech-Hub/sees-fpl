import { describe, expect, it } from "vitest";
import { festivalDay } from "./festival";
import { lanePercent, progressLine, raceHeadline } from "./race";
import type { MedalTableRow } from "./types";

const FIRST = "2026-11-28T06:30:00Z"; // Sat 28 Nov, 7:30 am WAT
const LAST = "2026-12-09T15:00:00Z"; // Wed 9 Dec

const row = (year: number, gold: number, silver: number, bronze: number, position: number): MedalTableRow =>
  ({
    position,
    team: { id: `t${year}`, year, name: `Year ${year}`, shortName: `Y${year}` },
    gold,
    silver,
    bronze,
    total: gold + silver + bronze,
    points: gold * 3 + silver * 2 + bronze,
    rankBy: "medals",
  }) as unknown as MedalTableRow;

describe("festivalDay", () => {
  it("counts WAT days, first and last inclusive", () => {
    expect(festivalDay(Date.parse("2026-11-26T12:00:00Z"), FIRST, LAST)).toEqual({ phase: "before", days: 12 });
    expect(festivalDay(Date.parse("2026-11-28T05:00:00Z"), FIRST, LAST)).toEqual({ phase: "during", day: 1, days: 12 });
    expect(festivalDay(Date.parse("2026-12-01T10:00:00Z"), FIRST, LAST)).toEqual({ phase: "during", day: 4, days: 12 });
    expect(festivalDay(Date.parse("2026-12-10T10:00:00Z"), FIRST, LAST)).toEqual({ phase: "after", days: 12 });
  });

  it("uses Lagos time: 11:30 pm UTC on the 27th is already the 28th", () => {
    expect(festivalDay(Date.parse("2026-11-27T23:30:00Z"), FIRST, LAST)).toEqual({ phase: "during", day: 1, days: 12 });
  });
});

describe("race wording", () => {
  const progress = { decided: 12, total: 34, firstAt: FIRST, lastAt: LAST };
  const rows = [row(3, 5, 2, 1, 1), row(5, 3, 4, 2, 2), row(2, 2, 3, 4, 3), row(1, 1, 2, 3, 4), row(4, 1, 1, 2, 5)];

  it("says how far the festival has got", () => {
    expect(progressLine(progress, Date.parse("2026-12-01T10:00:00Z"))).toBe("12 of 34 events decided · day 4 of 12");
    expect(progressLine(progress, null)).toBe("12 of 34 events decided");
    expect(progressLine({ ...progress, decided: 0 }, Date.parse("2026-11-26T12:00:00Z"))).toBe("0 of 34 events decided · starts Sat 28 Nov");
  });

  it("headlines the leader, a tie, the start and the end", () => {
    expect(raceHeadline(rows, progress)).toBe("Year 3 lead on golds.");
    expect(raceHeadline([row(3, 1, 0, 0, 1), row(5, 1, 0, 0, 1)], progress)).toBe("Level at the top.");
    expect(raceHeadline(rows.map((r) => row(r.team.year!, 0, 0, 0, 1)), progress)).toBe("All five on the start line.");
    expect(raceHeadline(rows, { ...progress, decided: 34 })).toBe("Year 3 are champions.");
  });

  it("puts everyone on the start line before any medal, and the leader furthest", () => {
    const none = rows.map((r) => row(r.team.year!, 0, 0, 0, 1));
    expect(none.map((r) => lanePercent(r, none, progress))).toEqual([9, 9, 9, 9, 9]);
    expect(lanePercent(rows[0], rows, progress)).toBe(81);
    expect(lanePercent(rows[0], rows, { ...progress, decided: 34 })).toBe(89);
    expect(lanePercent(rows[4], rows, progress)).toBeLessThan(lanePercent(rows[3], rows, progress));
  });
});
