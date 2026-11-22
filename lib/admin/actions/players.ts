"use server";

import { assignDisplayNames } from "../domain/display-names";
import { checkPriceTenths, formatPriceNumber, lateAdditionPrice } from "../domain/prices";
import { loadPriceSettings, PLAYER_FIELDS, toAdminPlayer, type AdminPlayer } from "../queries/players";
import { fail, ok, type ActionResult } from "../result";
import { expire } from "../revalidate";
import {
  createPlayerInput,
  parseInput,
  setPlayerPriceInput,
  setPlayerStatusInput,
  updatePlayerInput,
} from "../schemas";
import { databaseFailure, runAdminAction } from "../server";

// Owner: admin backend. Player actions for the admin portal (PRD admin item 3).
// Contract: docs/admin-backend.md. Every action checks the admin role, writes
// with the signed-in client (RLS and the price lock trigger apply) and returns
// an ActionResult.

type PlayerRow = Parameters<typeof toAdminPlayer>[0];

export type CreatePlayerResult = {
  player: AdminPlayer;
  /** Set when a display name was chosen for the player because their name was taken, e.g. "Samuel (DEF)". */
  chosenDisplayName: string | null;
  /** Set when the price lock gave a late addition the lowest price. */
  lateAdditionPrice: number | null;
};

/** Adds a player. Leave displayName empty to have one chosen; after the price lock, leave the price empty. */
export async function createPlayer(input: unknown): Promise<ActionResult<CreatePlayerResult>> {
  return runAdminAction("players.create", async ({ supabase }) => {
    const parsed = parseInput(createPlayerInput, input);
    if (!parsed.ok) return parsed.result;
    const v = parsed.data;

    const prices = await loadPriceSettings(supabase);
    let priceTenths = v.priceTenths;
    let late: number | null = null;
    if (prices.locked) {
      const min = lateAdditionPrice(prices.rules);
      if (priceTenths === undefined) {
        priceTenths = min;
        late = min;
      } else if (priceTenths !== min) {
        return fail("admin.price_locked", `Prices are locked since the matchday 1 deadline. Late additions join at ${formatPriceNumber(min)}.`, {
          fieldErrors: { priceTenths: [`Late additions join at ${formatPriceNumber(min)}`] },
        });
      }
    }
    if (priceTenths === undefined) {
      return fail("admin.invalid_input", "New players need a price.", { fieldErrors: { priceTenths: ["Required"] } });
    }
    const priceProblem = checkPriceTenths(priceTenths, prices.rules);
    if (priceProblem) {
      return fail("admin.price_out_of_range", `${priceProblem}.`, { fieldErrors: { priceTenths: [priceProblem] } });
    }

    let displayName = v.displayName ?? null;
    let chosen: string | null = null;
    if (!displayName) {
      const { data: teammates, error } = await supabase.from("players").select("display_name").eq("team_id", v.teamId);
      if (error) return databaseFailure("players.create", error, { teamId: v.teamId });
      const names = assignDisplayNames(
        [{ key: "new", teamId: v.teamId, fullName: v.fullName, position: v.position, shirtNumber: v.shirtNumber ?? null, displayName: null }],
        (teammates ?? []).map((p) => ({ teamId: v.teamId, displayName: p.display_name })),
      );
      const result = names.get("new");
      if (!result?.ok) {
        return fail("admin.invalid_input", result?.message ?? "Choose a display name.", {
          fieldErrors: { displayName: [result?.message ?? "Required"] },
        });
      }
      displayName = result.displayName;
      if (result.disambiguated) chosen = result.displayName;
    }

    const { data, error } = await supabase
      .from("players")
      .insert({
        team_id: v.teamId,
        full_name: v.fullName,
        display_name: displayName,
        position: v.position,
        shirt_number: v.shirtNumber ?? null,
        price_tenths: priceTenths,
        status: v.status,
      })
      .select(PLAYER_FIELDS)
      .single();
    if (error || !data) return databaseFailure("players.create", error, { teamId: v.teamId });

    expire(["players"]);
    return ok({ player: toAdminPlayer(data as PlayerRow), chosenDisplayName: chosen, lateAdditionPrice: late });
  });
}

/** Edits a player's names, position or shirt number. Price and status have their own actions. */
export async function updatePlayer(input: unknown): Promise<ActionResult<AdminPlayer>> {
  return runAdminAction("players.update", async ({ supabase }) => {
    const parsed = parseInput(updatePlayerInput, input);
    if (!parsed.ok) return parsed.result;
    const { playerId, ...fields } = parsed.data;

    const patch: { full_name?: string; display_name?: string; position?: AdminPlayer["position"]; shirt_number?: number | null } = {};
    if (fields.fullName !== undefined) patch.full_name = fields.fullName;
    if (fields.displayName !== undefined) patch.display_name = fields.displayName;
    if (fields.position !== undefined) patch.position = fields.position;
    if (fields.shirtNumber !== undefined) patch.shirt_number = fields.shirtNumber;
    if (Object.keys(patch).length === 0) return fail("admin.invalid_input", "Nothing to change.");

    const { data, error } = await supabase.from("players").update(patch).eq("id", playerId).select(PLAYER_FIELDS).single();
    if (error || !data) return databaseFailure("players.update", error, { playerId });

    expire(["players"]);
    return ok(toAdminPlayer(data as PlayerRow));
  });
}

/** Available, injured, suspended or left. Allowed after the price lock too. */
export async function setPlayerStatus(input: unknown): Promise<ActionResult<AdminPlayer>> {
  return runAdminAction("players.setStatus", async ({ supabase }) => {
    const parsed = parseInput(setPlayerStatusInput, input);
    if (!parsed.ok) return parsed.result;
    const { playerId, status } = parsed.data;

    const { data, error } = await supabase.from("players").update({ status }).eq("id", playerId).select(PLAYER_FIELDS).single();
    if (error || !data) return databaseFailure("players.setStatus", error, { playerId });

    expire(["players"]);
    return ok(toAdminPlayer(data as PlayerRow));
  });
}

/** Sets one price. Refused with admin.price_locked after the matchday 1 deadline. */
export async function setPlayerPrice(input: unknown): Promise<ActionResult<AdminPlayer>> {
  return runAdminAction("players.setPrice", async ({ supabase }) => {
    const parsed = parseInput(setPlayerPriceInput, input);
    if (!parsed.ok) return parsed.result;
    const { playerId, priceTenths } = parsed.data;

    const prices = await loadPriceSettings(supabase);
    const problem = checkPriceTenths(priceTenths, prices.rules);
    if (problem) {
      return fail("admin.price_out_of_range", `${problem}.`, { fieldErrors: { priceTenths: [problem] } });
    }

    const { data, error } = await supabase
      .from("players")
      .update({ price_tenths: priceTenths })
      .eq("id", playerId)
      .select(PLAYER_FIELDS)
      .single();
    if (error || !data) return databaseFailure("players.setPrice", error, { playerId });

    expire(["players"]);
    return ok(toAdminPlayer(data as PlayerRow));
  });
}
