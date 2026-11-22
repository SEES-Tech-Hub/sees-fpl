"use server";

import { previewPlayersCsv } from "../csv/players";
import { previewPricesCsv } from "../csv/prices";
import { loadPriceSettings } from "../queries/players";
import { ok, type ActionResult } from "../result";
import { expire } from "../revalidate";
import { rpcImportPlayers, rpcSetPrices } from "../rpc";
import { commitPlayersInput, commitPricesInput, csvTextInput, parseInput } from "../schemas";
import { databaseFailure, runAdminAction, type AdminSupabase } from "../server";
import type { ImportCounts, ImportPreview, PlayerPosition, PlayerStatus } from "../types";
import type { PlayerImportRow } from "../csv/players";
import type { PriceImportRow } from "../csv/prices";

// Owner: admin backend. CSV imports, in two steps (docs/admin-csv-formats.md):
//   1. preview*Import(csvText): parse and check every row against the database,
//      nothing written. Show rows, errors, warnings and changes.
//   2. commit*Import({ importId, rows: commitRows(preview) }): one database
//      function writes all rows or none. Make importId with
//      crypto.randomUUID() when the admin opens the import; sending the same
//      commit twice writes once.

async function loadPlayerContext(supabase: AdminSupabase) {
  const [teams, players, prices] = await Promise.all([
    supabase.from("teams").select("id, year"),
    supabase.from("players").select("id, team_id, full_name, display_name, position, shirt_number, price_tenths, status"),
    loadPriceSettings(supabase),
  ]);
  const error = teams.error ?? players.error;
  return {
    error,
    context: {
      teams: teams.data ?? [],
      players: (players.data ?? []).map((p) => ({
        id: p.id,
        teamId: p.team_id,
        fullName: p.full_name,
        displayName: p.display_name,
        position: p.position as PlayerPosition,
        shirtNumber: p.shirt_number,
        priceTenths: p.price_tenths,
        status: p.status as PlayerStatus,
      })),
      priceRules: prices.rules,
      priceLocked: prices.locked,
    },
  };
}

export async function previewPlayersImport(csvText: unknown): Promise<ActionResult<ImportPreview<PlayerImportRow>>> {
  return runAdminAction("imports.previewPlayers", async ({ supabase }) => {
    const parsed = parseInput(csvTextInput, csvText);
    if (!parsed.ok) return parsed.result;
    const { error, context } = await loadPlayerContext(supabase);
    if (error) return databaseFailure("imports.previewPlayers", error);
    return ok(previewPlayersCsv(parsed.data, context));
  });
}

export async function commitPlayersImport(input: unknown): Promise<ActionResult<ImportCounts>> {
  return runAdminAction("imports.commitPlayers", async ({ supabase }) => {
    const parsed = parseInput(commitPlayersInput, input);
    if (!parsed.ok) return parsed.result;
    const { importId, rows } = parsed.data;

    const result = await rpcImportPlayers(
      supabase,
      importId,
      rows.map((r) => ({
        row_number: r.rowNumber,
        existing_id: r.existingId,
        team_id: r.teamId,
        full_name: r.fullName,
        display_name: r.displayName,
        position: r.position,
        shirt_number: r.shirtNumber,
        price_tenths: r.priceTenths,
        status: r.status,
      })),
    );
    if (!result.ok) return databaseFailure("imports.commitPlayers", result.error, { importId });

    if (!result.data.alreadyApplied) expire(["players"]);
    return ok(result.data);
  });
}

export async function previewPricesImport(csvText: unknown): Promise<ActionResult<ImportPreview<PriceImportRow>>> {
  return runAdminAction("imports.previewPrices", async ({ supabase }) => {
    const parsed = parseInput(csvTextInput, csvText);
    if (!parsed.ok) return parsed.result;
    const { error, context } = await loadPlayerContext(supabase);
    if (error) return databaseFailure("imports.previewPrices", error);
    return ok(previewPricesCsv(parsed.data, context));
  });
}

export async function commitPricesImport(input: unknown): Promise<ActionResult<ImportCounts>> {
  return runAdminAction("imports.commitPrices", async ({ supabase }) => {
    const parsed = parseInput(commitPricesInput, input);
    if (!parsed.ok) return parsed.result;
    const { importId, rows } = parsed.data;

    const result = await rpcSetPrices(
      supabase,
      importId,
      rows.map((r) => ({ row_number: r.rowNumber, player_id: r.playerId, price_tenths: r.priceTenths })),
    );
    if (!result.ok) return databaseFailure("imports.commitPrices", result.error, { importId });

    if (!result.data.alreadyApplied) expire(["players"]);
    return ok(result.data);
  });
}
