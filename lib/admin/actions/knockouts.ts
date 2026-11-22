"use server";

import { ok, failWith, fail, type ActionResult } from "../result";
import { expire } from "../revalidate";
import { fillKnockoutsInput, parseInput } from "../schemas";
import { databaseFailure, runAdminAction } from "../server";
import { mapDatabaseError } from "../errors";

// Owner: admin backend. "Fill the finals" (PRD admin item 4): calls Bolu's
// fill_football_knockouts(), which puts 1st v 2nd into the final and 3rd v 4th
// into the third-place match from his football_standings view. An explicit
// admin action, never automatic (a late correction could still change the
// table). Safe to repeat. See "Knockouts and bans" in docs/live-scores.md.

export type FilledKnockout = { fixtureId: string; stage: string; homeTeamId: string | null; awayTeamId: string | null };

export async function fillKnockouts(input: unknown): Promise<ActionResult<{ fixtures: FilledKnockout[] }>> {
  return runAdminAction("fixtures.fillKnockouts", async ({ supabase }) => {
    const parsed = parseInput(fillKnockoutsInput, input);
    if (!parsed.ok) return parsed.result;
    const { eventId } = parsed.data;

    const { data, error } = await supabase.rpc("fill_football_knockouts", { p_event_id: eventId });
    if (error) {
      // Bolu's rule codes (live.league_not_finished, live.standings_tied,
      // live.has_events, ...) come through with his messages.
      const mapped = mapDatabaseError(error);
      return mapped.code.startsWith("live.") ? failWith(mapped) : databaseFailure("fixtures.fillKnockouts", error, { eventId });
    }
    const fixtures = (data ?? []).map((f) => ({
      fixtureId: f.id,
      stage: f.stage,
      homeTeamId: f.home_team_id,
      awayTeamId: f.away_team_id,
    }));
    if (fixtures.length === 0) return fail("admin.not_found", "This event has no final or third-place fixture.");

    expire(
      ["fixtures"],
      fixtures.map((f) => f.fixtureId),
    );
    return ok({ fixtures });
  });
}
