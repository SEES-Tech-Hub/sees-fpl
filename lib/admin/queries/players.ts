import "server-only";
import { cache } from "react";
import { isPriceLocked, type PriceRules } from "../domain/prices";
import { rpcPriceLockAt, rpcPriceRules } from "../rpc";
import { parseInput, listPlayersFilter } from "../schemas";
import { adminReadClient, throwReadError, type AdminSupabase } from "../server";
import type { PlayerPosition, PlayerStatus } from "../types";
import type { z } from "zod";

// Owner: admin backend. Player reads for the admin portal. Server-only; call
// from Server Components inside <Suspense>. Each checks the admin role.

export const PLAYER_FIELDS = `
  id, team_id, full_name, display_name, position, shirt_number, price_tenths, status, updated_at,
  team:teams ( year, short_name )
` as const;

export type AdminPlayer = {
  id: string;
  teamId: string;
  teamYear: number;
  teamShortName: string;
  fullName: string;
  displayName: string;
  position: PlayerPosition;
  shirtNumber: number | null;
  priceTenths: number;
  status: PlayerStatus;
  updatedAt: string;
};

type PlayerRow = {
  id: string;
  team_id: string;
  full_name: string;
  display_name: string;
  position: PlayerPosition;
  shirt_number: number | null;
  price_tenths: number;
  status: PlayerStatus;
  updated_at: string;
  team: { year: number; short_name: string } | null;
};

export function toAdminPlayer(row: PlayerRow): AdminPlayer {
  return {
    id: row.id,
    teamId: row.team_id,
    teamYear: row.team?.year ?? 0,
    teamShortName: row.team?.short_name ?? "?",
    fullName: row.full_name,
    displayName: row.display_name,
    position: row.position,
    shirtNumber: row.shirt_number,
    priceTenths: row.price_tenths,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

const POSITION_ORDER: Record<PlayerPosition, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 };

/** Players by year, then position (GK, DEF, MID, FWD), then display name. About 110 rows, so no paging. */
export const listPlayers = cache(async (filter?: z.input<typeof listPlayersFilter>): Promise<AdminPlayer[]> => {
  const parsed = parseInput(listPlayersFilter, filter ?? {});
  const f = parsed.ok ? parsed.data : {};
  const { supabase } = await adminReadClient();

  let query = supabase.from("players").select(PLAYER_FIELDS);
  if (f.teamId) query = query.eq("team_id", f.teamId);
  if (f.position) query = query.eq("position", f.position);
  if (f.status) query = query.eq("status", f.status);
  if (f.search) {
    const term = f.search.replace(/[%_,()]/g, " ").trim();
    if (term) query = query.or(`full_name.ilike.%${term}%,display_name.ilike.%${term}%`);
  }
  const { data, error } = await query;
  if (error) throwReadError("players", error);

  return ((data ?? []) as PlayerRow[])
    .map(toAdminPlayer)
    .sort(
      (a, b) =>
        a.teamYear - b.teamYear ||
        POSITION_ORDER[a.position] - POSITION_ORDER[b.position] ||
        a.displayName.localeCompare(b.displayName, "en"),
    );
});

/** One player, or null. */
export const getPlayer = cache(async (playerId: string): Promise<AdminPlayer | null> => {
  const { supabase } = await adminReadClient();
  const { data, error } = await supabase.from("players").select(PLAYER_FIELDS).eq("id", playerId).maybeSingle();
  if (error) throwReadError("player", error);
  return data ? toAdminPlayer(data as PlayerRow) : null;
});

export type PriceSettings = {
  rules: PriceRules;
  /** Matchday 1's deadline; prices lock then. Null: no lock yet. */
  lockAt: string | null;
  locked: boolean;
};

/** Loads the price rules and the lock state with a client the caller already has. */
export async function loadPriceSettings(supabase: AdminSupabase, now = new Date()): Promise<PriceSettings> {
  const [rules, lockAt] = await Promise.all([rpcPriceRules(supabase), rpcPriceLockAt(supabase)]);
  if (!rules.ok) throwReadError("price rules", rules.error);
  if (!lockAt.ok) throwReadError("price lock", lockAt.error);
  return { rules: rules.data, lockAt: lockAt.data, locked: isPriceLocked(lockAt.data, now) };
}

/** The price range and step (from admin_price_rules()) and whether prices are locked. */
export const getPriceSettings = cache(async (): Promise<PriceSettings> => {
  const { supabase } = await adminReadClient();
  return loadPriceSettings(supabase);
});
