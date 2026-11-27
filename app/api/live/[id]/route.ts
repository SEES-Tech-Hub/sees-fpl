import { getFixtureVersion } from "@/lib/live/live-state";
import { getReactionSnapshot } from "@/lib/live/reaction-state";
import { reactionsOpen } from "@/lib/live/reactions";
import { LIVE_CACHE_HEADERS } from "../cache-headers";

/**
 * GET /api/live/<fixture id>: one fixture's state and a version for the match
 * page, plus the match's reaction totals and whether reactions are open.
 * Reactions never change `version`, so a tap never makes the page reload.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/live/[id]">) {
  const { id } = await params;
  const [result, reactions] = await Promise.all([getFixtureVersion(id), getReactionSnapshot(id)]);
  if (!result) return Response.json({ error: "Fixture not found" }, { status: 404, headers: LIVE_CACHE_HEADERS });
  const now = Date.now();
  const open =
    reactions !== null &&
    reactionsOpen({
      status: result.state.status,
      // Races have no match events: they end when their results are published.
      endedAt: reactions.lastEventAt ?? result.state.updatedAt,
      now,
    });
  return Response.json(
    {
      ...result,
      reactions: reactions?.totals ?? null,
      reactionsOpen: open,
      at: new Date(now).toISOString(),
    },
    { headers: LIVE_CACHE_HEADERS },
  );
}
