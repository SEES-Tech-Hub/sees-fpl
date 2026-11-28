// Board games: how far a match has got and whether it can end.
//
// Each board's result is stored doubled: 2 to the winner, or 1 to each side
// for a draw (formatScore in ./display shows them as halves). Most board games
// play their boards side by side, and every board counts. Connect Four is best
// of three: up to three boards, one after another, and a game that can't
// change the result isn't played.
//
// One rule covers both. A match can end once every board is in, or once the
// side behind couldn't catch up even by winning every board left. With one or
// two boards, the side behind can always still draw level until the last
// board is in, so for those games the rule is exactly "every board is in"
// (boards.test.ts checks every possible result).
//
// The console uses this to unlock End match and to mark the boards that
// aren't needed. The database doesn't need it: it accepts End match at any
// point in a group match.

/** One board's points so far (doubled: a win is 2, a draw 1 each). */
export type BoardTally = { home: number; away: number };

export type BoardProgress = {
  /** Boards with their result in. */
  done: number;
  /** Boards still to come. */
  left: number;
  /** The match can end: every board is in, or the boards left can't change the result. */
  decided: boolean;
};

/** A board has its result once its 2 points are in (a win, or both halves of a draw). */
export const boardDone = (b: BoardTally) => b.home + b.away >= 2;

export function boardProgress(boards: number, results: Iterable<BoardTally>): BoardProgress {
  let done = 0;
  let lead = 0;
  for (const r of results) {
    if (!boardDone(r)) continue;
    done += 1;
    lead += r.home - r.away;
  }
  const left = Math.max(0, boards - done);
  // Winning every board left gains at most 2 points each. A lead bigger than
  // that can't be caught, and a lead equal to it could still end level.
  return { done, left, decided: left === 0 || Math.abs(lead) > 2 * left };
}
