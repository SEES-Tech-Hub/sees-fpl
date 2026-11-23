import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { isUuid } from "./commands";
import { createPublicClient } from "./public-client";
import { liveTags } from "./tags";
import type { FixtureState } from "./live-state-types";

// Live scores for public pages, kept fresh by polling (see use-live.ts).
//
// The free Supabase plan allows 200 Realtime connections and 100 messages a
// second, far short of a final with 1,000 viewers. So public pages poll two
// small endpoints (app/api/live) instead, and those are cached twice:
//   * here, for 4 s per server instance ('use cache'), and expired at once
//     by every console write (the liveTags), and
//   * on Vercel's CDN for 4 s (the route handlers set the header).
// 1,000 viewers then cost the database about one read every 4 s.
// The officials' console still uses Realtime (realtime.ts): there are few of them.

export type { FixtureState } from "./live-state-types";

const LIFE = { stale: 4, revalidate: 4, expire: 60 } as const;

const STATE_COLUMNS =
  "id, status, kickoff_at, home_score, away_score, home_shootout, away_shootout, winner_team_id, current_period, period_started_at, current_set, home_set_points, away_set_points, updated_at" as const;

type StateRow = {
  id: string;
  status: FixtureState["status"];
  kickoff_at: string | null;
  home_score: number | null;
  away_score: number | null;
  home_shootout: number | null;
  away_shootout: number | null;
  winner_team_id: string | null;
  current_period: FixtureState["currentPeriod"];
  period_started_at: string | null;
  current_set: number | null;
  home_set_points: number | null;
  away_set_points: number | null;
  updated_at: string;
};

function toState(r: StateRow): FixtureState {
  return {
    id: r.id,
    status: r.status,
    kickoffAt: r.kickoff_at,
    homeScore: r.home_score,
    awayScore: r.away_score,
    homeShootout: r.home_shootout,
    awayShootout: r.away_shootout,
    winnerTeamId: r.winner_team_id,
    currentPeriod: r.current_period,
    periodStartedAt: r.period_started_at,
    currentSet: r.current_set,
    homeSetPoints: r.home_set_points,
    awaySetPoints: r.away_set_points,
    updatedAt: r.updated_at,
  };
}

/** Score, status and clock of every fixture: what lists and "Live now" cards need. */
export async function getFixtureStates(): Promise<FixtureState[]> {
  "use cache";
  cacheLife(LIFE);
  cacheTag(liveTags.fixtureList);

  const { data, error } = await createPublicClient().from("fixtures").select(STATE_COLUMNS).order("kickoff_at");
  if (error) throw new Error(`Couldn't load fixture states: ${error.message}`);
  return (data as StateRow[]).map(toState);
}

/**
 * One fixture's state plus a version that changes whenever anything a match
 * page shows changes: a new or voided event, a lineup, race results, or the
 * fixture itself. Pages compare versions and refresh only when it moves.
 */
export async function getFixtureVersion(fixtureId: string): Promise<{ state: FixtureState; version: string } | null> {
  "use cache";
  cacheLife(LIFE);
  cacheTag(liveTags.fixture(fixtureId));

  if (!isUuid(fixtureId)) return null;
  const supabase = createPublicClient();
  const [fixture, events, lineups, race] = await Promise.all([
    supabase.from("fixtures").select(STATE_COLUMNS).eq("id", fixtureId).maybeSingle(),
    supabase.from("match_events").select("id, voided_at").eq("fixture_id", fixtureId),
    supabase.from("lineups").select("set_at").eq("fixture_id", fixtureId),
    supabase.from("race_entries").select("updated_at").eq("fixture_id", fixtureId),
  ]);
  if (fixture.error) throw new Error(`Couldn't load the fixture: ${fixture.error.message}`);
  if (!fixture.data) return null;

  const maxOf = (values: (string | number | null)[]) =>
    values.reduce<string | number>((m, v) => (v !== null && v > m ? v : m), 0);
  const ev = events.data ?? [];
  const version = [
    fixture.data.updated_at,
    ev.length,
    maxOf(ev.map((e) => e.id)),
    ev.filter((e) => e.voided_at).length,
    (lineups.data ?? []).length,
    maxOf((lineups.data ?? []).map((l) => l.set_at)),
    maxOf((race.data ?? []).map((r) => r.updated_at)),
  ].join("|");

  return { state: toState(fixture.data as StateRow), version };
}
