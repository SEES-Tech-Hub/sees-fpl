import { describe, expect, it } from "vitest";
import { boardProgress, type BoardTally } from "./boards";

const W: BoardTally = { home: 2, away: 0 }; // home wins the board
const L: BoardTally = { home: 0, away: 2 }; // away wins the board
const D: BoardTally = { home: 1, away: 1 }; // a draw

/** Every sequence of board results, from no boards in up to all of them. */
function sequences(boards: number): BoardTally[][] {
  const out: BoardTally[][] = [[]];
  let frontier: BoardTally[][] = [[]];
  for (let i = 0; i < boards; i++) {
    frontier = frontier.flatMap((s) => [W, L, D].map((r) => [...s, r]));
    out.push(...frontier);
  }
  return out;
}

describe("boardProgress", () => {
  it("is exactly 'every board is in' for one and two boards (Chess, Scrabble, Ludo, Draughts)", () => {
    for (const boards of [1, 2]) {
      for (const s of sequences(boards)) {
        expect(boardProgress(boards, s).decided).toBe(s.length === boards);
      }
    }
  });

  it("ends a best of three at 2–0 without the third game", () => {
    expect(boardProgress(3, [W, W])).toEqual({ done: 2, left: 1, decided: true });
    expect(boardProgress(3, [L, L]).decided).toBe(true);
  });

  it("needs the third game at 1–1", () => {
    expect(boardProgress(3, [W, L])).toEqual({ done: 2, left: 1, decided: false });
    expect(boardProgress(3, [W, L, W]).decided).toBe(true);
  });

  it("needs the third game when a draw leaves it catchable", () => {
    // 1½–½ after two: an away win in game 3 makes it 1½–1½.
    expect(boardProgress(3, [W, D]).decided).toBe(false);
    expect(boardProgress(3, [D, D]).decided).toBe(false);
    expect(boardProgress(3, [W, D, L]).decided).toBe(true);
  });

  it("is never decided after the first game of three", () => {
    for (const first of [W, L, D]) expect(boardProgress(3, [first]).decided).toBe(false);
  });

  it("never calls it decided while the side behind could still draw level", () => {
    for (const s of sequences(3)) {
      const p = boardProgress(3, s);
      if (!p.decided || p.left === 0) continue;
      const lead = s.reduce((n, r) => n + r.home - r.away, 0);
      // Even winning every board left, the side behind ends at least a board behind.
      expect(Math.abs(lead) - 2 * p.left).toBeGreaterThan(0);
    }
  });

  it("doesn't count half of a draw that's still being sent", () => {
    expect(boardProgress(3, [W, { home: 1, away: 0 }])).toEqual({ done: 1, left: 2, decided: false });
  });

  it("handles no boards in", () => {
    expect(boardProgress(3, [])).toEqual({ done: 0, left: 3, decided: false });
  });
});
