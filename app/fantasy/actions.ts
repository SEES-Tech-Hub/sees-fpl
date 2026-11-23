"use server";

// Server Actions for the fantasy screens. Each one checks who is calling and
// hands over to lib/fantasy/api.ts, which owns every backend call.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as api from "@/lib/fantasy/api";
import type { ActionResult, LineupInput, TransferInput } from "@/lib/fantasy/types";

function done<T>(result: ActionResult<T>) {
  if (result.ok) revalidatePath("/fantasy", "layout");
  return result;
}

export async function saveSquadAction(playerIds: string[]) {
  const user = await api.requireFantasyUser("/fantasy/squad");
  return done(await api.saveSquad(user, { playerIds }));
}

/**
 * New managers name their team and pick their squad in one go, so there's
 * only one wait. Creates the team if it doesn't exist yet (a retry after a
 * failed squad save skips straight to the squad), then saves the squad.
 */
export async function createTeamAndSquadAction(input: { teamName: string; yearGroup: number | null; playerIds: string[] }) {
  const user = await api.requireFantasyUser("/fantasy/squad");
  if (!(await api.getMyManager(user))) {
    const created = await api.createManager(user, { teamName: input.teamName, yearGroup: input.yearGroup });
    if (!created.ok) return created;
  }
  return done(await api.saveSquad(user, { playerIds: input.playerIds }));
}

export async function saveLineupAction(input: LineupInput) {
  const user = await api.requireFantasyUser("/fantasy/team");
  return done(await api.saveLineup(user, input));
}

export async function makeTransfersAction(input: TransferInput) {
  const user = await api.requireFantasyUser("/fantasy/transfers");
  return done(await api.makeTransfers(user, input));
}

export async function activateWildcardAction() {
  const user = await api.requireFantasyUser("/fantasy/transfers");
  return done(await api.activateWildcard(user));
}

export type LeagueFormState = { error?: string; value?: string };

export async function createLeagueAction(_prev: LeagueFormState, formData: FormData): Promise<LeagueFormState> {
  const user = await api.requireFantasyUser("/fantasy/leagues");
  const name = String(formData.get("name") ?? "");
  const result = done(await api.createLeague(user, { name }));
  if (!result.ok) return { error: result.error.message, value: name };
  redirect(`/fantasy/leagues/${result.data.id}`);
}

export async function joinLeagueAction(_prev: LeagueFormState, formData: FormData): Promise<LeagueFormState> {
  const user = await api.requireFantasyUser("/fantasy/leagues");
  const code = String(formData.get("code") ?? "");
  const result = done(await api.joinLeague(user, { code }));
  if (!result.ok) return { error: result.error.message, value: code };
  redirect(`/fantasy/leagues/${result.data.id}`);
}
