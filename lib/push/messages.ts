import { formatScore, sideName } from "@/lib/live/display";
import type { LiveFixture, MatchEvent, TimelineEntry } from "@/lib/live/types";

// What a push notification says for a match moment, and who gets it. Pure
// (no network), so it's easy to test and to change the wording.
//
// Audiences:
//   "major": everyone following "All matches", plus the match and both teams.
//   "minor": only people following this match or one of the teams.
// Noisy moments are skipped: every basket in basketball, every handball goal,
// every point in a set or head-to-head game. Their followers still get the
// kick-off, breaks and the result.

export type MatchMessage = { title: string; body: string; audience: "major" | "minor" };

/** Sports where a goal is rare enough to be worth a notification. */
const GOAL_SPORTS = new Set(["football"]);

export function matchMessage(
  event: MatchEvent,
  fixture: LiveFixture,
  entry: TimelineEntry | null,
  /** The match's whole timeline, oldest first: goal stories (opener, equaliser, comeback…) need it. */
  timeline: TimelineEntry[] = [],
): MatchMessage | null {
  if (!fixture.home || !fixture.away) return null;
  const format = fixture.sport.resultFormat;
  const what = fixture.sport.slug === "football" || fixture.event.name === fixture.sport.name ? fixture.sport.name : fixture.event.name;
  const boards = fixture.event.boards;
  const vs = `${sideName(fixture, "home")} v ${sideName(fixture, "away")}`;
  const score = `${fixture.home.shortName} ${formatScore(fixture.homeScore ?? 0, boards)}–${formatScore(fixture.awayScore ?? 0, boards)} ${fixture.away.shortName}`;
  const minute = entry?.minute != null ? ` ${entry.minute}'` : "";
  const teamOf = (teamId: string | null) =>
    teamId === fixture.home?.id ? fixture.home!.shortName : teamId === fixture.away?.id ? fixture.away!.shortName : "";
  const player = entry?.playerName ?? null;

  switch (event.type) {
    case "period_start": {
      const p = event.period;
      if (p === "first_half" || p === "first_quarter") return { title: `Kick-off: ${vs}`, body: `${what} is under way. Follow it live.`, audience: "major" };
      if (p === "second_half") return { title: `Second half: ${score}`, body: `${what} · ${vs}`, audience: "minor" };
      if (p === "extra_first") return { title: `Extra time: ${score}`, body: `${what} · level after normal time.`, audience: "major" };
      if (p === "penalties") return { title: `Penalties! ${score}`, body: `${what} goes to a shootout.`, audience: "major" };
      if (p === "overtime") return { title: `Overtime: ${score}`, body: `${what} · level after four quarters.`, audience: "major" };
      return null;
    }
    case "period_end": {
      const p = event.period;
      if (p === "first_half" || p === "second_quarter") return { title: `Half-time: ${score}`, body: `${what} · ${vs}`, audience: "major" };
      if (p === "first_quarter" || p === "third_quarter") {
        return { title: `End of Q${p === "first_quarter" ? 1 : 3}: ${score}`, body: what, audience: "minor" };
      }
      if (p === "second_half" || p === "fourth_quarter") return { title: `End of normal time: ${score}`, body: `${what} · it's level.`, audience: "minor" };
      return null;
    }
    case "goal": {
      if (!GOAL_SPORTS.has(fixture.sport.slug)) return null;
      return goalMessage(event, fixture, entry, timeline, { score, what, minute, player });
    }
    case "card": {
      const red = event.card === "red";
      return {
        title: `${red ? "Red" : "Yellow"} card: ${teamOf(event.teamId)}`,
        body: `${player ?? "A player"}${minute} · ${score}`,
        audience: red ? "major" : "minor",
      };
    }
    case "penalty_miss": {
      const keeper = entry?.otherPlayerName;
      return {
        title: keeper ? `Penalty saved! ${score}` : `Penalty missed! ${score}`,
        body: keeper
          ? `${keeper} keeps out ${player ?? "the penalty"}${minute}`
          : `${player ?? "The taker"} misses for ${teamOf(event.teamId)}${minute}`,
        audience: "major",
      };
    }
    case "man_of_the_match":
      return { title: `Man of the Match: ${player ?? "picked"}`, body: `${vs} · ${score}`, audience: "minor" };
    case "set_end":
      if (format !== "sets") return null;
      // The last set ends the match by itself (there's no full_time event).
      if (fixture.status !== "full_time") return { title: `Set over: ${score} in sets`, body: `${what} · ${vs}`, audience: "minor" };
      return resultMessage(fixture, score, what, vs);
    case "full_time":
      return resultMessage(fixture, score, what, vs);
    case "walkover":
      return { title: `Walkover: ${score}`, body: `${what} · ${vs}`, audience: "major" };
    default:
      return null;
  }
}

/**
 * The result: who won, or a draw. Penalties say so. Uses winner_side when
 * known (players from one year), else the winning year.
 */
function resultMessage(fixture: LiveFixture, score: string, what: string, vs: string): MatchMessage {
  const pens = fixture.homeShootout !== null && fixture.awayShootout !== null;
  const side: "home" | "away" | null =
    fixture.winnerSide ??
    (fixture.winnerTeamId && fixture.home && fixture.away && fixture.home.id !== fixture.away.id
      ? fixture.winnerTeamId === fixture.home.id
        ? "home"
        : "away"
      : null);
  if (!side) return { title: `Honours even: ${score}`, body: `Full time · ${what} · ${vs}`, audience: "major" };
  const winner = sideName(fixture, side);
  const loser = sideName(fixture, side === "home" ? "away" : "home");
  if (pens) {
    return {
      title: `${winner} win on penalties!`,
      body: `${score}, ${fixture.homeShootout}–${fixture.awayShootout} in the shootout · ${what}`,
      audience: "major",
    };
  }
  return { title: `${winner} win! ${score}`, body: `Full time · beat ${loser} · ${what}`, audience: "major" };
}

/**
 * A goal's headline, from the match so far. One story per goal, the
 * strongest first: hat-trick, comeback, late goal, equaliser, opener,
 * brace, penalty, own goal, then a plain GOAL!.
 */
function goalMessage(
  event: MatchEvent,
  fixture: LiveFixture,
  entry: TimelineEntry | null,
  timeline: TimelineEntry[],
  t: { score: string; what: string; minute: string; player: string | null },
): MatchMessage {
  const home = fixture.home!;
  const goals = timeline.filter((e) => e.type === "goal");
  const index = goals.findIndex((g) => g.clientEventId === event.clientEventId);
  const before = index >= 0 ? goals.slice(0, index) : goals;
  const scoringHome = event.teamId === home.id;
  const team = scoringHome ? sideName(fixture, "home") : sideName(fixture, "away");

  // The score just before this goal, and whether the scoring side trailed at any point.
  let h = 0;
  let a = 0;
  let trailed = false;
  for (const g of before) {
    if (g.teamId === home.id) h += g.points ?? 1;
    else a += g.points ?? 1;
    if (scoringHome ? h < a : a < h) trailed = true;
  }
  const mine = scoringHome ? h : a;
  const theirs = scoringHome ? a : h;
  const nowMine = mine + (event.points ?? 1);

  const scorer = t.player ?? "";
  const scorerGoals = entry?.playerId && !entry.isOwnGoal
    ? [...before, entry].filter((g) => g.playerId === entry.playerId && !g.isOwnGoal).length
    : 0;

  // Late: the last 5 minutes of normal time, or the last 3 of extra time.
  const p = fixture.event.periodMinutes ?? 0;
  const x = fixture.event.extraPeriodMinutes ?? 0;
  const m = entry?.minute ?? 0;
  const late =
    (entry?.period === "second_half" && p > 0 && m >= 2 * p - 5) ||
    (entry?.period === "extra_second" && x > 0 && m >= 2 * p + 2 * x - 3);

  const tag = entry?.isPenalty ? " (pen)" : entry?.isOwnGoal ? " (own goal)" : "";
  const who = scorer ? `${scorer}${tag}${t.minute}` : `${team}${tag}${t.minute}`;

  if (scorerGoals === 3) return { title: `HAT-TRICK! ${t.score}`, body: `${scorer} completes the hat-trick for ${team}${t.minute}`, audience: "major" };
  if (scorerGoals > 3) return { title: `${scorer} again! ${t.score}`, body: `That's ${scorerGoals} for ${scorer}${t.minute}`, audience: "major" };
  if (trailed && mine === theirs && nowMine > theirs) {
    return { title: `COMEBACK! ${team} lead ${t.score}`, body: `From behind to in front · ${who}`, audience: "major" };
  }
  if (late) {
    if (mine === theirs) return { title: `LATE WINNER?! ${t.score}`, body: `${who} · ${t.what}`, audience: "major" };
    if (nowMine === theirs) return { title: `LATE EQUALISER! ${t.score}`, body: `${who} · ${t.what}`, audience: "major" };
    return { title: `LATE GOAL! ${t.score}`, body: `${who} · ${t.what}`, audience: "major" };
  }
  if (nowMine === theirs) return { title: `LEVEL! ${t.score}`, body: `${scorer || team} equalises${tag}${t.minute}`, audience: "major" };
  if (mine === 0 && theirs === 0) {
    return { title: `${team} take the lead! ${t.score}`, body: `${scorer || "A goal"} opens the scoring${tag}${t.minute}`, audience: "major" };
  }
  if (scorerGoals === 2) return { title: `${scorer} again! ${t.score}`, body: `A brace for ${scorer}${tag}${t.minute}`, audience: "major" };
  if (entry?.isPenalty) return { title: `PENALTY SCORED! ${t.score}`, body: `${scorer || team} scores from the spot${t.minute}`, audience: "major" };
  if (entry?.isOwnGoal) return { title: `Own goal! ${t.score}`, body: `${scorer ? `${scorer} turns it in` : "Turned in"} for ${team}${t.minute}`, audience: "major" };
  return { title: `GOAL! ${t.score}`, body: `${who} · ${t.what}`, audience: "major" };
}
