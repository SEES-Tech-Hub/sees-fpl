// Prices CSV: set many players' prices at once. Every row must match an
// existing player. Format: docs/admin-csv-formats.md.

import { nameKey, normaliseName } from "../domain/names";
import { formatPrice, formatPriceNumber, parsePrice, type PriceRules } from "../domain/prices";
import type { ImportPreview, PreviewRow } from "../types";
import type { ExistingPlayer } from "./players";
import { readTable } from "./parse";
import { buildPreview, cellError, fileErrorPreview, finishRow, rowError } from "./preview";
import { parseYear } from "./values";

export const PRICE_COLUMNS = {
  required: ["full_name", "year", "price"],
  optional: ["display_name"],
} as const;

export type PricesImportContext = {
  teams: ReadonlyArray<{ id: string; year: number }>;
  players: ReadonlyArray<Pick<ExistingPlayer, "id" | "teamId" | "fullName" | "displayName" | "priceTenths">>;
  priceRules: PriceRules;
  priceLocked: boolean;
};

/** One validated row, as sent to admin_set_prices. */
export type PriceImportRow = { playerId: string; priceTenths: number };

export function previewPricesCsv(input: string, context: PricesImportContext): ImportPreview<PriceImportRow> {
  const table = readTable(input, PRICE_COLUMNS);
  if (!table.ok) return fileErrorPreview(table.errors);

  const teamByYear = new Map(context.teams.map((t) => [t.year, t.id]));
  const claimed = new Map<string, number>();

  const rows: PreviewRow<PriceImportRow>[] = table.rows.map(({ rowNumber, values }) => {
    const errors = [...(table.rowErrors.get(rowNumber) ?? [])];
    const changes: string[] = [];
    const err = (column: string, problem: string) => errors.push(cellError(rowNumber, column, problem));

    const fullName = normaliseName(values.full_name);
    if (fullName === "") err("full_name", "is missing");
    const year = parseYear(values.year);
    if (!year.ok) err("year", year.message);
    const teamId = year.ok ? teamByYear.get(year.value) : undefined;
    if (year.ok && !teamId) err("year", `there's no Year ${year.value} team`);

    const price = parsePrice(values.price, context.priceRules);
    if (!price.ok) err("price", price.message);

    let player: PricesImportContext["players"][number] | undefined;
    if (teamId && fullName && year.ok) {
      const displayName = values.display_name ? normaliseName(values.display_name) : null;
      const candidates = context.players.filter(
        (p) =>
          p.teamId === teamId &&
          nameKey(p.fullName) === nameKey(fullName) &&
          (!displayName || nameKey(p.displayName) === nameKey(displayName)),
      );
      if (candidates.length === 1) {
        player = candidates[0];
      } else if (candidates.length === 0) {
        err(
          displayName ? "display_name" : "full_name",
          displayName
            ? `there's no player in Year ${year.value} called ${fullName} shown as "${displayName}"`
            : `there's no player called ${fullName} in Year ${year.value}`,
        );
      } else {
        err(
          "full_name",
          `${candidates.length} players in Year ${year.value} are called ${fullName} (${candidates.map((p) => `"${p.displayName}"`).join(", ")}). Add a display_name column to say which`,
        );
      }
    }

    if (player) {
      const first = claimed.get(player.id);
      if (first !== undefined) errors.push(rowError(rowNumber, `is the same player as row ${first}`));
      else claimed.set(player.id, rowNumber);
    }

    if (!player || !price.ok) {
      return finishRow(rowNumber, errors, [], changes, "unchanged", { playerId: "", priceTenths: 0 });
    }
    if (price.tenths === player.priceTenths) {
      return finishRow(rowNumber, errors, [], changes, "unchanged", { playerId: player.id, priceTenths: price.tenths });
    }
    if (context.priceLocked) {
      err("price", `prices are locked since the matchday 1 deadline (${player.displayName} stays at ${formatPriceNumber(player.priceTenths)})`);
    }
    changes.push(`price ${formatPrice(player.priceTenths)} → ${formatPrice(price.tenths)}`);
    return finishRow(rowNumber, errors, [], changes, "update", { playerId: player.id, priceTenths: price.tenths });
  });

  return buildPreview(rows);
}
