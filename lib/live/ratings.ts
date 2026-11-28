import type { LineupPlayer, TimelineEntry } from "./types";

// Match ratings (display only: they don't touch fantasy points). Worked out
// from what the officials already record, so nobody has to rate anyone:
// everyone who played starts at 6.0, then goals, assists, saves, clean sheets
// and the player of the match push it up; goals conceded on the pitch, cards,
// own goals and missed penalties pull it down. Clamped to 3.0–10.0.

export const BASE_RATING = 6;

const GOAL = { GK: 1.5, DEF: 1.5, MID: 1.2, FWD: 1 } as const;
const CLEAN_SHEET = { GK: 1, DEF: 0.7, MID: 0.3, FWD: 0 } as const;
const CONCEDED = { GK: -0.3, DEF: -0.3, MID: -0.1, FWD: 0 } as const;
const ASSIST = 0.8;
const SAVE = 0.3;
const SAVES_CAP = 2;
const PENALTY_SAVE = 1;
const MOTM = 0.5;
const YELLOW = -0.5;
const RED = -1.5;
const OWN_GOAL = -1;
const PENALTY_MISS = -0.7;

/** The minute an entry happened at, for ordering (penalties have none: the end). */
const at = (e: TimelineEntry) => (e.minute ?? Number.POSITIVE_INFINITY) + (e.addedMinutes ?? 0) / 100;

/** Every player who appeared, with their rating (one decimal). */
export function matchRatings(players: LineupPlayer[], timeline: TimelineEntry[]): Map<string, number> {
  const ratings = new Map<string, number>();
  const goals = timeline.filter((e) => e.type === "goal");

  for (const p of players) {
    if (!p.appeared) continue;
    const mine = (e: TimelineEntry) => e.playerId === p.playerId;
    const cameOn = timeline.find((e) => e.type === "substitution" && e.otherPlayerId === p.playerId);
    const wentOff = timeline.find(
      (e) => (e.type === "substitution" && mine(e)) || (e.type === "card" && e.card === "red" && mine(e)),
    );
    const from = p.role === "starter" ? 0 : cameOn ? at(cameOn) : 0;
    const to = wentOff ? at(wentOff) : Number.POSITIVE_INFINITY;
    // Goals for the other side while this player was on (own goals by teammates count).
    const conceded = goals.filter((g) => g.teamId !== p.teamId && at(g) >= from && at(g) < to).length;

    let r = BASE_RATING;
    r += goals.filter((g) => mine(g) && !g.isOwnGoal).length * GOAL[p.position];
    r += goals.filter((g) => !g.isOwnGoal && g.otherPlayerId === p.playerId).length * ASSIST;
    r += goals.filter((g) => mine(g) && g.isOwnGoal).length * OWN_GOAL;
    r += Math.min(SAVES_CAP, timeline.filter((e) => e.type === "save" && mine(e)).length * SAVE);
    r += timeline.filter((e) => e.type === "penalty_miss" && e.otherPlayerId === p.playerId).length * PENALTY_SAVE;
    r += timeline.filter((e) => e.type === "penalty_miss" && mine(e)).length * PENALTY_MISS;
    r += timeline.filter((e) => e.type === "card" && e.card === "yellow" && mine(e)).length * YELLOW;
    r += timeline.filter((e) => e.type === "card" && e.card === "red" && mine(e)).length * RED;
    if (timeline.some((e) => e.type === "man_of_the_match" && mine(e))) r += MOTM;
    r += conceded === 0 ? CLEAN_SHEET[p.position] : conceded * CONCEDED[p.position];

    ratings.set(p.playerId, Math.round(Math.min(10, Math.max(3, r)) * 10) / 10);
  }
  return ratings;
}

/** How a rating reads: the colour band it falls in. */
export function ratingBand(rating: number): "great" | "good" | "ok" | "poor" {
  if (rating >= 8) return "great";
  if (rating >= 7) return "good";
  if (rating >= 6) return "ok";
  return "poor";
}
