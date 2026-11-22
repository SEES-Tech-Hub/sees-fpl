"use server";

import { previewFixturesCsv, type ExistingFixture, type FixtureImportRow } from "../csv/fixtures";
import { previewPlayersCsv } from "../csv/players";
import { previewPricesCsv } from "../csv/prices";
import { loadPriceSettings } from "../queries/players";
import { ok, type ActionResult } from "../result";
import { expire } from "../revalidate";
import { rpcImportFixtures, rpcImportPlayers, rpcSetPrices } from "../rpc";
import { commitFixturesInput, commitPlayersInput, commitPricesInput, csvTextInput, parseInput } from "../schemas";
import { databaseFailure, runAdminAction, type AdminSupabase } from "../server";
import type { FixtureStatus, ImportCounts, ImportPreview, PlayerPosition, PlayerStatus } from "../types";
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

async function loadFixtureContext(supabase: AdminSupabase) {
  const [sports, events, teams, matchdays, fixtures] = await Promise.all([
    supabase.from("sports").select("id, slug, name"),
    supabase.from("events").select("id, sport_id, slug, name, period_minutes, period_count"),
    supabase.from("teams").select("id, short_name, name"),
    supabase.from("matchdays").select("id, number"),
    supabase
      .from("fixtures")
      .select("id, event_id, stage, home_team_id, away_team_id, kickoff_at, venue, matchday_id, status"),
  ]);
  const error = sports.error ?? events.error ?? teams.error ?? matchdays.error ?? fixtures.error;
  return {
    error,
    context: {
      sports: sports.data ?? [],
      events: (events.data ?? []).map((e) => ({
        id: e.id,
        sportId: e.sport_id,
        slug: e.slug,
        name: e.name,
        periodMinutes: e.period_minutes,
        periodCount: e.period_count,
      })),
      teams: (teams.data ?? []).map((t) => ({ id: t.id, shortName: t.short_name, name: t.name })),
      matchdays: matchdays.data ?? [],
      fixtures: (fixtures.data ?? []).map(
        (f): ExistingFixture => ({
          id: f.id,
          ref: null,
          eventId: f.event_id,
          stage: f.stage,
          homeTeamId: f.home_team_id,
          awayTeamId: f.away_team_id,
          kickoffAt: f.kickoff_at,
          venue: f.venue,
          matchdayId: f.matchday_id,
          status: f.status as FixtureStatus,
        }),
      ),
      // fixtures.ref isn't in the database (pending Tayo), so a ref column is refused.
      supportsRef: false,
      now: new Date(),
    },
  };
}

export async function previewFixturesImport(csvText: unknown): Promise<ActionResult<ImportPreview<FixtureImportRow>>> {
  return runAdminAction("imports.previewFixtures", async ({ supabase }) => {
    const parsed = parseInput(csvTextInput, csvText);
    if (!parsed.ok) return parsed.result;
    const { error, context } = await loadFixtureContext(supabase);
    if (error) return databaseFailure("imports.previewFixtures", error);
    return ok(previewFixturesCsv(parsed.data, context));
  });
}

export async function commitFixturesImport(input: unknown): Promise<ActionResult<ImportCounts>> {
  return runAdminAction("imports.commitFixtures", async ({ supabase }) => {
    const parsed = parseInput(commitFixturesInput, input);
    if (!parsed.ok) return parsed.result;
    const { importId, rows } = parsed.data;

    const result = await rpcImportFixtures(
      supabase,
      importId,
      rows.map((r) => ({
        row_number: r.rowNumber,
        existing_id: r.existingId,
        event_id: r.eventId,
        stage: r.stage,
        home_team_id: r.homeTeamId,
        away_team_id: r.awayTeamId,
        kickoff_at: r.kickoffAt,
        venue: r.venue,
        matchday_id: r.matchdayId,
      })),
    );
    if (!result.ok) return databaseFailure("imports.commitFixtures", result.error, { importId });

    if (!result.data.alreadyApplied) expire(["fixtures", "matchdays"]);
    return ok(result.data);
  });
}
