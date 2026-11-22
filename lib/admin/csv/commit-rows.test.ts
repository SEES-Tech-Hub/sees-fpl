import { describe, expect, it } from "vitest";
import { commitRows } from "./preview";
import { previewPricesCsv } from "./prices";

const teams = [{ id: "t5", year: 5 }];
const players = [
  { id: "p1", teamId: "t5", fullName: "Kolade", displayName: "Kolade", priceTenths: 60 },
  { id: "p2", teamId: "t5", fullName: "Fame", displayName: "Fame", priceTenths: 60 },
];
const context = { teams, players, priceRules: { minTenths: 40, maxTenths: 100, stepTenths: 5 }, priceLocked: false };

describe("commitRows", () => {
  it("sends every valid row, unchanged ones included, with row numbers", () => {
    const preview = previewPricesCsv("full_name,year,price\nKolade,5,7\nFame,5,6", context);
    expect(commitRows(preview)).toEqual([
      { rowNumber: 2, playerId: "p1", priceTenths: 70 },
      { rowNumber: 3, playerId: "p2", priceTenths: 60 },
    ]);
  });

  it("sends nothing when any row has an error", () => {
    const preview = previewPricesCsv("full_name,year,price\nKolade,5,7\nNobody,5,6", context);
    expect(commitRows(preview)).toEqual([]);
  });
});
