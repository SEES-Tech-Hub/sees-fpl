import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "./public-client";
import { liveTags } from "./tags";
import type { FixtureCard } from "./fixture-card-types";

export type { FixtureCard } from "./fixture-card-types";

// Every fixture with its teams, sport and kickoff: the parts of a fixture
// card that rarely change. The live parts (score, status, clock) come in
// `state` here and are then kept fresh in the browser by useLiveFixtures.
// Cached briefly and expired by every console write (liveTags.fixtureList).

const COLUMNS = `
  id, stage, status, kickoff_at, venue, updated_at,
  home_score, away_score, home_shootout, away_shootout, winner_team_id, winner_side,
  home_entrant, away_entrant, tie, leg,
  current_period, period_started_at, current_set, home_set_points, away_set_points,
  matchday:matchdays!fixtures_matchday_id_fkey ( number ),
  event:events!fixtures_event_id_fkey (
    id, name, period_minutes, extra_period_minutes, boards,
    sport:sports!events_sport_id_fkey ( slug, name, result_format, sort_order )
  ),
  home:teams!fixtures_home_team_id_fkey ( id, name, short_name, year ),
  away:teams!fixtures_away_team_id_fkey ( id, name, short_name, year )
` as const;

type TeamRow = { id: string; name: string; short_name: string; year: number } | null;
const team = (t: TeamRow) => (t ? { id: t.id, name: t.name, shortName: t.short_name, year: t.year } : null);

export async function getFixtureCards(): Promise<FixtureCard[]> {
  "use cache: remote";
  cacheLife({ stale: 10, revalidate: 10, expire: 120 });
  cacheTag(liveTags.fixtureList);

  const { data, error } = await createPublicClient().from("fixtures").select(COLUMNS).order("kickoff_at");
  if (error) throw new Error(`Couldn't load fixtures: ${error.message}`);

  return data.flatMap((f) => {
    if (!f.event || !f.event.sport) return [];
    return [
      {
        id: f.id,
        stage: f.stage,
        kickoffAt: f.kickoff_at,
        venue: f.venue,
        matchdayNumber: f.matchday?.number ?? null,
        home: team(f.home),
        away: team(f.away),
        homeEntrant: f.home_entrant,
        awayEntrant: f.away_entrant,
        tie: f.tie,
        leg: f.leg,
        event: {
          id: f.event.id,
          name: f.event.name,
          periodMinutes: f.event.period_minutes,
          extraPeriodMinutes: f.event.extra_period_minutes,
          boards: f.event.boards,
        },
        sport: {
          slug: f.event.sport.slug,
          name: f.event.sport.name,
          resultFormat: f.event.sport.result_format,
          sortOrder: f.event.sport.sort_order,
        },
        state: {
          id: f.id,
          status: f.status,
          kickoffAt: f.kickoff_at,
          homeScore: f.home_score,
          awayScore: f.away_score,
          homeShootout: f.home_shootout,
          awayShootout: f.away_shootout,
          winnerTeamId: f.winner_team_id,
          winnerSide: f.winner_side === "home" || f.winner_side === "away" ? f.winner_side : null,
          currentPeriod: f.current_period,
          periodStartedAt: f.period_started_at,
          currentSet: f.current_set,
          homeSetPoints: f.home_set_points,
          awaySetPoints: f.away_set_points,
          updatedAt: f.updated_at,
        },
      },
    ];
  });
}
