"use server";

import { FIXTURE_FIELDS, toAdminFixture, type AdminFixture, type FixtureRow } from "../queries/fixtures";
import { fail, ok, type ActionResult } from "../result";
import { expire } from "../revalidate";
import {
  createFixtureInput,
  parseInput,
  rescheduleFixtureInput,
  setFixtureStatusInput,
  updateFixtureInput,
} from "../schemas";
import { databaseFailure, runAdminAction, type AdminSupabase } from "../server";
import type { TablesUpdate } from "@/lib/supabase/types";
import type { AdminSettableFixtureStatus } from "../types";

// Owner: admin backend. Fixture actions (PRD admin item 4). Scores, periods,
// winners and the live statuses come only from match events (Bolu's guard on
// fixtures refuses them); walkovers go through recordWalkover in
// actions/corrections.ts.

/** Creates a fixture. Teams can be left empty for knockouts that aren't decided yet. */
export async function createFixture(input: unknown): Promise<ActionResult<AdminFixture>> {
  return runAdminAction("fixtures.create", async ({ supabase }) => {
    const parsed = parseInput(createFixtureInput, input);
    if (!parsed.ok) return parsed.result;
    const v = parsed.data;
    if (Boolean(v.homeTeamId) !== Boolean(v.awayTeamId)) {
      return fail("admin.invalid_input", "Give both teams, or leave both empty if they aren't known yet.", {
        fieldErrors: { [v.homeTeamId ? "awayTeamId" : "homeTeamId"]: ["Required with the other team"] },
      });
    }

    const { data, error } = await supabase
      .from("fixtures")
      .insert({
        event_id: v.eventId,
        stage: v.stage,
        home_team_id: v.homeTeamId ?? null,
        away_team_id: v.awayTeamId ?? null,
        kickoff_at: v.kickoffAt ?? null,
        venue: v.venue ?? null,
        matchday_id: v.matchdayId ?? null,
      })
      .select(FIXTURE_FIELDS)
      .single();
    if (error || !data) return databaseFailure("fixtures.create", error, { eventId: v.eventId });

    const fixture = toAdminFixture(data as FixtureRow);
    expire(["fixtures"], [fixture.id]);
    return ok(fixture);
  });
}

/**
 * Edits a fixture's stage, venue, matchday or teams. Teams and event can't
 * change once it has match events (live.has_events).
 */
export async function updateFixture(input: unknown): Promise<ActionResult<AdminFixture>> {
  return runAdminAction("fixtures.update", async ({ supabase }) => {
    const parsed = parseInput(updateFixtureInput, input);
    if (!parsed.ok) return parsed.result;
    const { fixtureId, ...v } = parsed.data;

    const patch: {
      stage?: string;
      home_team_id?: string | null;
      away_team_id?: string | null;
      venue?: string | null;
      matchday_id?: string | null;
    } = {};
    if (v.stage !== undefined) patch.stage = v.stage;
    if (v.homeTeamId !== undefined) patch.home_team_id = v.homeTeamId;
    if (v.awayTeamId !== undefined) patch.away_team_id = v.awayTeamId;
    if (v.venue !== undefined) patch.venue = v.venue;
    if (v.matchdayId !== undefined) patch.matchday_id = v.matchdayId;
    if (Object.keys(patch).length === 0) return fail("admin.invalid_input", "Nothing to change.");

    return writeFixture(supabase, "fixtures.update", fixtureId, patch);
  });
}

/** Moves the kickoff (an ISO time; convert WAT input with watToUtc). Null means time to be confirmed. */
export async function rescheduleFixture(input: unknown): Promise<ActionResult<AdminFixture>> {
  return runAdminAction("fixtures.reschedule", async ({ supabase }) => {
    const parsed = parseInput(rescheduleFixtureInput, input);
    if (!parsed.ok) return parsed.result;
    const { fixtureId, kickoffAt } = parsed.data;
    // Matchday deadlines don't follow kickoffs automatically: the admin sets
    // them with setMatchdayDeadline (the matchdays page shows the first kickoff).
    return writeFixture(supabase, "fixtures.reschedule", fixtureId, { kickoff_at: kickoffAt });
  });
}

/** Postpone. Only before any match events (live.has_events otherwise). */
export async function postponeFixture(fixtureId: unknown): Promise<ActionResult<AdminFixture>> {
  return setStatus(fixtureId, "postponed");
}

/** Cancel. Only before any match events. */
export async function cancelFixture(fixtureId: unknown): Promise<ActionResult<AdminFixture>> {
  return setStatus(fixtureId, "cancelled");
}

/** Back to scheduled, from postponed or cancelled. */
export async function restoreFixture(fixtureId: unknown): Promise<ActionResult<AdminFixture>> {
  return setStatus(fixtureId, "scheduled");
}

async function setStatus(fixtureId: unknown, status: AdminSettableFixtureStatus): Promise<ActionResult<AdminFixture>> {
  return runAdminAction(`fixtures.${status}`, async ({ supabase }) => {
    const parsed = parseInput(setFixtureStatusInput, { fixtureId, status });
    if (!parsed.ok) return parsed.result;
    return writeFixture(supabase, `fixtures.${status}`, parsed.data.fixtureId, { status });
  });
}

async function writeFixture(
  supabase: AdminSupabase,
  action: string,
  fixtureId: string,
  patch: Pick<TablesUpdate<"fixtures">, "stage" | "home_team_id" | "away_team_id" | "venue" | "matchday_id" | "kickoff_at" | "status">,
): Promise<ActionResult<AdminFixture>> {
  const { data, error } = await supabase
    .from("fixtures")
    .update(patch)
    .eq("id", fixtureId)
    .select(FIXTURE_FIELDS)
    .single();
  if (error || !data) return databaseFailure(action, error, { fixtureId });

  expire(["fixtures"], [fixtureId]);
  return ok(toAdminFixture(data as FixtureRow));
}
