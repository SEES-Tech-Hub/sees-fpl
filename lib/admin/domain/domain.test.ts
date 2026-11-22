import { describe, expect, it } from "vitest";
import { computeDeadline, checkDeadlineOverride } from "./deadlines";
import { assignDisplayNames, type NewPlayerName } from "./display-names";
import { estimateDurationMinutes, findScheduleWarnings, type ScheduleSlot } from "./fixtures";
import { nameKey, normaliseName } from "./names";
import { checkPriceTenths, formatPrice, isPriceLocked, lateAdditionPrice, parsePrice } from "./prices";
import { utcToWat, watToUtc } from "./wat";

// Mirrors the players check constraint today (40..100, step 5). In the app
// these come from admin_price_rules(); tests pass them in like the app does.
const RULES = { minTenths: 40, maxTenths: 100, stepTenths: 5 };

describe("names", () => {
  it("trims, collapses spaces and compares without case", () => {
    expect(normaliseName("  Samuel   Okafor ")).toBe("Samuel Okafor");
    expect(nameKey("SAMUEL  okafor")).toBe(nameKey("Samuel Okafor"));
  });
  it("keeps accents", () => {
    expect(nameKey("Anófi")).not.toBe(nameKey("Anofi"));
  });
});

describe("prices", () => {
  it.each([
    ["4.0", 40],
    ["4", 40],
    ["5.5", 55],
    ["10.0", 100],
    ["₦6.5m", 65],
    ["N7m", 70],
    [" 8.50 ", 85],
  ])("parses %s as %i tenths", (text, tenths) => {
    expect(parsePrice(text, RULES)).toEqual({ ok: true, tenths });
  });

  it("refuses 3.5 (below the minimum)", () => {
    expect(parsePrice("3.5", RULES)).toEqual({ ok: false, message: "3.5 is below the minimum of 4.0" });
  });
  it("refuses 10.5 (above the maximum)", () => {
    expect(parsePrice("10.5", RULES)).toEqual({ ok: false, message: "10.5 is above the maximum of 10.0" });
  });
  it("refuses 11.0 with the message from the CSV doc", () => {
    expect(parsePrice("11.0", RULES)).toEqual({ ok: false, message: "11.0 is above the maximum of 10.0" });
  });
  it("refuses 5.25 rather than rounding it", () => {
    const result = parsePrice("5.25", RULES);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("step of 0.5");
  });
  it("refuses 5.3 (not a step of 0.5)", () => {
    expect(parsePrice("5.3", RULES)).toEqual({ ok: false, message: "5.3 isn't a step of 0.5" });
  });
  it("refuses text and empty values", () => {
    expect(parsePrice("", RULES).ok).toBe(false);
    expect(parsePrice("five", RULES).ok).toBe(false);
    expect(parsePrice("-5", RULES).ok).toBe(false);
  });
  it("uses the rules it is given, not fixed numbers", () => {
    expect(checkPriceTenths(35, { minTenths: 30, maxTenths: 120, stepTenths: 5 })).toBeNull();
    expect(checkPriceTenths(110, { minTenths: 30, maxTenths: 120, stepTenths: 10 })).toBeNull();
    expect(checkPriceTenths(105, { minTenths: 30, maxTenths: 120, stepTenths: 10 })).not.toBeNull();
  });
  it("formats tenths", () => {
    expect(formatPrice(55)).toBe("₦5.5m");
    expect(formatPrice(100)).toBe("₦10.0m");
  });
  it("locks only once matchday 1's deadline has passed, and never without one", () => {
    const deadline = "2026-11-28T12:30:00Z";
    expect(isPriceLocked(null, new Date("2030-01-01T00:00:00Z"))).toBe(false);
    expect(isPriceLocked(deadline, new Date("2026-11-28T12:29:59Z"))).toBe(false);
    expect(isPriceLocked(deadline, new Date("2026-11-28T12:30:00Z"))).toBe(true);
  });
  it("gives late additions the lowest price", () => {
    expect(lateAdditionPrice(RULES)).toBe(40);
  });
});

describe("WAT to UTC", () => {
  it("converts a Lagos afternoon kickoff", () => {
    const result = watToUtc("2026-11-28", "16:00");
    expect(result.ok && result.date.toISOString()).toBe("2026-11-28T15:00:00.000Z");
  });
  it("crosses midnight backwards: 00:30 WAT is 23:30 UTC the day before", () => {
    const result = watToUtc("2026-12-01", "00:30");
    expect(result.ok && result.date.toISOString()).toBe("2026-11-30T23:30:00.000Z");
  });
  it("crosses a month and year boundary", () => {
    const result = watToUtc("2027-01-01", "00:15");
    expect(result.ok && result.date.toISOString()).toBe("2026-12-31T23:15:00.000Z");
  });
  it("accepts H:MM", () => {
    const result = watToUtc("2026-11-28", "9:05");
    expect(result.ok && result.date.toISOString()).toBe("2026-11-28T08:05:00.000Z");
  });
  it.each([
    ["2026-11-31", "16:00"],
    ["28/11/2026", "16:00"],
    ["2026-11-28", "24:00"],
    ["2026-11-28", "4pm"],
    ["2026-11-28", "16:60"],
  ])("refuses %s %s", (date, time) => {
    expect(watToUtc(date, time).ok).toBe(false);
  });
  it("round-trips through utcToWat", () => {
    expect(utcToWat("2026-11-30T23:30:00.000Z")).toEqual({ date: "2026-12-01", time: "00:30" });
  });
});

describe("deadlines", () => {
  it("is the offset before the earliest kickoff, ignoring empty ones", () => {
    expect(computeDeadline([null, "2026-11-28T15:00:00Z", "2026-11-28T13:00:00Z"], 30)).toBe(
      "2026-11-28T12:30:00.000Z",
    );
  });
  it("is null with no kickoffs", () => {
    expect(computeDeadline([null], 30)).toBeNull();
  });
  it("refuses an override after the first kickoff", () => {
    expect(checkDeadlineOverride("2026-11-28T13:01:00Z", ["2026-11-28T13:00:00Z"])).not.toBeNull();
    expect(checkDeadlineOverride("2026-11-28T12:00:00Z", ["2026-11-28T13:00:00Z"])).toBeNull();
  });
});

describe("display names", () => {
  const T2 = "team-2";
  const T4 = "team-4";
  const player = (key: string, fullName: string, extra: Partial<NewPlayerName> = {}): NewPlayerName => ({
    key,
    teamId: T2,
    fullName,
    position: "DEF",
    shirtNumber: null,
    displayName: null,
    ...extra,
  });

  it("uses the full name when it's free", () => {
    const result = assignDisplayNames([player("a", "  Kolade  Ade ")], []);
    expect(result.get("a")).toEqual({ ok: true, displayName: "Kolade Ade", disambiguated: false, reason: null });
  });

  it("gives a surname initial when an existing player already has the name", () => {
    const result = assignDisplayNames([player("a", "Samuel Okafor")], [{ teamId: T2, displayName: "samuel okafor" }]);
    expect(result.get("a")).toMatchObject({ ok: true, displayName: "Samuel O.", disambiguated: true });
  });

  it("uses more surname letters if the initial is also taken", () => {
    const result = assignDisplayNames(
      [player("a", "Samuel Okafor")],
      [
        { teamId: T2, displayName: "Samuel Okafor" },
        { teamId: T2, displayName: "Samuel O." },
      ],
    );
    expect(result.get("a")).toMatchObject({ displayName: "Samuel Ok." });
  });

  it("disambiguates every new player sharing a full name, by position", () => {
    const result = assignDisplayNames(
      [player("a", "Samuel"), player("b", "Samuel", { position: "FWD" })],
      [],
    );
    expect(result.get("a")).toMatchObject({ displayName: "Samuel (DEF)", disambiguated: true });
    expect(result.get("b")).toMatchObject({ displayName: "Samuel (FWD)", disambiguated: true });
  });

  it("falls back to shirt number, then a counter", () => {
    const result = assignDisplayNames(
      [
        player("a", "Ayo", { shirtNumber: 7 }),
        player("b", "Ayo", { shirtNumber: 9 }),
        player("c", "Ayo"),
      ],
      [],
    );
    expect(result.get("a")).toMatchObject({ displayName: "Ayo (DEF)" });
    expect(result.get("b")).toMatchObject({ displayName: "Ayo #9" });
    expect(result.get("c")).toMatchObject({ displayName: "Ayo 2" });
  });

  it("never treats players in other teams as a clash", () => {
    const result = assignDisplayNames([player("a", "Atom", { teamId: T4 })], [{ teamId: "team-3", displayName: "Atom" }]);
    expect(result.get("a")).toMatchObject({ displayName: "Atom", disambiguated: false });
  });

  it("uses an explicit display name, and refuses one that's taken", () => {
    const result = assignDisplayNames(
      [player("a", "Samuel", { displayName: "Samuel (MID)" }), player("b", "Samuel", { displayName: "Samuel (DEF)" })],
      [{ teamId: T2, displayName: "Samuel (DEF)" }],
    );
    expect(result.get("a")).toMatchObject({ ok: true, displayName: "Samuel (MID)" });
    expect(result.get("b")).toMatchObject({ ok: false });
  });
});

describe("schedule warnings", () => {
  const slot = (key: string, kickoffAt: string | null, teamIds: string[], venue: string | null = null): ScheduleSlot => ({
    key,
    label: key,
    kickoffAt,
    durationMinutes: 60,
    venue,
    teamIds,
  });

  it("estimates duration from periods, with a fallback", () => {
    expect(estimateDurationMinutes(25, 2)).toBe(60);
    expect(estimateDurationMinutes(null, null)).toBe(60);
  });

  it("warns when a team plays twice at overlapping times", () => {
    const warnings = findScheduleWarnings(
      [slot("new", "2026-11-28T15:30:00Z", ["y1", "y2"])],
      [slot("old", "2026-11-28T15:00:00Z", ["y1", "y4"])],
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ key: "new", otherKey: "old", kind: "team_clash" });
  });

  it("warns on the same venue, case-insensitively", () => {
    const warnings = findScheduleWarnings(
      [slot("new", "2026-11-28T15:00:00Z", ["y3", "y5"], "Sports Centre")],
      [slot("old", "2026-11-28T15:30:00Z", ["y1", "y4"], "sports centre ")],
    );
    expect(warnings.map((w) => w.kind)).toEqual(["venue_overlap"]);
  });

  it("doesn't warn for back-to-back fixtures or a fixture it reschedules", () => {
    expect(
      findScheduleWarnings(
        [slot("new", "2026-11-28T16:00:00Z", ["y1", "y2"]), slot("old", "2026-11-28T18:00:00Z", ["y1", "y4"])],
        [slot("old", "2026-11-28T16:30:00Z", ["y1", "y4"])],
      ),
    ).toEqual([]);
  });

  it("reports a clash between two new rows once, on the later row", () => {
    const warnings = findScheduleWarnings(
      [slot("row:2", "2026-11-28T15:00:00Z", ["y1", "y2"]), slot("row:3", "2026-11-28T15:00:00Z", ["y1", "y3"])],
      [],
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0].key).toBe("row:3");
  });
});

describe("fixture labels", () => {
  it("matches Tayo's dashboard labels", async () => {
    const { fixtureLabel } = await import("./fixtures");
    expect(fixtureLabel("league", "Y1", "Y4")).toBe("Y1 v Y4");
    expect(fixtureLabel("final", "Y5", "Y3")).toBe("Final: Y5 v Y3");
    expect(fixtureLabel("third_place", null, null)).toBe("Third place (teams to be confirmed)");
    expect(fixtureLabel("heat_1", null, null)).toBe("Entrants to be confirmed");
  });
});

describe("watDayBounds", () => {
  it("is the Lagos day, which starts at 23:00 UTC the day before", async () => {
    const { watDayBounds } = await import("./wat");
    const { start, end } = watDayBounds(new Date("2026-11-27T23:30:00Z")); // 00:30 WAT on the 28th
    expect(start.toISOString()).toBe("2026-11-27T23:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-28T23:00:00.000Z");
  });
  it("crosses a month end", async () => {
    const { watDayBounds } = await import("./wat");
    const { start, end } = watDayBounds(new Date("2026-11-30T12:00:00Z"));
    expect([start.toISOString(), end.toISOString()]).toEqual(["2026-11-29T23:00:00.000Z", "2026-11-30T23:00:00.000Z"]);
  });
});
