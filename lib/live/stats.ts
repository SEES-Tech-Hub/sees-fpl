import "server-only";
import { cache } from "react";
import { isUuid } from "./commands";
import { createPublicClient } from "./public-client";
import {
  compareAssisters,
  compareScorers,
  mapRows,
  toPlayerMatchStats,
  toPlayerTotalsRow,
  toStandingRow,
  toSuspensionRow,
} from "./stats-rows";
import type {
  PlayerMatchStats,
  PlayerTotalsRow,
  StandingRow,
  SuspensionRow,
  TopScorerRow,
} from "./types";

// Live scores: derived football data.
//
// Everything here is worked out in the database when it's read (views in
// 20261122113000_live_stats_standings.sql), so a goal, a void or a correction
// shows up on the next read. Like queries.ts, these are public reads and are
// not cached on the server: a page refreshed by Realtime must see the latest
// goal. React's cache() shares one result per request.
//
// Football has one event today ("Football (men)"). Functions that take an
// optional eventId use the football event when it's left out.

function queryFailed(what: string, error: { message: string }): never {
  throw new Error(`Couldn't load ${what}: ${error.message}`);
}

/** The football event used when no eventId is given (the oldest one). */
const getDefaultFootballEventId = cache(async (): Promise<string | null> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, created_at, sport:sports!events_sport_id_fkey!inner ( slug )")
    .eq("sport.slug", "football")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) queryFailed("the football event", error);
  return data?.id ?? null;
});

async function resolveEventId(eventId: string | undefined): Promise<string | null> {
  if (eventId !== undefined) return isUuid(eventId) ? eventId : null;
  return getDefaultFootballEventId();
}

/**
 * One row per player per fixture. Mary's fantasy engine reads only this.
 * Pass a fixture, or a matchday for every fixture in it.
 */
export async function getPlayerMatchStats(
  filter: { fixtureId: string } | { matchdayId: string },
): Promise<PlayerMatchStats[]> {
  const [column, id] =
    "fixtureId" in filter ? (["fixture_id", filter.fixtureId] as const) : (["matchday_id", filter.matchdayId] as const);
  if (!isUuid(id)) return [];

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("player_match_stats")
    .select("*")
    .eq(column, id)
    .order("fixture_id", { ascending: true })
    .order("player_id", { ascending: true });
  if (error) queryFailed("player match stats", error);
  return mapRows(data, toPlayerMatchStats);
}

/**
 * The football league table in rulebook order: points, goal difference,
 * goals scored, then head-to-head. Counts matches in progress (live: true).
 */
export const getFootballStandings = cache(async (eventId?: string): Promise<StandingRow[]> => {
  const id = await resolveEventId(eventId);
  if (!id) return [];

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("football_standings")
    .select("*")
    .eq("event_id", id)
    .order("position", { ascending: true })
    .order("team_year", { ascending: true });
  if (error) queryFailed("the football table", error);
  return mapRows(data, toStandingRow);
});

/** Every player's totals for a football event (one row per player who has played or been named). */
export const getPlayerTotals = cache(async (eventId?: string): Promise<PlayerTotalsRow[]> => {
  const id = await resolveEventId(eventId);
  if (!id) return [];

  const supabase = createPublicClient();
  const { data, error } = await supabase.from("football_player_totals").select("*").eq("event_id", id);
  if (error) queryFailed("player totals", error);
  return mapRows(data, toPlayerTotalsRow);
});

/** Top scorers (with assists), most goals first. Own goals don't count. */
export async function getTopScorers(limit = 10, options: { eventId?: string } = {}): Promise<TopScorerRow[]> {
  const totals = await getPlayerTotals(options.eventId);
  return totals.filter((row) => row.goals > 0).sort(compareScorers).slice(0, limit);
}

/** Top assisters (with goals), most assists first. */
export async function getTopAssisters(limit = 10, options: { eventId?: string } = {}): Promise<TopScorerRow[]> {
  const totals = await getPlayerTotals(options.eventId);
  return totals.filter((row) => row.assists > 0).sort(compareAssisters).slice(0, limit);
}

/** Red-card bans: who is banned, and for which fixture. Bans not yet served first. */
export const getSuspensions = cache(async (eventId?: string): Promise<SuspensionRow[]> => {
  const id = await resolveEventId(eventId);
  if (!id) return [];

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("football_suspensions")
    .select("*")
    .eq("event_id", id)
    .order("ban_served", { ascending: true })
    .order("banned_fixture_kickoff_at", { ascending: true, nullsFirst: false });
  if (error) queryFailed("suspensions", error);
  return mapRows(data, toSuspensionRow);
});
