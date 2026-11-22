import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { DatabaseErrorLike } from "./errors";
import type { AdminSupabase } from "./server";

// Owner: admin backend. Calls to the admin database functions.
//
// TODO(regen): the functions from the admin_players_prices, admin_fixtures_import
// and admin_set_role migrations aren't in
// lib/supabase/types.ts until Tayo applies them and regenerates it. Until
// then they are called through an untyped client here, and every result is
// checked with a schema, so nothing unchecked reaches the actions. After the
// regeneration, switch these to supabase.rpc() directly and delete the casts.

type RpcResult<T> = { ok: true; data: T } | { ok: false; error: DatabaseErrorLike };

async function call<T>(
  supabase: AdminSupabase,
  fn: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<RpcResult<T>> {
  const untyped = supabase as unknown as SupabaseClient;
  const { data, error } = await untyped.rpc(fn, args);
  if (error) return { ok: false, error };
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: { code: "XX000", message: `Unexpected result shape from ${fn}` } };
  }
  return { ok: true, data: parsed.data };
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export const importCountsSchema = z.object({
  inserted: z.number().int(),
  updated: z.number().int(),
  unchanged: z.number().int(),
  alreadyApplied: z.boolean(),
});

const priceRulesSchema = z
  .array(z.object({ min_tenths: z.number().int(), max_tenths: z.number().int(), step_tenths: z.number().int() }))
  .length(1)
  .transform(([r]) => ({ minTenths: r.min_tenths, maxTenths: r.max_tenths, stepTenths: r.step_tenths }));

const releasedFixtureSchema = z.object({
  id: z.string(),
  kickoffAt: z.string().nullable(),
  stage: z.string(),
  status: z.string(),
  eventName: z.string(),
  home: z.string().nullable(),
  away: z.string().nullable(),
});

const setRoleSchema = z.object({
  profileId: z.string(),
  role: z.enum(["user", "official", "admin"]),
  releasedFixtures: z.array(releasedFixtureSchema),
});

export type ReleasedFixture = z.infer<typeof releasedFixtureSchema>;
export type SetRoleResult = z.infer<typeof setRoleSchema>;

// ---------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------

export function rpcPriceRules(supabase: AdminSupabase) {
  return call(supabase, "admin_price_rules", {}, priceRulesSchema);
}

export function rpcPriceLockAt(supabase: AdminSupabase) {
  return call(supabase, "admin_price_lock_at", {}, z.string().nullable());
}

export type PlayerImportRpcRow = {
  row_number: number;
  existing_id: string | null;
  team_id: string;
  full_name: string;
  display_name: string;
  position: string;
  shirt_number: number | null;
  price_tenths: number;
  status: string;
};

export function rpcImportPlayers(supabase: AdminSupabase, importId: string, rows: PlayerImportRpcRow[]) {
  return call(supabase, "admin_import_players", { p_import_id: importId, p_rows: rows }, importCountsSchema);
}

export type PriceImportRpcRow = { row_number: number; player_id: string; price_tenths: number };

export function rpcSetPrices(supabase: AdminSupabase, importId: string, rows: PriceImportRpcRow[]) {
  return call(supabase, "admin_set_prices", { p_import_id: importId, p_rows: rows }, importCountsSchema);
}

export type FixtureImportRpcRow = {
  row_number: number;
  existing_id: string | null;
  event_id: string;
  stage: string;
  home_team_id: string | null;
  away_team_id: string | null;
  kickoff_at: string | null;
  venue: string | null;
  matchday_id: string | null;
};

export function rpcImportFixtures(supabase: AdminSupabase, importId: string, rows: FixtureImportRpcRow[]) {
  return call(supabase, "admin_import_fixtures", { p_import_id: importId, p_rows: rows }, importCountsSchema);
}

export function rpcSetRole(supabase: AdminSupabase, profileId: string, role: "user" | "official") {
  return call(supabase, "admin_set_role", { p_profile_id: profileId, p_role: role }, setRoleSchema);
}
