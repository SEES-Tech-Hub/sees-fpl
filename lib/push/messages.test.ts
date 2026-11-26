import { describe, expect, it } from "vitest";
import type { LiveFixture, MatchEvent, TimelineEntry } from "@/lib/live/types";
import { matchMessage } from "./messages";

const Y1 = { id: "t1", name: "Year 1", shortName: "Y1", year: 1 };
const Y2 = { id: "t2", name: "Year 2", shortName: "Y2", year: 2 };

function fixture(over: Partial<LiveFixture> = {}, sport: Partial<LiveFixture["sport"]> = {}): LiveFixture {
  return {
    id: "f1",
    stage: "league",
    status: "live",
    kickoffAt: null,
    venue: null,
    matchdayId: null,
    consoleHolderId: null,
    home: Y1,
    away: Y2,
    homeScore: 1,
    awayScore: 0,
    homeShootout: null,
    awayShootout: null,
    winnerTeamId: null,
    currentPeriod: "first_half",
    periodStartedAt: null,
    currentSet: null,
    homeSetPoints: null,
    awaySetPoints: null,
    homeEntrant: null,
    awayEntrant: null,
    tie: null,
    leg: null,
    winnerSide: null,
    event: {
      id: "e1",
      slug: "football-men",
      name: "Football (men)",
      periodMinutes: 25,
      extraPeriodMinutes: 7,
      periodCount: 2,
      boards: null,
      setsToWin: null,
      setPoints: null,
      finalSetPoints: null,
      setWinBy: null,
      setPointsCap: null,
    },
    sport: { slug: "football", name: "Football", resultFormat: "timed", ...sport },
    ...over,
  };
}

const event = (over: Partial<MatchEvent>): MatchEvent => ({
  id: 1,
  fixtureId: "f1",
  clientEventId: "c1",
  type: "goal",
  period: "first_half",
  teamId: "t1",
  playerId: null,
  otherPlayerId: null,
  card: null,
  isPenalty: false,
  isOwnGoal: false,
  scored: null,
  points: 1,
  side: null,
  board: null,
  occurredAt: "",
  recordedAt: "",
  voidedAt: null,
  voidReason: null,
  ...over,
});

const entry = (over: Partial<TimelineEntry>): TimelineEntry => ({
  id: 1,
  clientEventId: "c1",
  type: "goal",
  period: "first_half",
  teamId: "t1",
  teamShortName: "Y1",
  playerId: null,
  playerName: null,
  otherPlayerId: null,
  otherPlayerName: null,
  card: null,
  isPenalty: false,
  isOwnGoal: false,
  scored: null,
  points: 1,
  occurredAt: "",
  minute: 12,
  addedMinutes: null,
  ...over,
});

describe("matchMessage", () => {
  // A goal as both the event and its timeline entry, with the goals before it.
  const goalAt = (n: number, teamId: string, minute: number, over: Partial<TimelineEntry> = {}) =>
    entry({ id: n, clientEventId: `g${n}`, teamId, minute, period: minute > 25 ? "second_half" : "first_half", ...over });
  const story = (goals: TimelineEntry[], score: [number, number]) => {
    const last = goals[goals.length - 1];
    return matchMessage(
      event({ clientEventId: last.clientEventId, teamId: last.teamId }),
      fixture({ homeScore: score[0], awayScore: score[1] }),
      last,
      goals,
    );
  };

  it("calls the first goal an opener", () => {
    const m = story([goalAt(1, "t1", 12, { playerName: "Ayo" })], [1, 0]);
    expect(m).toEqual({ title: "Year 1 take the lead! Y1 1–0 Y2", body: "Ayo opens the scoring 12'", audience: "major" });
  });

  it("calls an equaliser", () => {
    const m = story([goalAt(1, "t1", 12), goalAt(2, "t2", 30, { playerName: "Deo" })], [1, 1]);
    expect(m?.title).toBe("LEVEL! Y1 1–1 Y2");
    expect(m?.body).toBe("Deo equalises 30'");
  });

  it("calls a comeback when a side that trailed goes ahead", () => {
    const m = story([goalAt(1, "t1", 5), goalAt(2, "t2", 20), goalAt(3, "t2", 31, { playerName: "Zeke" })], [1, 2]);
    expect(m?.title).toBe("COMEBACK! Year 2 lead Y1 1–2 Y2");
  });

  it("calls a late winner in the last five minutes", () => {
    const m = story([goalAt(1, "t1", 10), goalAt(2, "t2", 30), goalAt(3, "t1", 47, { playerName: "Ayo" })], [2, 1]);
    expect(m?.title).toBe("LATE WINNER?! Y1 2–1 Y2");
  });

  it("calls a brace and a hat-trick", () => {
    const p = { playerId: "p1", playerName: "Ayo" };
    expect(story([goalAt(1, "t1", 5, p), goalAt(2, "t1", 15, p)], [2, 0])?.title).toBe("Ayo again! Y1 2–0 Y2");
    expect(story([goalAt(1, "t1", 5, p), goalAt(2, "t1", 15, p), goalAt(3, "t1", 30, p)], [3, 0])?.title).toBe("HAT-TRICK! Y1 3–0 Y2");
  });

  it("calls a penalty that isn't a bigger story", () => {
    const m = story([goalAt(1, "t1", 5), goalAt(2, "t1", 20, { isPenalty: true, playerName: "Ore" })], [2, 0]);
    expect(m?.title).toBe("PENALTY SCORED! Y1 2–0 Y2");
  });

  it("skips every basket in basketball", () => {
    expect(matchMessage(event({ points: 2 }), fixture({}, { slug: "basketball", name: "Basketball" }), null)).toBeNull();
  });

  it("tells a save from a miss", () => {
    const saved = matchMessage(event({ type: "penalty_miss" }), fixture(), entry({ playerName: "Deo", otherPlayerName: "Zeke" }));
    expect(saved?.title).toMatch(/^Penalty saved!/);
    expect(saved?.body).toBe("Zeke keeps out Deo 12'");
    const missed = matchMessage(event({ type: "penalty_miss" }), fixture(), entry({ playerName: "Deo" }));
    expect(missed?.title).toMatch(/^Penalty missed!/);
  });

  it("sends yellow cards to followers only, red cards to everyone", () => {
    expect(matchMessage(event({ type: "card", card: "yellow" }), fixture(), entry({ playerName: "Ore" }))?.audience).toBe("minor");
    expect(matchMessage(event({ type: "card", card: "red" }), fixture(), entry({ playerName: "Ore" }))?.audience).toBe("major");
  });

  it("names the winner, a draw, or a shootout", () => {
    expect(matchMessage(event({ type: "full_time" }), fixture({ status: "full_time", homeScore: 2, awayScore: 1, winnerTeamId: "t1" }), null)?.title).toBe(
      "Year 1 win! Y1 2–1 Y2",
    );
    expect(matchMessage(event({ type: "full_time" }), fixture({ status: "full_time", homeScore: 1, awayScore: 1 }), null)?.title).toBe(
      "Honours even: Y1 1–1 Y2",
    );
    const pens = matchMessage(
      event({ type: "full_time" }),
      fixture({ status: "full_time", homeScore: 1, awayScore: 1, homeShootout: 3, awayShootout: 4, winnerTeamId: "t2" }),
      null,
    );
    expect(pens?.title).toBe("Year 2 win on penalties!");
  });

  it("gives the result when the last set ends a sets match", () => {
    const m = matchMessage(
      event({ type: "set_end" }),
      fixture({ status: "full_time", homeScore: 2, awayScore: 0, winnerSide: "home" }, { slug: "volleyball", name: "Volleyball", resultFormat: "sets" }),
      null,
    );
    expect(m?.title).toBe("Year 1 win! Y1 2–0 Y2");
  });

  it("shows board-game scores in halves", () => {
    const f = fixture(
      { status: "full_time", homeScore: 3, awayScore: 1, winnerSide: "home", event: { ...fixture().event, boards: 2, name: "Scrabble", slug: "board-games-scrabble" } },
      { slug: "board-games", name: "Board Games", resultFormat: "head_to_head" },
    );
    expect(matchMessage(event({ type: "full_time" }), f, null)?.title).toBe("Year 1 win! Y1 1½–½ Y2");
  });
});
