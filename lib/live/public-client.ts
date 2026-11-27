import "server-only";
import { createClient } from "@supabase/supabase-js";
import { timeoutFetch } from "@/lib/supabase/timeout-fetch";
import type { Database } from "@/lib/supabase/types";

// A Supabase client with no session: it reads as an anonymous visitor, so
// row-level security shows it exactly what the public can see.
//
// For reads of public data that don't depend on who is looking, including
// inside 'use cache' functions, which can't read cookies (so
// lib/supabase/server.ts can't be used there). Never use it for writes or for
// anything only signed-in users may see.
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("createPublicClient needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: timeoutFetch },
  });
}
