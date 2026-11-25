import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getFixtureVersion } from "./live-state";
import { getFirstLeg, getFixtureLineups, getHeadToHeadEvents, getLiveFixture, getMatchTimeline } from "./queries";
import { getRaceResults, getSetScores } from "./results";
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
  const format = fixture.sport.resultFormat;
  const [timeline, lineups, setScores, race, live, boardEvents, firstLeg] = await Promise.all([
    getMatchTimeline(fixtureId),
    format === "timed" ? getFixtureLineups(fixtureId) : Promise.resolve([]),
    format === "sets" ? getSetScores(fixtureId) : Promise.resolve([]),
    format === "ranked" ? getRaceResults(fixtureId) : Promise.resolve([]),
    getFixtureVersion(fixtureId),
    fixture.event.boards ? getHeadToHeadEvents(fixtureId) : Promise.resolve([]),
    getFirstLeg(fixture),
  ]);
  return { fixture, timeline, lineups, setScores, race, boardEvents, firstLeg, state: live!.state, version: live!.version };
}

export type MatchPageData = NonNullable<Awaited<ReturnType<typeof getMatchPage>>>;
