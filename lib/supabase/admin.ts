import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Owner: Tayo. A client that uses SUPABASE_SECRET_KEY and therefore ignores
// row-level security. Only for system jobs that act on behalf of the app,
// not a person: points calculation, push sending, scheduled reminders.
// Never use it to load data for a page, and never import it in client code.
// The key exists only in Vercel's environment settings, so this works on
// preview and production deployments, not on a laptop.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error(
      "createAdminClient needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (server only, set in Vercel).",
    );
  }
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
