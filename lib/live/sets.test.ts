import { describe, expect, it } from "vitest";
import { foldSets, setIsWon, setTarget, type SetRules } from "./sets";

const volleyball: SetRules = { setsToWin: 2, setPoints: 25, finalSetPoints: 15, setWinBy: 2, setPointsCap: null };
const badminton: SetRules = { setsToWin: 2, setPoints: 21, finalSetPoints: null, setWinBy: 2, setPointsCap: 30 };

describe("setTarget", () => {
  it("uses the deciding set's points in the last set only", () => {
    expect(setTarget(volleyball, 1)).toBe(25);
    expect(setTarget(volleyball, 2)).toBe(25);
    expect(setTarget(volleyball, 3)).toBe(15);
    expect(setTarget(badminton, 3)).toBe(21);
  });
});

describe("setIsWon (matches the database)", () => {
  it.each([
    [25, 20, true],
    [27, 25, true],
    [24, 22, false],
    [26, 23, false],
    [25, 24, false],
  ])("volleyball %i-%i → %s", (h, a, won) => {
    expect(setIsWon(h, a, 25, 2, null)).toBe(won);
  });
  it("badminton is won at the cap by one point", () => {
    expect(setIsWon(30, 29, 21, 2, 30)).toBe(true);
    expect(setIsWon(29, 28, 21, 2, 30)).toBe(false);
    expect(setIsWon(21, 19, 21, 2, 30)).toBe(true);
  });
});

describe("foldSets", () => {
  const pts = (side: "home" | "away", n: number) => Array.from({ length: n }, () => ({ type: "point", side, points: 1 }));
  const end = { type: "set_end", side: "home" as const, points: null };
  it("counts sets and ends the match at setsToWin", () => {
    const s = foldSets([...pts("home", 25), ...pts("away", 20), end, ...pts("away", 25), ...pts("home", 10), end, ...pts("home", 3)], volleyball);
    expect([s.home, s.away]).toEqual([1, 1]);
    expect(s.current).toEqual({ number: 3, home: 3, away: 0, closed: false });
    expect(s.over).toBe(false);
  });
  it("names the winner", () => {
    const s = foldSets([...pts("away", 21), end, ...pts("away", 21), end], badminton);
    expect(s.over).toBe(true);
    expect(s.winner).toBe("away");
    expect(s.sets).toHaveLength(2);
  });
});
