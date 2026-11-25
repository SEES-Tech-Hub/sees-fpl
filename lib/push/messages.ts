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

export function matchMessage(event: MatchEvent, fixture: LiveFixture, entry: TimelineEntry | null): MatchMessage | null {
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
      const how = entry?.isOwnGoal ? " (own goal)" : entry?.isPenalty ? " (pen)" : "";
      return { title: `GOAL! ${score}`, body: `${player ?? "Goal"}${how}${minute} · ${what}`, audience: "major" };
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

function resultMessage(fixture: LiveFixture, score: string, what: string, vs: string): MatchMessage {
  const pens =
    fixture.homeShootout !== null && fixture.awayShootout !== null ? ` (${fixture.homeShootout}–${fixture.awayShootout} on pens)` : "";
  const winner = fixture.winnerSide ? sideName(fixture, fixture.winnerSide) : null;
  return {
    title: `Full time: ${score}${pens}`,
    body: winner && fixture.sport.resultFormat !== "timed" ? `${winner} wins · ${what}` : `${what} · ${vs}`,
    audience: "major",
  };
}
