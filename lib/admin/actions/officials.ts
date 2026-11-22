"use server";

import { FIXTURE_FIELDS, toAdminFixture, type AdminFixture, type FixtureRow } from "../queries/fixtures";
import { ok, type ActionResult } from "../result";
import { expire } from "../revalidate";
import { rpcSetRole, type SetRoleResult } from "../rpc";
import { parseInput, setConsoleHolderInput, setRoleInput } from "../schemas";
import { databaseFailure, runAdminAction } from "../server";

// Owner: admin backend. Officials and console holders (PRD admin item 5).

/**
 * Promotes an account to official, or makes it a plain user again. Demoting
 * releases every unfinished fixture the account holds; they're returned in
 * releasedFixtures so the page can warn. Setting the same role again is a no-op.
 */
export async function setRole(input: unknown): Promise<ActionResult<SetRoleResult>> {
  return runAdminAction("officials.setRole", async ({ supabase }) => {
    const parsed = parseInput(setRoleInput, input);
    if (!parsed.ok) return parsed.result;
    const { profileId, role } = parsed.data;

    const result = await rpcSetRole(supabase, profileId, role);
    if (!result.ok) return databaseFailure("officials.setRole", result.error, { profileId });

    expire(["officials"], result.data.releasedFixtures.map((f) => f.id));
    return ok(result.data);
  });
}

/**
 * Sets a fixture's console holder to exactly this account (an official or
 * admin), or clears it with null. "Set to", so retrying is safe. Refused with
 * live.holder_not_official for anyone else.
 */
export async function setConsoleHolder(input: unknown): Promise<ActionResult<AdminFixture>> {
  return runAdminAction("officials.setHolder", async ({ supabase }) => {
    const parsed = parseInput(setConsoleHolderInput, input);
    if (!parsed.ok) return parsed.result;
    const { fixtureId, profileId } = parsed.data;

    const { data, error } = await supabase
      .from("fixtures")
      .update({ console_holder: profileId })
      .eq("id", fixtureId)
      .select(FIXTURE_FIELDS)
      .single();
    if (error || !data) return databaseFailure("officials.setHolder", error, { fixtureId });

    expire(["officials"], [fixtureId]);
    return ok(toAdminFixture(data as FixtureRow));
  });
}
