"use server";

import { after } from "next/server";
import { sendFantasyResults } from "@/lib/push/personal";

import { recalculateMatchdayAndRankings } from "@/lib/fantasy/actions";
import { recordMatchEvent, undoMatchEvent } from "@/lib/live/actions";
import type { ActionResult as LiveResult, MatchEvent, RecordEventInput } from "@/lib/live/types";
import { fail, failWith, ok, type ActionResult, type AdminError } from "../result";
import { expire } from "../revalidate";
import { correctMatchEventInput, matchdayIdInput, parseInput, recordWalkoverInput, voidEventInput } from "../schemas";
import { databaseFailure, runAdminAction, type AdminSupabase } from "../server";

// Owner: admin backend. Walkovers, corrections and fantasy recalculation
// (PRD admin items 4, 6 and 7).
//
// Match events are written only through Bolu's API (lib/live/actions.ts); the
// database decides what's allowed and keeps the history (voided_by,
// voided_at, void_reason), which the audit feed reads. Points are recalculated
// through Mary's recalculateMatchdayAndRankings (lib/fantasy/actions.ts).

/** Bolu's errors keep their code, prefixed with "live.", and their message (written for people). */
function fromLive(error: { code: string; message: string; retryable: boolean }): AdminError {
  if (error.code === "unknown") {
    return { code: "admin.unexpected", message: "Something went wrong. Try again.", retryable: false };
  }
  if (error.code === "unavailable") {
    return { code: "admin.unavailable", message: error.message, retryable: true };
  }
  return { code: `live.${error.code}`, message: error.message, retryable: error.retryable };
}

function liveOk<T>(result: LiveResult<T>): result is { ok: true; data: T } {
  return result.ok;
}

export type RecalculationOutcome =
  | { status: "done"; managersUpdated: number; finalised: boolean }
  | { status: "skipped"; reason: "no_matchday" | "before_deadline" }
  | { status: "failed"; error: AdminError };

type MatchdayInfo = { id: string; status: string; deadlineAt: string | null };

async function matchdayOfFixture(supabase: AdminSupabase, fixtureId: string): Promise<MatchdayInfo | null> {
  const { data } = await supabase
    .from("fixtures")
    .select("matchday:matchdays ( id, status, deadline_at )")
    .eq("id", fixtureId)
    .maybeSingle();
  const md = data?.matchday as { id: string; status: string; deadline_at: string | null } | null | undefined;
  return md ? { id: md.id, status: md.status, deadlineAt: md.deadline_at } : null;
}

/**
 * Calls Mary's recalculation. A finalised matchday stays finalised; before
 * the deadline there are no locked picks, so nothing to recalculate.
 */
async function recalculate(matchday: MatchdayInfo, finalise?: boolean): Promise<RecalculationOutcome> {
  const keepFinal = finalise ?? matchday.status === "finalised";
  try {
    const result = await recalculateMatchdayAndRankings({ matchdayId: matchday.id, finalise: keepFinal });
    if (result.ok) return { status: "done", managersUpdated: result.data.managersUpdated, finalised: keepFinal };
    console.error("[admin] fantasy recalculation refused", { matchdayId: matchday.id, code: result.error.code });
    return {
      status: "failed",
      error:
        result.error.code === "DB_ERROR"
          ? { code: "admin.unexpected", message: "Points couldn't be recalculated. Try again.", retryable: true }
          : { code: "admin.rule_violation", message: result.error.message, retryable: false },
    };
  } catch (thrown) {
    // Mary's engine uses the server's secret key, which exists only on Vercel.
    const message = thrown instanceof Error ? thrown.message : "";
    console.error("[admin] fantasy recalculation threw", { matchdayId: matchday.id });
    return {
      status: "failed",
      error: /SUPABASE_SECRET_KEY|createAdminClient/.test(message)
        ? { code: "admin.unavailable", message: "Points can only be recalculated on the deployed site.", retryable: false }
        : { code: "admin.unexpected", message: "Points couldn't be recalculated. Try again.", retryable: true },
    };
  }
}

async function recalculateAfterCorrection(supabase: AdminSupabase, fixtureId: string): Promise<RecalculationOutcome> {
  const matchday = await matchdayOfFixture(supabase, fixtureId);
  if (!matchday) return { status: "skipped", reason: "no_matchday" };
  const deadlinePassed = matchday.deadlineAt !== null && new Date(matchday.deadlineAt).getTime() <= Date.now();
  if (!deadlinePassed && matchday.status !== "finalised") return { status: "skipped", reason: "before_deadline" };
  return recalculate(matchday);
}

export type CorrectionResult = {
  voided: MatchEvent;
  recorded: MatchEvent | null;
  /** Fantasy points for the fixture's matchday (after the deadline only). */
  recalculation: RecalculationOutcome;
};

/**
 * Records a walkover: the awarded team wins 3-0 (or `points`) and no player
 * scores fantasy points. Only before the fixture has any events.
 */
export async function recordWalkover(input: unknown): Promise<ActionResult<{ event: MatchEvent; recalculation: RecalculationOutcome }>> {
  return runAdminAction("corrections.walkover", async ({ supabase }) => {
    const parsed = parseInput(recordWalkoverInput, input);
    if (!parsed.ok) return parsed.result;
    const { fixtureId, awardedTeamId, clientEventId, points } = parsed.data;

    const result = await recordMatchEvent({
      type: "walkover",
      fixtureId,
      clientEventId,
      teamId: awardedTeamId,
      ...(points !== undefined ? { points } : {}),
    });
    if (!liveOk(result)) return failWith(fromLive(result.error));

    expire(["fixtures"], [fixtureId]);
    return ok({ event: result.data, recalculation: await recalculateAfterCorrection(supabase, fixtureId) });
  });
}

/** Voids any event (after full time too). The reason is required and kept with the event. */
export async function voidMatchEvent(input: unknown): Promise<ActionResult<CorrectionResult>> {
  return runAdminAction("corrections.void", async ({ supabase }) => {
    const parsed = parseInput(voidEventInput, input);
    if (!parsed.ok) return parsed.result;

    const voided = await undoMatchEvent({ clientEventId: parsed.data.clientEventId, reason: parsed.data.reason });
    if (!liveOk(voided)) return failWith(fromLive(voided.error));

    expire(["fixtures"], [voided.data.fixtureId]);
    return ok({
      voided: voided.data,
      recorded: null,
      recalculation: await recalculateAfterCorrection(supabase, voided.data.fixtureId),
    });
  });
}

/**
 * Corrects an event: voids it with a reason, then records the replacement
 * (if any) in the same fixture. After full time the replacement may carry
 * the real, earlier occurredAt. Then recalculates the matchday's points.
 *
 * Bolu's API has no single call for both, so if the void works and the
 * replacement is refused, the result is an error whose message says so; send
 * the same input again (same ids) once it's fixed: the void isn't repeated.
 */
export async function correctMatchEvent(input: unknown): Promise<ActionResult<CorrectionResult>> {
  return runAdminAction("corrections.correct", async ({ supabase }) => {
    const parsed = parseInput(correctMatchEventInput, input);
    if (!parsed.ok) return parsed.result;
    const { voidClientEventId, reason, replacement } = parsed.data;

    const { data: original, error } = await supabase
      .from("match_events")
      .select("fixture_id")
      .eq("client_event_id", voidClientEventId)
      .maybeSingle();
    if (error) return databaseFailure("corrections.correct", error, { voidClientEventId });
    if (!original) return fail("live.event_not_found", "That event wasn't found.");
    if (replacement && replacement.fixtureId !== original.fixture_id) {
      return fail("admin.invalid_input", "The corrected event must be in the same fixture.", {
        fieldErrors: { replacement: ["Different fixture"] },
      });
    }

    const voided = await undoMatchEvent({ clientEventId: voidClientEventId, reason });
    if (!liveOk(voided)) return failWith(fromLive(voided.error));
    expire(["fixtures"], [original.fixture_id]);

    let recorded: MatchEvent | null = null;
    if (replacement) {
      const result = await recordMatchEvent(replacement as RecordEventInput);
      if (!liveOk(result)) {
        const error = fromLive(result.error);
        return failWith({
          ...error,
          message: `The old event was voided, but the corrected one wasn't recorded: ${error.message}`,
        });
      }
      recorded = result.data;
    }

    return ok({
      voided: voided.data,
      recorded,
      recalculation: await recalculateAfterCorrection(supabase, original.fixture_id),
    });
  });
}

async function loadMatchday(supabase: AdminSupabase, matchdayId: string): Promise<MatchdayInfo | null> {
  const { data } = await supabase.from("matchdays").select("id, status, deadline_at").eq("id", matchdayId).maybeSingle();
  return data ? { id: data.id, status: data.status, deadlineAt: data.deadline_at } : null;
}

/** Finalises a matchday's points and rankings (Mary's engine). Safe to repeat. */
export async function finaliseMatchday(input: unknown): Promise<ActionResult<{ managersUpdated: number }>> {
  return runAdminAction("matchdays.finalise", async ({ supabase }) => {
    const parsed = parseInput(matchdayIdInput, input);
    if (!parsed.ok) return parsed.result;
    const matchday = await loadMatchday(supabase, parsed.data.matchdayId);
    if (!matchday) return fail("admin.not_found", "That matchday wasn't found.");

    const outcome = await recalculate(matchday, true);
    expire(["matchdays"]);
    if (outcome.status === "failed") return failWith(outcome.error);
    // Tell each manager their score (once per matchday; after the admin has their answer).
    after(() => sendFantasyResults(matchday.id).catch((e) => console.error("[push] fantasy results failed:", e)));
    return ok({ managersUpdated: outcome.status === "done" ? outcome.managersUpdated : 0 });
  });
}

/** Recalculates a matchday's points without changing whether it's finalised. */
export async function recalculateMatchday(input: unknown): Promise<ActionResult<{ managersUpdated: number; finalised: boolean }>> {
  return runAdminAction("matchdays.recalculate", async ({ supabase }) => {
    const parsed = parseInput(matchdayIdInput, input);
    if (!parsed.ok) return parsed.result;
    const matchday = await loadMatchday(supabase, parsed.data.matchdayId);
    if (!matchday) return fail("admin.not_found", "That matchday wasn't found.");

    const outcome = await recalculate(matchday);
    expire(["matchdays"]);
    if (outcome.status === "failed") return failWith(outcome.error);
    return ok({
      managersUpdated: outcome.status === "done" ? outcome.managersUpdated : 0,
      finalised: outcome.status === "done" && outcome.finalised,
    });
  });
}
