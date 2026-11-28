import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/live/public-client";
import { getPlayerMatchStats } from "@/lib/live/stats";
import { liveTags } from "@/lib/live/tags";
import type { PlayerMatchStats } from "@/lib/live/types";

// The fantasy reads that are the same for everyone (rules, players and who
// picked them, matchdays and fixtures, players' match stats), read once and
// shared by every manager for a short while, instead of once per page view.
// They read as the public (no cookies), which row-level security allows.
//
// Fixtures carry liveTags.fixtureList, which every console write expires,
// so a kick-off or a result shows at once. Players' match stats (the heavy
// read behind live fantasy points) refresh once a minute and on a goal or a
// result (liveTags.standings), not on every card or sub. The rest refresh on
// their own every 30–60 s (rules and prices barely change during a matchday,
// and the "picked by" percentages can lag a little).

export const fantasyTags = { shared: "fantasy:shared" } as const;

function fail(what: string, message: string): never {
  throw new Error(`Couldn't load ${what}: ${message}`);
}

export async function sharedRulesRow() {
  "use cache";
  cacheLife({ stale: 60, revalidate: 60, expire: 600 });
  cacheTag(fantasyTags.shared);
  const { data, error } = await createPublicClient().from("fantasy_rules").select("*").eq("id", 1).single();
  if (error) fail("the fantasy rules", error.message);
  return data;
}

export async function sharedDeadlineMinutes() {
  "use cache";
  cacheLife({ stale: 60, revalidate: 60, expire: 600 });
  cacheTag(fantasyTags.shared);
  const { data } = await createPublicClient().rpc("admin_deadline_rules");
  return data?.[0]?.minutes_before_kickoff ?? 30;
}

/** Matchdays and their fixtures, as stored (the caller works out what's next). */
export async function sharedMatchdayRows() {
  "use cache";
  cacheLife({ stale: 15, revalidate: 15, expire: 300 });
  cacheTag(fantasyTags.shared, liveTags.fixtureList);
  const supabase = createPublicClient();
  const [mds, fx] = await Promise.all([
    supabase.from("matchdays").select("id, number, name, deadline_at, status").order("number"),
    supabase
      .from("fixtures")
      .select(
        "id, matchday_id, stage, kickoff_at, status, venue, home_team_id, away_team_id, home_score, away_score, home:teams!fixtures_home_team_id_fkey(short_name), away:teams!fixtures_away_team_id_fkey(short_name)",
      )
      .not("matchday_id", "is", null)
      .order("kickoff_at"),
  ]);
  if (mds.error) fail("matchdays", mds.error.message);
  if (fx.error) fail("fixtures", fx.error.message);
  return { matchdays: mds.data, fixtures: fx.data };
}

/** Every player, and the share of managers who picked each. */
export async function sharedPlayerRows() {
  "use cache";
  cacheLife({ stale: 30, revalidate: 30, expire: 300 });
  cacheTag(fantasyTags.shared);
  const supabase = createPublicClient();
  const [players, selection] = await Promise.all([
    supabase
      .from("players")
      .select("id, team_id, full_name, display_name, position, price_tenths, status, shirt_number, teams(year, short_name)")
      .order("display_name"),
    supabase.rpc("fantasy_player_selection"),
  ]);
  if (players.error) fail("players", players.error.message);
  return { players: players.data, selection: selection.data ?? [] };
}

/** Players' match stats for each of these matchdays, as [matchday id, rows] pairs. */
export async function sharedMatchdayStats(matchdayIds: string[]): Promise<[string, PlayerMatchStats[]][]> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 60, expire: 600 });
  cacheTag(fantasyTags.shared, liveTags.standings);
  return Promise.all(matchdayIds.map(async (id) => [id, await getPlayerMatchStats({ matchdayId: id })] as [string, PlayerMatchStats[]]));
}
