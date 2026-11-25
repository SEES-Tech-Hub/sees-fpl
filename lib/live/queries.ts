import "server-only";
import { cache } from "react";
import { isUuid } from "./commands";
import { createPublicClient } from "./public-client";
import type { LineupPlayer, LiveFixture, TeamSummary, TimelineEntry } from "./types";

// Live scores: reads for the match page and the console.
//
// Public data, read as an anonymous visitor. These are deliberately NOT
// cached on the server: a page that refreshes because Realtime reported a
// goal must get the goal, and a server cache (one per Vercel instance) can't
// promise that. React's cache() still shares one result per request, so
// calling a function from both generateMetadata and the page costs one query.
// Call them inside <Suspense>.
//
// Lists that can be a few seconds stale (sport pages, fixtures by date) can
// be cached with 'use cache' and tagged with liveTags.fixtureList, which the
// console actions expire on every write.

type TeamRow = { id: string; name: string; short_name: string; year: number } | null;

function toTeam(row: TeamRow): TeamSummary | null {
  return row ? { id: row.id, name: row.name, shortName: row.short_name, year: row.year } : null;
}

function queryFailed(what: string, error: { message: string }): never {
  throw new Error(`Couldn't load ${what}: ${error.message}`);
}

const FIXTURE_COLUMNS = `
  id, stage, status, kickoff_at, venue, matchday_id, console_holder,
  home_score, away_score, home_shootout, away_shootout, winner_team_id,
  current_period, period_started_at, current_set, home_set_points, away_set_points,
  home_entrant, away_entrant, tie, leg, winner_side,
  event:events!fixtures_event_id_fkey (
    id, name, period_minutes, extra_period_minutes, period_count, boards,
    sets_to_win, set_points, final_set_points,
    sport:sports!events_sport_id_fkey ( slug, name, result_format )
  ),
  home:teams!fixtures_home_team_id_fkey ( id, name, short_name, year ),
  away:teams!fixtures_away_team_id_fkey ( id, name, short_name, year )
` as const;

/** A fixture with its teams, score and clock. Null when it doesn't exist. */
const toSide = (v: string | null): "home" | "away" | null => (v === "home" || v === "away" ? v : null);

export const getLiveFixture = cache(async (fixtureId: string): Promise<LiveFixture | null> => {
  if (!isUuid(fixtureId)) return null;

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("fixtures")
    .select(FIXTURE_COLUMNS)
    .eq("id", fixtureId)
    .maybeSingle();
  if (error) queryFailed("the fixture", error);
  if (!data || !data.event || !data.event.sport) return null;

  return {
    id: data.id,
    stage: data.stage,
    status: data.status,
    kickoffAt: data.kickoff_at,
    venue: data.venue,
    matchdayId: data.matchday_id,
    consoleHolderId: data.console_holder,
    home: toTeam(data.home),
    away: toTeam(data.away),
    homeScore: data.home_score,
    awayScore: data.away_score,
    homeShootout: data.home_shootout,
    awayShootout: data.away_shootout,
    winnerTeamId: data.winner_team_id,
    currentPeriod: data.current_period,
    periodStartedAt: data.period_started_at,
    currentSet: data.current_set,
    homeSetPoints: data.home_set_points,
    awaySetPoints: data.away_set_points,
    homeEntrant: data.home_entrant,
    awayEntrant: data.away_entrant,
    tie: data.tie,
    leg: data.leg,
    winnerSide: toSide(data.winner_side),
    event: {
      id: data.event.id,
      name: data.event.name,
      periodMinutes: data.event.period_minutes,
      extraPeriodMinutes: data.event.extra_period_minutes,
      periodCount: data.event.period_count,
      boards: data.event.boards,
      setsToWin: data.event.sets_to_win,
      setPoints: data.event.set_points,
      finalSetPoints: data.event.final_set_points,
    },
    sport: {
      slug: data.event.sport.slug,
      name: data.event.sport.name,
      resultFormat: data.event.sport.result_format,
    },
  };
});

/** A head-to-head event as the console needs it: who (side), which board, how many points. */
export type HeadToHeadEvent = {
  clientEventId: string;
  type: TimelineEntry["type"];
  teamId: string | null;
  side: "home" | "away" | null;
  board: number | null;
  points: number | null;
  occurredAt: string;
};

/** Active events of a head-to-head fixture, oldest first (match_timeline has no side or board). */
export const getHeadToHeadEvents = cache(async (fixtureId: string): Promise<HeadToHeadEvent[]> => {
  if (!isUuid(fixtureId)) return [];
  const { data, error } = await createPublicClient()
    .from("match_events")
    .select("client_event_id, type, team_id, side, board, points, occurred_at")
    .eq("fixture_id", fixtureId)
    .is("voided_at", null)
    .order("occurred_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) queryFailed("the match events", error);
  return (data ?? []).map((e) => ({
    clientEventId: e.client_event_id,
    type: e.type,
    teamId: e.team_id,
    side: toSide(e.side),
    board: e.board,
    points: e.points,
    occurredAt: e.occurred_at,
  }));
});

/** The first leg of a two-leg tie, for the aggregate score on the second leg. */
export const getFirstLeg = cache(async (fixture: Pick<LiveFixture, "id" | "tie" | "leg" | "event">) => {
  if (fixture.leg !== 2 || !fixture.tie) return null;
  const { data, error } = await createPublicClient()
    .from("fixtures")
    .select("id, status, home_score, away_score, home_team_id, home_entrant")
    .eq("event_id", fixture.event.id)
    .eq("tie", fixture.tie)
    .eq("leg", 1)
    .neq("id", fixture.id)
    .limit(1)
    .maybeSingle();
  if (error) queryFailed("the first leg", error);
  if (!data) return null;
  return {
    id: data.id,
    status: data.status,
    homeScore: data.home_score,
    awayScore: data.away_score,
    homeTeamId: data.home_team_id,
    homeEntrant: data.home_entrant,
  };
});

/** The fixture's events in order, with match minutes and names. */
export const getMatchTimeline = cache(async (fixtureId: string): Promise<TimelineEntry[]> => {
  if (!isUuid(fixtureId)) return [];

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("match_timeline")
    .select("*")
    .eq("fixture_id", fixtureId)
    .order("occurred_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) queryFailed("the match timeline", error);

  const entries: TimelineEntry[] = [];
  for (const row of data ?? []) {
    // The view only returns active events, so these are always set.
    if (row.id === null || row.client_event_id === null || row.type === null || row.occurred_at === null) continue;
    entries.push({
      id: row.id,
      clientEventId: row.client_event_id,
      type: row.type,
      period: row.period,
      teamId: row.team_id,
      teamShortName: row.team_short_name,
      playerId: row.player_id,
      playerName: row.player_name,
      otherPlayerId: row.other_player_id,
      otherPlayerName: row.other_player_name,
      card: row.card,
      isPenalty: row.is_penalty ?? false,
      isOwnGoal: row.is_own_goal ?? false,
      scored: row.scored,
      points: row.points,
      occurredAt: row.occurred_at,
      minute: row.minute,
      addedMinutes: row.added_minutes,
    });
  }
  return entries;
});

/**
 * Both lineups with each player's state in the match: on the pitch, subbed
 * off, sent off, yellow cards. Empty when no lineup has been set.
 */
export const getFixtureLineups = cache(async (fixtureId: string): Promise<LineupPlayer[]> => {
  if (!isUuid(fixtureId)) return [];

  const supabase = createPublicClient();
  const [lineups, state] = await Promise.all([
    supabase
      .from("lineups")
      .select("player_id, team_id, role, player:players!lineups_player_id_fkey ( display_name, position, shirt_number )")
      .eq("fixture_id", fixtureId),
    supabase.rpc("fixture_player_state", { p_fixture_id: fixtureId }),
  ]);
  if (lineups.error) queryFailed("the lineups", lineups.error);
  if (state.error) queryFailed("the player states", state.error);

  const stateByPlayer = new Map((state.data ?? []).map((s) => [s.player_id, s]));
  const players: LineupPlayer[] = [];
  for (const row of lineups.data ?? []) {
    if (!row.player) continue;
    const s = stateByPlayer.get(row.player_id);
    players.push({
      playerId: row.player_id,
      teamId: row.team_id,
      name: row.player.display_name,
      position: row.player.position,
      shirtNumber: row.player.shirt_number,
      role: row.role,
      appeared: s?.appeared ?? row.role === "starter",
      onPitch: s?.on_pitch ?? row.role === "starter",
      sentOff: s?.sent_off ?? false,
      yellowCards: s?.yellow_cards ?? 0,
    });
  }
  // Starters first, then by shirt number, then by name.
  return players.sort(
    (a, b) =>
      Number(a.role === "bench") - Number(b.role === "bench") ||
      (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999) ||
      a.name.localeCompare(b.name),
  );
});
