import "server-only";
import { cache } from "react";
import { isUuid } from "./commands";
import { createPublicClient } from "./public-client";
import { mapRows } from "./stats-rows";
import {
  compareRaceResults,
  toEventStandingRow,
  toMedalRow,
  toMedalTableRow,
  toRaceResultRow,
  toSetScore,
} from "./results-rows";
import type { EventStandingRow, MedalRow, MedalTableRow, RaceResultRow, SetScore } from "./types";

// Live scores: results for every format except football's own table, and the
// overall championship. Worked out in the database when read (views in
// 20261123065000_live_phase3_formats.sql), so a point, a void or a published
// race shows on the next read. Not cached on the server, like queries.ts;
// React's cache() shares one result per request.
//
// Keeping pages live: points and sets update fixtures (subscribeToFixture),
// and race results update race_entries (subscribeToRace in realtime.ts).

function queryFailed(what: string, error: { message: string }): never {
  throw new Error(`Couldn't load ${what}: ${error.message}`);
}

/** The score of every set in a sets match (volleyball, badminton, ...), set 1 first. */
export const getSetScores = cache(async (fixtureId: string): Promise<SetScore[]> => {
  if (!isUuid(fixtureId)) return [];
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("fixture_set_scores")
    .select("*")
    .eq("fixture_id", fixtureId)
    .order("set_number", { ascending: true });
  if (error) queryFailed("set scores", error);
  return mapRows(data, toSetScore);
});

/**
 * A group table for any sport except football (use getFootballStandings for
 * football). Points, then head-to-head, then score difference, then score for.
 */
export const getEventStandings = cache(async (eventId: string): Promise<EventStandingRow[]> => {
  if (!isUuid(eventId)) return [];
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("event_standings")
    .select("*")
    .eq("event_id", eventId)
    .order("position", { ascending: true })
    .order("team_year", { ascending: true });
  if (error) queryFailed("the group table", error);
  return mapRows(data, toEventStandingRow);
});

/** A race's entrants in finishing order. The public sees results once the race is published. */
export const getRaceResults = cache(async (fixtureId: string): Promise<RaceResultRow[]> => {
  if (!isUuid(fixtureId)) return [];
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("race_results").select("*").eq("fixture_id", fixtureId);
  if (error) queryFailed("race results", error);
  return mapRows(data, toRaceResultRow).sort(compareRaceResults);
});

/** Gold, silver and bronze for one event (empty until its final is decided). */
export const getEventMedals = cache(async (eventId: string): Promise<MedalRow[]> => {
  if (!isUuid(eventId)) return [];
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("event_medals")
    .select("*")
    .eq("event_id", eventId)
    .order("place", { ascending: true });
  if (error) queryFailed("medals", error);
  return mapRows(data, toMedalRow);
});

/** The overall championship: every year, ranked by the admin's setting (medals or points). */
export const getMedalTable = cache(async (): Promise<MedalTableRow[]> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("medal_table")
    .select("*")
    .order("position", { ascending: true })
    .order("team_year", { ascending: true });
  if (error) queryFailed("the medal table", error);
  return mapRows(data, toMedalTableRow);
});
