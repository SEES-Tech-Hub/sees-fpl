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
  it("announces a football goal to everyone", () => {
    const m = matchMessage(event({}), fixture(), entry({ playerName: "Ayo" }));
    expect(m).toEqual({ title: "GOAL! Y1 1–0 Y2", body: "Ayo 12' · Football", audience: "major" });
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

  it("gives the result when the last set ends a sets match", () => {
    const m = matchMessage(
      event({ type: "set_end" }),
      fixture({ status: "full_time", homeScore: 2, awayScore: 0, winnerSide: "home" }, { slug: "volleyball", name: "Volleyball", resultFormat: "sets" }),
      null,
    );
    expect(m?.title).toBe("Full time: Y1 2–0 Y2");
    expect(m?.body).toMatch(/^Year 1 wins/);
  });

  it("shows board-game scores in halves", () => {
    const f = fixture(
      { status: "full_time", homeScore: 3, awayScore: 1, winnerSide: "home", event: { ...fixture().event, boards: 2, name: "Scrabble", slug: "board-games-scrabble" } },
      { slug: "board-games", name: "Board Games", resultFormat: "head_to_head" },
    );
    expect(matchMessage(event({ type: "full_time" }), f, null)?.title).toBe("Full time: Y1 1½–½ Y2");
  });
});
