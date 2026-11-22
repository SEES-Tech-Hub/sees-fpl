"use server";

import type { TablesUpdate } from "@/lib/supabase/types";
import { toAdminEvent, toAdminTeam, type AdminEvent, type AdminSport, type AdminTeam } from "../queries/sports";
import { fail, ok, type ActionResult } from "../result";
import { expire } from "../revalidate";
import {
  createEventInput,
  createSportInput,
  parseInput,
  updateEventInput,
  updateSportInput,
  updateTeamInput,
} from "../schemas";
import { databaseFailure, runAdminAction, type AdminSupabase } from "../server";

// Owner: admin backend. Sports, events and teams (PRD admin items 1 and 2).
// Venues are set per fixture (there's no venue on an event).

const SPORT_FIELDS = "id, slug, name, result_format, sort_order";
const EVENT_FIELDS = "id, sport_id, slug, name, period_minutes, period_count, extra_period_minutes";
const TEAM_FIELDS = "id, year, name, short_name, class_label, coaches";

type SportRow = { id: string; slug: string; name: string; result_format: AdminSport["resultFormat"]; sort_order: number };
const toSport = (row: SportRow): Omit<AdminSport, "events"> => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  resultFormat: row.result_format,
  sortOrder: row.sort_order,
});

/** Creates a sport and picks its result format (timed, sets, head_to_head, ranked). */
export async function createSport(input: unknown): Promise<ActionResult<Omit<AdminSport, "events">>> {
  return runAdminAction("sports.create", async ({ supabase }) => {
    const parsed = parseInput(createSportInput, input);
    if (!parsed.ok) return parsed.result;
    const v = parsed.data;
    const { data, error } = await supabase
      .from("sports")
      .insert({ name: v.name, slug: v.slug, result_format: v.resultFormat, sort_order: v.sortOrder })
      .select(SPORT_FIELDS)
      .single();
    if (error || !data) return databaseFailure("sports.create", error);
    expire(["sports"]);
    return ok(toSport(data));
  });
}

/**
 * Edits a sport. Its result format can't change once any of its fixtures has
 * match events, because the console and pages read those events by format.
 */
export async function updateSport(input: unknown): Promise<ActionResult<Omit<AdminSport, "events">>> {
  return runAdminAction("sports.update", async ({ supabase }) => {
    const parsed = parseInput(updateSportInput, input);
    if (!parsed.ok) return parsed.result;
    const { sportId, ...v } = parsed.data;

    const patch: TablesUpdate<"sports"> = {};
    if (v.name !== undefined) patch.name = v.name;
    if (v.slug !== undefined) patch.slug = v.slug;
    if (v.sortOrder !== undefined) patch.sort_order = v.sortOrder;
    if (v.resultFormat !== undefined) {
      const { data: current, error } = await supabase.from("sports").select("result_format").eq("id", sportId).maybeSingle();
      if (error) return databaseFailure("sports.update", error, { sportId });
      if (!current) return fail("admin.not_found", "That sport wasn't found.");
      if (current.result_format !== v.resultFormat) {
        if (await sportHasMatchEvents(supabase, sportId)) {
          return fail("admin.rule_violation", "This sport already has match results, so its format can't change.", {
            fieldErrors: { resultFormat: ["Has results already"] },
          });
        }
        patch.result_format = v.resultFormat;
      }
    }
    if (Object.keys(patch).length === 0) return fail("admin.invalid_input", "Nothing to change.");

    const { data, error } = await supabase.from("sports").update(patch).eq("id", sportId).select(SPORT_FIELDS).single();
    if (error || !data) return databaseFailure("sports.update", error, { sportId });
    expire(["sports", "fixtures"]);
    return ok(toSport(data));
  });
}

async function sportHasMatchEvents(supabase: AdminSupabase, sportId: string): Promise<boolean> {
  // Small data (about 100 fixtures), so two plain queries.
  const { data: fixtures, error } = await supabase
    .from("fixtures")
    .select("id, event:events!inner ( sport_id )")
    .eq("event.sport_id", sportId);
  if (error) return true; // If the check can't run, be safe and say yes.
  const ids = (fixtures ?? []).map((f) => f.id);
  if (ids.length === 0) return false;
  const { count, error: countError } = await supabase
    .from("match_events")
    .select("id", { count: "exact", head: true })
    .in("fixture_id", ids);
  return countError ? true : (count ?? 0) > 0;
}

/** Adds an event to a sport, e.g. "100 m men", with its period lengths for timed sports. */
export async function createEvent(input: unknown): Promise<ActionResult<AdminEvent>> {
  return runAdminAction("events.create", async ({ supabase }) => {
    const parsed = parseInput(createEventInput, input);
    if (!parsed.ok) return parsed.result;
    const v = parsed.data;
    const { data, error } = await supabase
      .from("events")
      .insert({
        sport_id: v.sportId,
        name: v.name,
        slug: v.slug,
        period_minutes: v.periodMinutes ?? null,
        period_count: v.periodCount ?? null,
        extra_period_minutes: v.extraPeriodMinutes ?? null,
      })
      .select(EVENT_FIELDS)
      .single();
    if (error || !data) return databaseFailure("events.create", error, { sportId: v.sportId });
    expire(["sports"]);
    return ok(toAdminEvent(data));
  });
}

/** Edits an event's name, slug or period lengths. The live clock reads the period lengths. */
export async function updateEvent(input: unknown): Promise<ActionResult<AdminEvent>> {
  return runAdminAction("events.update", async ({ supabase }) => {
    const parsed = parseInput(updateEventInput, input);
    if (!parsed.ok) return parsed.result;
    const { eventId, ...v } = parsed.data;

    const patch: TablesUpdate<"events"> = {};
    if (v.name !== undefined) patch.name = v.name;
    if (v.slug !== undefined) patch.slug = v.slug;
    if (v.periodMinutes !== undefined) patch.period_minutes = v.periodMinutes;
    if (v.periodCount !== undefined) patch.period_count = v.periodCount;
    if (v.extraPeriodMinutes !== undefined) patch.extra_period_minutes = v.extraPeriodMinutes;
    if (Object.keys(patch).length === 0) return fail("admin.invalid_input", "Nothing to change.");

    const { data, error } = await supabase.from("events").update(patch).eq("id", eventId).select(EVENT_FIELDS).single();
    if (error || !data) return databaseFailure("events.update", error, { eventId });
    expire(["sports", "fixtures"]);
    return ok(toAdminEvent(data));
  });
}

/** Edits a year team: name, short name (Y1 to Y5 in CSVs), class label or coaches. */
export async function updateTeam(input: unknown): Promise<ActionResult<AdminTeam>> {
  return runAdminAction("teams.update", async ({ supabase }) => {
    const parsed = parseInput(updateTeamInput, input);
    if (!parsed.ok) return parsed.result;
    const { teamId, ...v } = parsed.data;

    const patch: TablesUpdate<"teams"> = {};
    if (v.name !== undefined) patch.name = v.name;
    if (v.shortName !== undefined) patch.short_name = v.shortName;
    if (v.classLabel !== undefined) patch.class_label = v.classLabel;
    if (v.coaches !== undefined) patch.coaches = v.coaches;
    if (Object.keys(patch).length === 0) return fail("admin.invalid_input", "Nothing to change.");

    const { data, error } = await supabase.from("teams").update(patch).eq("id", teamId).select(TEAM_FIELDS).single();
    if (error || !data) return databaseFailure("teams.update", error, { teamId });
    // Team names appear on every fixture and player list.
    expire(["teams", "players", "fixtures"]);
    return ok(toAdminTeam(data));
  });
}
