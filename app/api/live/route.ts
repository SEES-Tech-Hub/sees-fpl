import { getFixtureStates } from "@/lib/live/live-state";
import { LIVE_CACHE_HEADERS } from "./cache-headers";

/** GET /api/live: score, status and clock of every fixture, for lists and "Live now". */
export async function GET() {
  const fixtures = await getFixtureStates();
  return Response.json({ fixtures, at: new Date().toISOString() }, { headers: LIVE_CACHE_HEADERS });
}
