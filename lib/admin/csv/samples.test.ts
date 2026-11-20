// The sample files in docs/samples must always import cleanly.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { previewFixturesCsv } from "./fixtures";
import { previewPlayersCsv } from "./players";
import { previewPricesCsv } from "./prices";

const sample = (name: string) => readFileSync(join(process.cwd(), "docs/samples", name), "utf8");
const RULES = { minTenths: 40, maxTenths: 100, stepTenths: 5 };
const teams = [1, 2, 3, 4, 5].map((year) => ({ id: `t${year}`, year, shortName: `Y${year}`, name: `Year ${year}` }));

describe("docs/samples", () => {
  const players = previewPlayersCsv(sample("players.csv"), { teams, players: [], priceRules: RULES, priceLocked: false });

  it("players.csv imports into an empty database with no errors or renames", () => {
    expect(players.fileErrors).toEqual([]);
    expect(players.counts).toEqual({ new: 103, update: 0, unchanged: 0, error: 0 });
    expect(players.rows.flatMap((r) => r.warnings)).toEqual([]);
  });

  it("players.csv re-imported over itself changes nothing", () => {
    const existing = players.rows.map((r, i) => {
      const v = r.value!;
      return { ...v, id: `p${i}` };
    });
    const again = previewPlayersCsv(sample("players.csv"), { teams, players: existing, priceRules: RULES, priceLocked: false });
    expect(again.counts).toEqual({ new: 0, update: 0, unchanged: 103, error: 0 });
  });

  it("prices.csv matches every seeded player", () => {
    const existing = players.rows.map((r, i) => ({ ...r.value!, id: `p${i}` }));
    const prices = previewPricesCsv(sample("prices.csv"), { teams, players: existing, priceRules: RULES, priceLocked: false });
    expect(prices.counts).toEqual({ new: 0, update: 0, unchanged: 103, error: 0 });
  });

  it("fixtures.csv imports with no errors", () => {
    const fixtures = previewFixturesCsv(sample("fixtures.csv"), {
      sports: [{ id: "s-fb", slug: "football", name: "Football" }],
      events: [{ id: "e-fb", sportId: "s-fb", slug: "football-men", name: "Football (men)", periodMinutes: 25, periodCount: 2 }],
      teams,
      matchdays: [1, 2, 3, 4, 5, 6].map((number) => ({ id: `md${number}`, number })),
      fixtures: [],
      supportsRef: false,
      now: new Date("2026-11-20T09:00:00Z"),
    });
    expect(fixtures.fileErrors).toEqual([]);
    expect(fixtures.counts).toEqual({ new: 12, update: 0, unchanged: 0, error: 0 });
    expect(fixtures.rows[0].value?.kickoffAt).toBe("2026-11-28T13:00:00.000Z");
  });
});
