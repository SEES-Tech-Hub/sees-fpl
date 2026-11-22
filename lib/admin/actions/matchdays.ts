"use server";

import { checkDeadlineOverride } from "../domain/deadlines";
import { fail, ok, type ActionResult } from "../result";
import { expire } from "../revalidate";
import { parseInput, setMatchdayDeadlineInput } from "../schemas";
import { databaseFailure, runAdminAction } from "../server";

// Owner: admin backend. Matchday deadlines (PRD admin item 6).
//
// There is no automatic recalculation: the admin sets each deadline here, and
// the matchdays page shows the first kickoff next to it (listMatchdays). Moving
// a kickoff never moves a deadline. Matchday 1's deadline is also when player
// prices lock. Finalising and recalculating points is in actions/corrections.ts.

export type MatchdayDeadline = { matchdayId: string; number: number; deadlineAt: string };

/** Sets a matchday's deadline. It can't be after the matchday's first kickoff. */
export async function setMatchdayDeadline(input: unknown): Promise<ActionResult<MatchdayDeadline>> {
  return runAdminAction("matchdays.setDeadline", async ({ supabase }) => {
    const parsed = parseInput(setMatchdayDeadlineInput, input);
    if (!parsed.ok) return parsed.result;
    const { matchdayId, deadlineAt } = parsed.data;

    const { data: fixtures, error: readError } = await supabase
      .from("fixtures")
      .select("kickoff_at")
      .eq("matchday_id", matchdayId)
      .not("status", "in", "(cancelled,postponed)");
    if (readError) return databaseFailure("matchdays.setDeadline", readError, { matchdayId });

    const problem = checkDeadlineOverride(deadlineAt, (fixtures ?? []).map((f) => f.kickoff_at));
    if (problem) return fail("admin.invalid_input", problem, { fieldErrors: { deadlineAt: [problem] } });

    const { data, error } = await supabase
      .from("matchdays")
      .update({ deadline_at: deadlineAt })
      .eq("id", matchdayId)
      .select("id, number, deadline_at")
      .single();
    if (error || !data || !data.deadline_at) return databaseFailure("matchdays.setDeadline", error, { matchdayId });

    // Matchday 1's deadline is the price lock, so player pages change too.
    expire(data.number === 1 ? ["matchdays", "players"] : ["matchdays"]);
    return ok({ matchdayId: data.id, number: data.number, deadlineAt: data.deadline_at });
  });
}
