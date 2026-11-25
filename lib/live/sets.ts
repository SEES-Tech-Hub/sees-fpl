// Set rules for volleyball, badminton, table tennis and lawn tennis: the same
// rules the database enforces (live_set_target and live_set_is_won in
// 20261123065000_live_phase3_formats.sql), so the console can show "End set"
// exactly when the server will accept it.

export type SetRules = {
  setsToWin: number | null;
  setPoints: number | null;
  finalSetPoints: number | null;
  setWinBy: number | null;
  setPointsCap: number | null;
};

/** Points needed to win this set: the deciding set can be shorter (volleyball's 15). */
export function setTarget(rules: SetRules, setNumber: number): number | null {
  const toWin = rules.setsToWin ?? 1;
  if (setNumber === 2 * toWin - 1 && rules.finalSetPoints !== null) return rules.finalSetPoints;
  return rules.setPoints;
}

/** Is home–away a finished set? 25–20, 27–25 and (with a cap of 30) 30–29 are; 24–22 and 26–23 aren't. */
export function setIsWon(home: number, away: number, target: number | null, winBy: number | null, cap: number | null): boolean {
  if (target === null) return false;
  const top = Math.max(home, away);
  const lead = Math.abs(home - away);
  const by = winBy ?? 1;
  if (top >= target && lead >= by && (top === target || lead === by)) return true;
  return cap !== null && top === cap && home !== away;
}

export type SetScore = { number: number; home: number; away: number; closed: boolean };

export type SetsState = {
  sets: SetScore[];
  /** Sets won. */
  home: number;
  away: number;
  /** The set being played (the last one, if it isn't closed). */
  current: SetScore;
  over: boolean;
  winner: "home" | "away" | null;
};

/**
 * Folds points and set ends into sets, as refresh_fixture_state does: each
 * set_end closes the current set and gives it to whoever leads; the match is
 * over when a side has setsToWin sets.
 */
export function foldSets(
  events: { type: string; side: "home" | "away"; points: number | null }[],
  rules: SetRules,
): SetsState {
  const sets: SetScore[] = [{ number: 1, home: 0, away: 0, closed: false }];
  let home = 0;
  let away = 0;
  const toWin = rules.setsToWin ?? 1;
  for (const e of events) {
    const cur = sets[sets.length - 1];
    if (e.type === "point") {
      if (e.side === "home") cur.home += e.points ?? 1;
      else cur.away += e.points ?? 1;
    } else if (e.type === "set_end") {
      cur.closed = true;
      if (cur.home > cur.away) home += 1;
      else if (cur.away > cur.home) away += 1;
      if (Math.max(home, away) >= toWin) break;
      sets.push({ number: cur.number + 1, home: 0, away: 0, closed: false });
    }
  }
  const over = Math.max(home, away) >= toWin;
  return {
    sets,
    home,
    away,
    current: sets[sets.length - 1],
    over,
    winner: over ? (home > away ? "home" : "away") : null,
  };
}
