import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getFixtureVersion } from "./live-state";
import { getFixtureLineups, getLiveFixture, getMatchTimeline } from "./queries";
import { getSetScores } from "./results";
import { liveTags } from "./tags";

// Everything the match page shows, in one cached read: 4 s per server
// instance, expired at once by any console write to this fixture. Viewers'
// pages refresh when /api/live/<id> reports a new version (use-live.ts), so
// a goal with 1,000 viewers costs a handful of database reads, not 1,000.

export async function getMatchPage(fixtureId: string) {
  "use cache";
  cacheLife({ stale: 4, revalidate: 4, expire: 60 });
  cacheTag(liveTags.fixture(fixtureId));

  const fixture = await getLiveFixture(fixtureId);
  if (!fixture) return null;
  const sets = fixture.sport.resultFormat === "sets";
  const [timeline, lineups, setScores, live] = await Promise.all([
    getMatchTimeline(fixtureId),
    getFixtureLineups(fixtureId),
    sets ? getSetScores(fixtureId) : Promise.resolve([]),
    getFixtureVersion(fixtureId),
  ]);
  return { fixture, timeline, lineups, setScores, state: live!.state, version: live!.version };
}

export type MatchPageData = NonNullable<Awaited<ReturnType<typeof getMatchPage>>>;
