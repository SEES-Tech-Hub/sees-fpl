import { describe, expect, it } from "vitest";
import { matchWhat, shareArt, shareCards } from "./match-share";
import type { MatchPageData } from "./match-page";

type D = Parameters<typeof shareCards>[0];

const fixture = (slug: string, resultFormat: string) =>
  ({ event: { slug, name: "Football (men)" }, sport: { slug: slug.split("-")[0], name: "Football", resultFormat } }) as unknown as MatchPageData["fixture"];
const state = (status: string) => ({ status }) as MatchPageData["state"];
const goal = { type: "goal", playerName: "Micheal" } as MatchPageData["timeline"][number];
const motm = { type: "man_of_the_match", playerName: "Wizz" } as MatchPageData["timeline"][number];

const d = (status: string, timeline: MatchPageData["timeline"] = [], slug = "football-men", format = "timed"): D => ({
  fixture: fixture(slug, format),
  state: state(status),
  timeline,
});

describe("shareCards", () => {
  it("offers the poster before kick-off", () => {
    expect(shareCards(d("scheduled"))).toEqual(["poster"]);
  });
  it("offers the live score, and the latest goal once someone scores", () => {
    expect(shareCards(d("live"))).toEqual(["live"]);
    expect(shareCards(d("half_time", [goal]))).toEqual(["live", "goal"]);
  });
  it("offers the result, the player of the match and the goal after full time", () => {
    expect(shareCards(d("full_time", [goal, motm]))).toEqual(["result", "motm", "goal"]);
  });
  it("offers nothing for a cancelled match", () => {
    expect(shareCards(d("cancelled"))).toEqual([]);
  });
  it("gives races the podium only once results are published", () => {
    const race = (position: number | null) => [{ position }] as MatchPageData["race"];
    expect(shareCards({ ...d("full_time", [], "athletics-100m", "ranked"), race: race(null) })).toEqual(["poster"]);
    expect(shareCards({ ...d("full_time", [], "athletics-100m", "ranked"), race: race(1) })).toEqual(["result"]);
  });
  it("has no goal card for sports without goals", () => {
    expect(shareCards(d("full_time", [goal], "board-games-chess-men", "head_to_head"))).toEqual(["result"]);
  });
});

describe("shareArt", () => {
  it.each([
    ["football-women", "football"],
    ["basketball", "basketball"],
    ["volleyball", "sets"],
    ["table-tennis-mixed-doubles", "sets"],
    ["athletics-4x100m-relay-men", "race"],
    ["swimming-male-25m-freestyle", "swimming"],
    ["board-games-chess-women", "chess"],
    ["board-games-draughts", "chess"],
    ["mobile-games-codm", "gaming"],
    ["mortal-kombat-men", "gaming"],
    ["board-games-ludo", "ludo"],
    ["board-games-scrabble", "scrabble"],
    ["board-games-connect-four", "connect4"],
    ["handball", "handball"],
  ])("%s → %s", (slug, art) => {
    expect(shareArt(slug)).toBe(art);
  });
});

describe("matchWhat", () => {
  it("adds the sport only when the event name doesn't say it", () => {
    expect(matchWhat({ sport: { name: "Football" }, event: { name: "Football (men)" } })).toBe("Football (men)");
    expect(matchWhat({ sport: { name: "Table tennis" }, event: { name: "Men's singles" } })).toBe("Table tennis · Men's singles");
    expect(matchWhat({ sport: { name: "Board games" }, event: { name: "Chess (women)" } })).toBe("Chess (women)");
  });
});
