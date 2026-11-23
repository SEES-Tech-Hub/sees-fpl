import { getFixtureVersion } from "@/lib/live/live-state";
import { LIVE_CACHE_HEADERS } from "../cache-headers";

/** GET /api/live/<fixture id>: one fixture's state and a version for the match page. */
export async function GET(_request: Request, { params }: RouteContext<"/api/live/[id]">) {
  const { id } = await params;
  const result = await getFixtureVersion(id);
  if (!result) return Response.json({ error: "Fixture not found" }, { status: 404, headers: LIVE_CACHE_HEADERS });
  return Response.json({ ...result, at: new Date().toISOString() }, { headers: LIVE_CACHE_HEADERS });
}
