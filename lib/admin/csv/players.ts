// Players CSV: header mapping, row validation and the preview builder.
// Format: docs/admin-csv-formats.md. Pure: the caller loads the context
// (teams, existing players, price rules, lock state) and the commit RPC
// re-checks everything in the database.

import { assignDisplayNames, type NewPlayerName } from "../domain/display-names";
import { nameKey, normaliseName } from "../domain/names";
import { formatPrice, formatPriceNumber, lateAdditionPrice, parsePrice, type PriceRules } from "../domain/prices";
import type { ImportPreview, PlayerPosition, PlayerStatus, PreviewRow } from "../types";
import { readTable } from "./parse";
import { buildPreview, cellError, fileErrorPreview, finishRow, rowError } from "./preview";
import { parsePosition, parseShirtNumber, parseStatus, parseYear } from "./values";

export const PLAYER_COLUMNS = {
  required: ["full_name", "year", "position", "price"],
  optional: ["shirt_number", "status", "display_name"],
} as const;

export type ExistingPlayer = {
  id: string;
  teamId: string;
  fullName: string;
  displayName: string;
  position: PlayerPosition;
  shirtNumber: number | null;
  priceTenths: number;
  status: PlayerStatus;
};

export type PlayersImportContext = {
  teams: ReadonlyArray<{ id: string; year: number }>;
  players: ReadonlyArray<ExistingPlayer>;
  priceRules: PriceRules;
  /** Matchday 1's deadline has passed (see isPriceLocked). */
  priceLocked: boolean;
};

/** One validated row, as sent to admin_import_players. Updates carry the full intended values. */
export type PlayerImportRow = {
  existingId: string | null;
  teamId: string;
  fullName: string;
  displayName: string;
  position: PlayerPosition;
  shirtNumber: number | null;
  priceTenths: number;
  status: PlayerStatus;
};

type Draft = {
  rowNumber: number;
  errors: string[];
  warnings: string[];
  changes: string[];
  teamId: string | null;
  year: number | null;
  fullName: string;
  displayName: string | null;
  position: PlayerPosition | null;
  shirtNumber: number | null;
  priceTenths: number | null;
  status: PlayerStatus | null;
  existing: ExistingPlayer | null;
};

export function previewPlayersCsv(input: string, context: PlayersImportContext): ImportPreview<PlayerImportRow> {
  const table = readTable(input, PLAYER_COLUMNS);
  if (!table.ok) return fileErrorPreview(table.errors);

  const teamByYear = new Map(context.teams.map((t) => [t.year, t.id]));
  const playersByTeam = new Map<string, ExistingPlayer[]>();
  for (const player of context.players) {
    const list = playersByTeam.get(player.teamId) ?? [];
    list.push(player);
    playersByTeam.set(player.teamId, list);
  }

  // Pass 1: parse each cell and find the existing player, if any.
  const drafts: Draft[] = table.rows.map(({ rowNumber, values }) => {
    const errors = [...(table.rowErrors.get(rowNumber) ?? [])];
    const err = (column: string, problem: string) => errors.push(cellError(rowNumber, column, problem));

    const fullName = normaliseName(values.full_name);
    if (fullName === "") err("full_name", "is missing");
    else if (fullName.length > 80) err("full_name", "is longer than 80 characters");

    const year = parseYear(values.year);
    if (!year.ok) err("year", year.message);
    const teamId = year.ok ? (teamByYear.get(year.value) ?? null) : null;
    if (year.ok && !teamId) err("year", `there's no Year ${year.value} team`);

    const position = parsePosition(values.position);
    if (!position.ok) err("position", position.message);

    const shirt = parseShirtNumber(values.shirt_number);
    if (!shirt.ok) err("shirt_number", shirt.message);

    const status = parseStatus(values.status);
    if (!status.ok) err("status", status.message);

    const displayName = values.display_name ? normaliseName(values.display_name) : null;
    if (displayName && displayName.length > 40) err("display_name", "is longer than 40 characters");

    let priceTenths: number | null = null;
    if (values.price !== "") {
      const price = parsePrice(values.price, context.priceRules);
      if (price.ok) priceTenths = price.tenths;
      else err("price", price.message);
    }

    let existing: ExistingPlayer | null = null;
    const warnings: string[] = [];
    if (teamId && fullName) {
      const teamPlayers = playersByTeam.get(teamId) ?? [];
      const sameName = teamPlayers.filter((p) => nameKey(p.fullName) === nameKey(fullName));
      if (displayName) {
        const byDisplay = teamPlayers.find((p) => nameKey(p.displayName) === nameKey(displayName));
        if (byDisplay && nameKey(byDisplay.fullName) !== nameKey(fullName)) {
          err("display_name", `"${byDisplay.displayName}" is ${byDisplay.fullName}, not ${fullName}`);
        } else if (byDisplay) {
          existing = byDisplay;
        } else if (sameName.length > 0) {
          warnings.push(
            rowError(
              rowNumber,
              `adds another player called ${fullName} to Year ${year.ok ? year.value : "?"} (already there: ${sameName.map((p) => `"${p.displayName}"`).join(", ")}). Display names can't be changed by import`,
            ),
          );
        }
      } else if (sameName.length === 1) {
        existing = sameName[0];
      } else if (sameName.length > 1) {
        err(
          "full_name",
          `${sameName.length} players in Year ${year.ok ? year.value : "?"} are called ${fullName} (${sameName.map((p) => `"${p.displayName}"`).join(", ")}). Add a display_name column to say which`,
        );
      }
    }

    return {
      rowNumber,
      errors,
      warnings,
      changes: [],
      teamId,
      year: year.ok ? year.value : null,
      fullName,
      displayName,
      position: position.ok ? position.value : null,
      shirtNumber: shirt.ok ? shirt.value : null,
      priceTenths,
      status: status.ok ? status.value : null,
      existing,
    };
  });

  // Two rows for the same existing player.
  const claimed = new Map<string, number>();
  for (const draft of drafts) {
    if (!draft.existing) continue;
    const first = claimed.get(draft.existing.id);
    if (first !== undefined) {
      draft.errors.push(rowError(draft.rowNumber, `is the same player as row ${first}`));
    } else {
      claimed.set(draft.existing.id, draft.rowNumber);
    }
  }

  // Pass 2: display names for new players (existing players are never renamed).
  const newNames: NewPlayerName[] = drafts
    .filter((d) => !d.existing && d.teamId && d.fullName && d.position)
    .map((d) => ({
      key: String(d.rowNumber),
      teamId: d.teamId as string,
      fullName: d.fullName,
      position: d.position as PlayerPosition,
      shirtNumber: d.shirtNumber,
      displayName: d.displayName,
    }));
  const names = assignDisplayNames(
    newNames,
    context.players.map((p) => ({ teamId: p.teamId, displayName: p.displayName })),
  );

  const minPrice = lateAdditionPrice(context.priceRules);
  const rows: PreviewRow<PlayerImportRow>[] = drafts.map((draft) => {
    const { rowNumber, errors, warnings, changes, existing } = draft;
    const err = (column: string, problem: string) => errors.push(cellError(rowNumber, column, problem));

    if (existing) {
      let priceTenths = existing.priceTenths;
      if (draft.priceTenths !== null && draft.priceTenths !== existing.priceTenths) {
        if (context.priceLocked) {
          err("price", `prices are locked since the matchday 1 deadline (${existing.displayName} stays at ${formatPriceNumber(existing.priceTenths)})`);
        } else {
          priceTenths = draft.priceTenths;
          changes.push(`price ${formatPrice(existing.priceTenths)} → ${formatPrice(draft.priceTenths)}`);
        }
      }
      const position = draft.position ?? existing.position;
      if (position !== existing.position) {
        changes.push(`position ${existing.position} → ${position}`);
        if (context.priceLocked) {
          warnings.push(rowError(rowNumber, "changing position after fantasy has opened affects managers' squads"));
        }
      }
      const shirtNumber = draft.shirtNumber ?? existing.shirtNumber;
      if (shirtNumber !== existing.shirtNumber) {
        changes.push(`shirt ${existing.shirtNumber ?? "none"} → ${shirtNumber}`);
      }
      const status = draft.status ?? existing.status;
      if (status !== existing.status) changes.push(`status ${existing.status} → ${status}`);

      return finishRow(rowNumber, errors, warnings, changes, changes.length > 0 ? "update" : "unchanged", {
        existingId: existing.id,
        teamId: existing.teamId,
        fullName: existing.fullName,
        displayName: existing.displayName,
        position,
        shirtNumber,
        priceTenths,
        status,
      });
    }

    // New player.
    let priceTenths = draft.priceTenths;
    if (context.priceLocked) {
      if (priceTenths === null) {
        priceTenths = minPrice;
        warnings.push(rowError(rowNumber, `late addition after the price lock, so the price is ${formatPrice(minPrice)}`));
      } else if (priceTenths !== minPrice) {
        err("price", `prices are locked since the matchday 1 deadline; late additions join at ${formatPriceNumber(minPrice)}. Write ${formatPriceNumber(minPrice)} or leave it empty`);
      }
    } else if (priceTenths === null && errors.every((e) => !e.includes(", price:"))) {
      err("price", "is missing (new players need a price)");
    }

    let displayName = "";
    const named = names.get(String(rowNumber));
    if (named && !named.ok) err("display_name", named.message);
    if (named?.ok) {
      displayName = named.displayName;
      if (named.disambiguated) {
        warnings.push(rowError(rowNumber, `new player will show as "${named.displayName}" because ${named.reason}`));
      }
    }

    return finishRow(rowNumber, errors, warnings, changes, "new", {
      existingId: null,
      teamId: draft.teamId ?? "",
      fullName: draft.fullName,
      displayName,
      position: draft.position ?? "MID",
      shirtNumber: draft.shirtNumber,
      priceTenths: priceTenths ?? minPrice,
      status: draft.status ?? "available",
    });
  });

  return buildPreview(rows);
}
