import { describe, expect, it } from "vitest";
import { matchRatings, ratingBand } from "./ratings";
import type { LineupPlayer, TimelineEntry } from "./types";

const HOME = "home";
const AWAY = "away";

const player = (id: string, teamId: string, position: LineupPlayer["position"], over: Partial<LineupPlayer> = {}): LineupPlayer => ({
  playerId: id,
  teamId,
  name: id,
  position,
  shirtNumber: null,
  role: "starter",
  appeared: true,
  onPitch: true,
  sentOff: false,
  yellowCards: 0,
  ...over,
});

let n = 0;
const ev = (over: Partial<TimelineEntry>): TimelineEntry =>
  ({
    id: ++n, clientEventId: String(n), type: "goal", period: "first_half", teamId: HOME, teamShortName: null,
    playerId: null, playerName: null, otherPlayerId: null, otherPlayerName: null, card: null,
    isPenalty: false, isOwnGoal: false, scored: null, points: null, occurredAt: "", minute: 10, addedMinutes: null, ...over,
  }) as TimelineEntry;

describe("matchRatings", () => {
  it("starts everyone who played at 6.0, plus a clean sheet where it applies", () => {
    const r = matchRatings([player("st", HOME, "FWD"), player("gk", HOME, "GK")], []);
    expect(r.get("st")).toBe(6);
    expect(r.get("gk")).toBe(7);
  });

  it("leaves out unused substitutes", () => {
    const r = matchRatings([player("sub", HOME, "MID", { role: "bench", appeared: false })], []);
    expect(r.has("sub")).toBe(false);
  });

  it("rewards goals and assists", () => {
    const r = matchRatings(
      [player("st", HOME, "FWD"), player("mid", HOME, "MID")],
      [ev({ playerId: "st", otherPlayerId: "mid" }), ev({ playerId: "st", minute: 30 })],
    );
    expect(r.get("st")).toBe(8);
    expect(r.get("mid")).toBe(7.1); // 6 + 0.8 assist + 0.3 clean sheet
  });

  it("counts saves (capped) and a penalty save for the keeper", () => {
    const saves = Array.from({ length: 10 }, (_, i) => ev({ type: "save", teamId: HOME, playerId: "gk", minute: i + 1 }));
    const r = matchRatings(
      [player("gk", HOME, "GK")],
      [...saves, ev({ type: "penalty_miss", teamId: AWAY, playerId: "taker", otherPlayerId: "gk", minute: 20 })],
    );
    expect(r.get("gk")).toBe(10); // 6 + 2 (saves cap) + 1 (penalty) + 1 (clean sheet)
  });

  it("charges goals conceded only while the player was on", () => {
    const r = matchRatings(
      [player("def", HOME, "DEF", { onPitch: false }), player("sub", HOME, "DEF", { role: "bench" })],
      [
        ev({ teamId: AWAY, minute: 5 }),
        ev({ type: "substitution", teamId: HOME, playerId: "def", otherPlayerId: "sub", minute: 20 }),
        ev({ teamId: AWAY, minute: 30 }),
        ev({ teamId: AWAY, minute: 40 }),
      ],
    );
    expect(r.get("def")).toBe(5.7); // one conceded while on
    expect(r.get("sub")).toBe(5.4); // two conceded after coming on
  });

  it("takes off for cards and own goals, and never goes below 3", () => {
    const r = matchRatings(
      [player("def", HOME, "DEF")],
      [
        ev({ teamId: AWAY, playerId: "def", isOwnGoal: true }),
        ev({ type: "card", card: "yellow", playerId: "def", minute: 11 }),
        ev({ type: "card", card: "red", playerId: "def", minute: 12 }),
        ev({ teamId: AWAY, minute: 5 }),
        ev({ teamId: AWAY, minute: 6 }),
        ev({ teamId: AWAY, minute: 7 }),
      ],
    );
    expect(r.get("def")).toBe(3);
  });
});

describe("ratingBand", () => {
  it.each([
    [8.4, "great"],
    [7, "good"],
    [6.2, "ok"],
    [5.1, "poor"],
  ] as const)("%s → %s", (rating, band) => {
    expect(ratingBand(rating)).toBe(band);
  });
});
