import "server-only";
import { z } from "zod";
import type { Json } from "@/lib/supabase/types";
import type { DatabaseErrorLike } from "./errors";
import type { AdminSupabase } from "./server";

// Owner: admin backend. Calls to the admin database functions, typed by the
// generated lib/supabase/types.ts. The functions that return jsonb come back
// as Json, so each result is checked with a schema before an action sees it.

type RpcResult<T> = { ok: true; data: T } | { ok: false; error: DatabaseErrorLike };

function checked<T>(
  fn: string,
  response: { data: unknown; error: DatabaseErrorLike | null },
  schema: z.ZodType<T>,
): RpcResult<T> {
  if (response.error) return { ok: false, error: response.error };
  const parsed = schema.safeParse(response.data);
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

export async function rpcPriceRules(supabase: AdminSupabase) {
  return checked("admin_price_rules", await supabase.rpc("admin_price_rules"), priceRulesSchema);
}

export async function rpcPriceLockAt(supabase: AdminSupabase) {
  return checked("admin_price_lock_at", await supabase.rpc("admin_price_lock_at"), z.string().nullable());
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

export async function rpcImportPlayers(supabase: AdminSupabase, importId: string, rows: PlayerImportRpcRow[]) {
  const response = await supabase.rpc("admin_import_players", { p_import_id: importId, p_rows: rows satisfies Json });
  return checked("admin_import_players", response, importCountsSchema);
}

export type PriceImportRpcRow = { row_number: number; player_id: string; price_tenths: number };

export async function rpcSetPrices(supabase: AdminSupabase, importId: string, rows: PriceImportRpcRow[]) {
  const response = await supabase.rpc("admin_set_prices", { p_import_id: importId, p_rows: rows satisfies Json });
  return checked("admin_set_prices", response, importCountsSchema);
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

export async function rpcImportFixtures(supabase: AdminSupabase, importId: string, rows: FixtureImportRpcRow[]) {
  const response = await supabase.rpc("admin_import_fixtures", { p_import_id: importId, p_rows: rows satisfies Json });
  return checked("admin_import_fixtures", response, importCountsSchema);
}

export async function rpcSetRole(supabase: AdminSupabase, profileId: string, role: "user" | "official") {
  const response = await supabase.rpc("admin_set_role", { p_profile_id: profileId, p_role: role });
  return checked("admin_set_role", response, setRoleSchema);
}
