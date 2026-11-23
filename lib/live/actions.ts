"use server";

import { updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  parseFixtureId,
  parseRecordEventInput,
  parseRecordRaceResultsInput,
  parseSetLineupInput,
  parseSetRaceEntriesInput,
  parseUndoEventInput,
  toMatchEvent,
  toRaceEntriesJson,
  toRaceResultsJson,
  toRecordEventArgs,
} from "./commands";
import { toLiveError, toLiveErrorFromThrown } from "./errors";
import { liveTags } from "./tags";
import type {
  ActionResult,
  LiveError,
  MatchEvent,
  RecordEventInput,
  RecordRaceResultsInput,
  SetLineupInput,
  SetRaceEntriesInput,
  UndoEventInput,
} from "./types";

// Live scores: the console API.
//
// Server actions called by the match console (app/console). Each one:
//   1. checks the request is well formed (anyone can call a server action),
//   2. calls a database function as the signed-in user. The database decides
//      who may do what (console holder, admin) and what the match allows,
//   3. expires the cached pages for the fixture,
//   4. returns { ok: true, data } or { ok: false, error }. They never throw
//      for expected problems, so the console can show error.message as it is.
//
// Offline queue: if an action throws (no network) or returns an error with
// retryable: true, keep it in the queue and send it again later with the same
// clientEventId. If retryable is false, drop it and show the message.

function failure(error: LiveError): { ok: false; error: LiveError } {
  if (error.code === "unknown") {
    // Unexpected: worth a line in the server logs. Rule violations are not.
    console.error("[live] unexpected console error", error);
  }
  return { ok: false, error };
}

function expireFixture(fixtureId: string) {
  updateTag(liveTags.fixture(fixtureId));
  updateTag(liveTags.fixtureList);
}

/** Record one event: kickoff, goal, card, substitution, full time and so on. */
export async function recordMatchEvent(input: RecordEventInput): Promise<ActionResult<MatchEvent>> {
  const parsed = parseRecordEventInput(input);
  if (!parsed.ok) return parsed;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("record_match_event", toRecordEventArgs(parsed.data));
    if (error || !data) return failure(toLiveError(error));

    expireFixture(parsed.data.fixtureId);
    if (data.type === "full_time" || data.type === "walkover" || data.type === "goal") {
      updateTag(liveTags.standings);
    }
    return { ok: true, data: toMatchEvent(data) };
  } catch (thrown) {
    return failure(toLiveErrorFromThrown(thrown));
  }
}

/**
 * Undo an event. The holder can undo their latest event for 30 seconds
 * after it reached the server; the admin can void any event with a reason.
 * Undoing twice is harmless.
 */
export async function undoMatchEvent(input: UndoEventInput): Promise<ActionResult<MatchEvent>> {
  const parsed = parseUndoEventInput(input);
  if (!parsed.ok) return parsed;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("void_match_event", {
      p_client_event_id: parsed.data.clientEventId,
      ...(parsed.data.reason ? { p_reason: parsed.data.reason } : {}),
    });
    if (error || !data) return failure(toLiveError(error));

    expireFixture(data.fixture_id);
    updateTag(liveTags.standings);
    return { ok: true, data: toMatchEvent(data) };
  } catch (thrown) {
    return failure(toLiveErrorFromThrown(thrown));
  }
}

/** Set one team's starters and bench. Before kickoff (the admin can at any time). */
export async function setLineup(input: SetLineupInput): Promise<ActionResult<{ playerCount: number }>> {
  const parsed = parseSetLineupInput(input);
  if (!parsed.ok) return parsed;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("set_lineup", {
      p_fixture_id: parsed.data.fixtureId,
      p_team_id: parsed.data.teamId,
      p_starters: parsed.data.starters,
      p_bench: parsed.data.bench,
    });
    if (error || data === null) return failure(toLiveError(error));

    expireFixture(parsed.data.fixtureId);
    return { ok: true, data: { playerCount: data } };
  } catch (thrown) {
    return failure(toLiveErrorFromThrown(thrown));
  }
}

/**
 * Races: set who runs (replaces the list). Officials can change it until
 * results are entered; the admin at any time.
 */
export async function setRaceEntries(input: SetRaceEntriesInput): Promise<ActionResult<{ entrantCount: number }>> {
  const parsed = parseSetRaceEntriesInput(input);
  if (!parsed.ok) return parsed;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("set_race_entries", {
      p_fixture_id: parsed.data.fixtureId,
      p_entries: toRaceEntriesJson(parsed.data.entries),
    });
    if (error || data === null) return failure(toLiveError(error));

    expireFixture(parsed.data.fixtureId);
    return { ok: true, data: { entrantCount: data } };
  } catch (thrown) {
    return failure(toLiveErrorFromThrown(thrown));
  }
}

/**
 * Races: enter places, times and DNF/DNS/DQ. Results stay private until
 * publish: true, which needs a result for every entrant and makes the race
 * final. Officials can't change a published race; the admin can.
 */
export async function recordRaceResults(
  input: RecordRaceResultsInput,
): Promise<ActionResult<{ resultCount: number; published: boolean }>> {
  const parsed = parseRecordRaceResultsInput(input);
  if (!parsed.ok) return parsed;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("record_race_results", {
      p_fixture_id: parsed.data.fixtureId,
      p_results: toRaceResultsJson(parsed.data.results),
      p_publish: parsed.data.publish ?? false,
    });
    if (error || data === null) return failure(toLiveError(error));

    expireFixture(parsed.data.fixtureId);
    return { ok: true, data: { resultCount: data, published: parsed.data.publish ?? false } };
  } catch (thrown) {
    return failure(toLiveErrorFromThrown(thrown));
  }
}

/** "Take this match": become the fixture's console holder (officials only). */
export async function takeFixture(
  fixtureId: string,
): Promise<ActionResult<{ fixtureId: string; holderId: string | null }>> {
  const parsed = parseFixtureId(fixtureId);
  if (!parsed.ok) return parsed;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("take_fixture", { p_fixture_id: parsed.data });
    if (error || !data) return failure(toLiveError(error));

    expireFixture(parsed.data);
    return { ok: true, data: { fixtureId: data.id, holderId: data.console_holder } };
  } catch (thrown) {
    return failure(toLiveErrorFromThrown(thrown));
  }
}

/** "Hand over": stop holding the fixture so another official can take it. */
export async function releaseFixture(
  fixtureId: string,
): Promise<ActionResult<{ fixtureId: string; holderId: string | null }>> {
  const parsed = parseFixtureId(fixtureId);
  if (!parsed.ok) return parsed;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("release_fixture", { p_fixture_id: parsed.data });
    if (error || !data) return failure(toLiveError(error));

    expireFixture(parsed.data);
    return { ok: true, data: { fixtureId: data.id, holderId: data.console_holder } };
  } catch (thrown) {
    return failure(toLiveErrorFromThrown(thrown));
  }
}
