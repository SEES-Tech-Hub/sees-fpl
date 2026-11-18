import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

// Browser client. Use only in Client Components, for Realtime subscriptions
// and user interactions. Page data loads on the server (see server.ts).
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
