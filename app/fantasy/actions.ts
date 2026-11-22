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

export type OnboardingState = { error?: string; teamName?: string; yearGroup?: string };

export async function createManagerAction(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const user = await api.requireFantasyUser("/fantasy/join");
  const teamName = String(formData.get("teamName") ?? "");
  const yearRaw = String(formData.get("yearGroup") ?? "");
  const yearGroup = yearRaw === "none" ? null : Number(yearRaw);
  if (yearRaw === "" || (yearGroup !== null && Number.isNaN(yearGroup))) {
    return { error: "Pick your year, or “Not in a year team”.", teamName, yearGroup: yearRaw };
  }
  const result = done(await api.createManager(user, { teamName, yearGroup }));
  if (!result.ok) return { error: result.error.message, teamName, yearGroup: yearRaw };
  redirect("/fantasy/squad");
}

export async function saveSquadAction(playerIds: string[]) {
  const user = await api.requireFantasyUser("/fantasy/squad");
  return done(await api.saveSquad(user, { playerIds }));
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
