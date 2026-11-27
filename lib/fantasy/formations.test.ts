import { describe, expect, it } from "vitest";
import { applyFormation, availableFormations, formationName } from "./formations";
import type { Position } from "./types";

const rules = {
  startingSize: 11,
  formation: { GK: { min: 1, max: 1 }, DEF: { min: 3, max: 5 }, MID: { min: 2, max: 5 }, FWD: { min: 1, max: 3 } },
};

// A 2/5/5/3 squad. Prices make the cheapest obvious.
const players: [string, Position, number][] = [
  ["gk1", "GK", 55], ["gk2", "GK", 40],
  ["d1", "DEF", 70], ["d2", "DEF", 60], ["d3", "DEF", 50], ["d4", "DEF", 45], ["d5", "DEF", 40],
  ["m1", "MID", 115], ["m2", "MID", 80], ["m3", "MID", 70], ["m4", "MID", 60], ["m5", "MID", 55],
  ["f1", "FWD", 110], ["f2", "FWD", 80], ["f3", "FWD", 50],
];
const byId = new Map(players.map(([id, position, priceTenths]) => [id, { position, priceTenths }]));
// 4-4-2, bench: gk2, d5, m5, f3.
const order = ["gk1", "d1", "d2", "d3", "d4", "m1", "m2", "m3", "m4", "f1", "f2", "gk2", "d5", "m5", "f3"];
const squad = players.map(([, position]) => ({ position }));

describe("availableFormations", () => {
  it("lists the eight formations a 2/5/5/3 squad can field", () => {
    expect(availableFormations(squad, rules).map(formationName)).toEqual([
      "3-4-3", "3-5-2", "4-3-3", "4-4-2", "4-5-1", "5-2-3", "5-3-2", "5-4-1",
    ]);
  });
});

describe("applyFormation", () => {
  it("brings bench players on in bench order and benches the cheapest starter", () => {
    const r = applyFormation(order, byId, 11, { DEF: 3, MID: 4, FWD: 3 }, new Set());
    expect(r?.cameIn).toEqual(["f3"]);
    expect(r?.wentOut).toEqual(["d4"]);
    expect(r?.order.slice(11)).toEqual(["gk2", "d5", "m5", "d4"]);
  });

  it("keeps the bench goalkeeper first", () => {
    const r = applyFormation(order, byId, 11, { DEF: 5, MID: 4, FWD: 1 }, new Set());
    expect(r?.order[11]).toBe("gk2");
    expect(r?.cameIn).toEqual(["d5"]);
    expect(r?.wentOut).toEqual(["f2"]);
  });

  it("never benches an armband holder while someone else can go", () => {
    const r = applyFormation(order, byId, 11, { DEF: 5, MID: 4, FWD: 1 }, new Set(["f2"]));
    expect(r?.wentOut).toEqual(["f1"]);
  });

  it("leaves the lineup alone for the formation it already has", () => {
    const r = applyFormation(order, byId, 11, { DEF: 4, MID: 4, FWD: 2 }, new Set());
    expect(r).toEqual({ order, cameIn: [], wentOut: [] });
  });

  it("refuses a formation the squad can't field", () => {
    expect(applyFormation(order, byId, 11, { DEF: 3, MID: 3, FWD: 4 }, new Set())).toBeNull();
  });
});
