import "server-only";
import { unstable_rethrow } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { mapDatabaseError, type DatabaseErrorLike } from "./errors";
import { failWith, type ActionResult } from "./result";

// Owner: admin backend. The plumbing every admin action and query shares.
//
// Every action:
//   const result = await runAdminAction("players.create", async ({ supabase }) => { ... });
// which checks requireRole("admin") first (non-admins get the not-found page),
// hands over the signed-in client (row-level security applies and the audit
// log records the admin; never the secret key), and turns anything thrown into
// an admin.unexpected result, logged on the server with ids only.

export type AdminSupabase = Awaited<ReturnType<typeof createClient>>;

export type AdminContext = {
  supabase: AdminSupabase;
  /** The signed-in admin's profile id. */
  adminId: string;
};

/** Logs what went wrong with ids only (no emails or names) and returns a safe result. */
export function databaseFailure<T = never>(
  action: string,
  error: DatabaseErrorLike | null | undefined,
  ids: Record<string, string | number | null | undefined> = {},
): ActionResult<T> {
  const mapped = mapDatabaseError(error);
  if (mapped.code === "admin.unexpected" || mapped.code === "admin.unavailable") {
    console.error(`[admin] ${action} failed`, {
      ...ids,
      sqlstate: error?.code ?? null,
      hint: error?.hint ?? null,
    });
  }
  return failWith(mapped);
}

export async function runAdminAction<T>(
  action: string,
  body: (context: AdminContext) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const { profile } = await requireRole("admin");
  try {
    const supabase = await createClient();
    return await body({ supabase, adminId: profile.id });
  } catch (thrown) {
    unstable_rethrow(thrown);
    console.error(`[admin] ${action} threw`, {
      name: thrown instanceof Error ? thrown.name : typeof thrown,
    });
    return failWith(mapDatabaseError({ code: "", message: thrown instanceof Error ? thrown.message : "" }));
  }
}

/** For server-only reads: checks the admin role and hands over the signed-in client. */
export async function adminReadClient(): Promise<AdminContext> {
  const { profile } = await requireRole("admin");
  return { supabase: await createClient(), adminId: profile.id };
}

/** Throws a plain error for a failed read, so the page's error boundary shows it. Logs ids only. */
export function throwReadError(query: string, error: DatabaseErrorLike): never {
  console.error(`[admin] ${query} read failed`, { sqlstate: error.code ?? null });
  throw new Error(`Couldn't load ${query}. Try again.`);
}
