"use server";

import type { Analytics } from "../analytics";
import { fail, ok, type ActionResult } from "../result";
import { runAdminAction } from "../server";

/** Fresh numbers for Admin → Analytics (the page refreshes "online now" with this). */
export async function loadAnalytics(days: number): Promise<ActionResult<Analytics>> {
  return runAdminAction("analytics.read", async ({ supabase }) => {
    const window = [7, 30, 90].includes(days) ? days : 30;
    const { data, error } = await supabase.rpc("admin_analytics", { p_days: window });
    if (error || !data) return fail("admin.unavailable", "Couldn't load the analytics. Try again.", { retryable: true });
    return ok(data as unknown as Analytics);
  });
}
