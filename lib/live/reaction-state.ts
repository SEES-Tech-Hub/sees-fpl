import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { isUuid } from "./commands";
import { createPublicClient } from "./public-client";
import { emptyTotals, REACTION_KINDS, type ReactionTotals } from "./reactions";
import { liveTags } from "./tags";

// A match's reaction totals for /api/live/<id>, cached for 4 s like the
// score it travels with (lib/live/live-state.ts explains why polling and
// why 4 s). However many fans are watching, this is one small read every 4 s.
//
// Never throws: if the reactions migration isn't applied yet, or the read
// fails, it returns null and the match page simply shows no reactions. The
// score in the same response is never held up by reactions.

const LIFE = { stale: 4, revalidate: 4, expire: 60 } as const;

export type ReactionSnapshot = {
  totals: ReactionTotals;
  /**
   * When the match's latest active event was recorded: the end of the match
   * once it's at full time (see reactionsOpen in reactions.ts). Null with no
   * events (races).
   */
  lastEventAt: string | null;
};

export async function getReactionSnapshot(fixtureId: string): Promise<ReactionSnapshot | null> {
  "use cache";
  cacheLife(LIFE);
  cacheTag(liveTags.fixture(fixtureId));

  if (!isUuid(fixtureId)) return null;
  const supabase = createPublicClient();
  const [totals, last] = await Promise.all([
    supabase.rpc("match_reaction_totals", { p_fixture_id: fixtureId }),
    supabase
      .from("match_events")
      .select("recorded_at")
      .eq("fixture_id", fixtureId)
      .is("voided_at", null)
      .order("recorded_at", { ascending: false })
      .limit(1),
  ]);
  if (totals.error || last.error) {
    console.error("[live] reaction totals read failed", { sqlstate: totals.error?.code ?? last.error?.code ?? null });
    return null;
  }

  const out = emptyTotals();
  for (const row of totals.data ?? []) {
    if ((REACTION_KINDS as readonly string[]).includes(row.kind)) out[row.kind as keyof ReactionTotals] = Number(row.total) || 0;
  }
  return { totals: out, lastEventAt: last.data?.[0]?.recorded_at ?? null };
}
