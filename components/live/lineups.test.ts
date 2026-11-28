import { describe, expect, it } from "vitest";
import { eventsByPlayer } from "./lineups";
import type { TimelineEntry } from "@/lib/live/types";

const e = (over: Partial<TimelineEntry>): TimelineEntry =>
  ({
    id: 1, clientEventId: "x", type: "goal", period: null, teamId: "t", teamShortName: "Y5",
    playerId: null, playerName: null, otherPlayerId: null, otherPlayerName: null,
    card: null, isPenalty: false, isOwnGoal: false, scored: null, points: null,
    occurredAt: "", minute: 12, addedMinutes: null, ...over,
  }) as TimelineEntry;

describe("eventsByPlayer", () => {
  it("gives the scorer the goal and the assister the assist", () => {
    const m = eventsByPlayer([e({ playerId: "mic", playerName: "Micheal", otherPlayerId: "wiz", otherPlayerName: "Wizz" })]);
    expect(m.get("mic")).toEqual([{ kind: "goal", minute: "12'", text: "Goal · assisted by Wizz" }]);
    expect(m.get("wiz")).toEqual([{ kind: "assist", minute: "12'", text: "Assist for Micheal" }]);
  });

  it("marks an own goal on the player who put it in, with no assist", () => {
    const m = eventsByPlayer([e({ playerId: "def", isOwnGoal: true, otherPlayerId: "x" })]);
    expect(m.get("def")?.[0].kind).toBe("own_goal");
    expect(m.has("x")).toBe(false);
  });

  it("puts a substitution on both players, with added time", () => {
    const m = eventsByPlayer([e({ type: "substitution", minute: 45, addedMinutes: 2, playerId: "off", playerName: "Alvin", otherPlayerId: "on", otherPlayerName: "Praise" })]);
    expect(m.get("off")).toEqual([{ kind: "off", minute: "45+2'", text: "Subbed off for Praise" }]);
    expect(m.get("on")).toEqual([{ kind: "on", minute: "45+2'", text: "Came on for Alvin" }]);
  });

  it("tells yellow and red cards apart", () => {
    const m = eventsByPlayer([e({ type: "card", card: "yellow", playerId: "k" }), e({ type: "card", card: "red", playerId: "k", minute: 70 })]);
    expect(m.get("k")?.map((x) => x.kind)).toEqual(["yellow", "red"]);
  });
});
