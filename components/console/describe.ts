import type { ConsoleEvent } from "@/lib/console/match-state";
import type { MatchPeriod } from "@/lib/live/types";

// Owner: Samuel (console). One line of text for an event, for the timeline,
// the undo bar and the "waiting to send" list.

export type Names = {
  player: (id: string | null) => string | null;
  team: (id: string | null) => string;
};

const PERIOD_START: Record<MatchPeriod, string> = {
  first_half: "Kick off",
  second_half: "Second half",
  extra_first: "Extra time",
  extra_second: "Extra time, 2nd half",
  penalties: "Penalty shootout",
};

const PERIOD_END: Record<MatchPeriod, string> = {
  first_half: "Half time",
  second_half: "End of normal time",
  extra_first: "Half time in extra time",
  extra_second: "End of extra time",
  penalties: "End of shootout",
};

export function describeEvent(event: ConsoleEvent, names: Names): string {
  const player = names.player(event.playerId);
  const other = names.player(event.otherPlayerId);
  const team = names.team(event.teamId);

  switch (event.type) {
    case "period_start":
      return event.period ? PERIOD_START[event.period] : "Period started";
    case "period_end":
      return event.period ? PERIOD_END[event.period] : "Period ended";
    case "full_time":
      return "Full time";
    case "goal": {
      if (event.isOwnGoal) return `Goal ${team}: own goal${player ? ` by ${player}` : ""}`;
      const who = player ?? "scorer not recorded";
      const pen = event.isPenalty ? " (pen)" : "";
      const assist = other ? `, assist ${other}` : "";
      return `Goal ${team}: ${who}${pen}${assist}`;
    }
    case "card":
      return `${event.card === "red" ? "Red" : "Yellow"} card: ${player ?? "player"} (${team})`;
    case "substitution":
      return `Sub ${team}: ${other ?? "player"} on, ${player ?? "player"} off`;
    case "penalty_miss":
      return other
        ? `Penalty saved: ${player ?? "taker"} (${team}), saved by ${other}`
        : `Penalty missed: ${player ?? "taker"} (${team})`;
    case "shootout_kick":
      return `Shootout ${team}: ${event.scored ? "scored" : "missed"}${player ? ` (${player})` : ""}`;
    case "man_of_the_match":
      return `Man of the Match: ${player ?? "player"}`;
    case "walkover":
      return `Walkover awarded to ${team}`;
  }
}
