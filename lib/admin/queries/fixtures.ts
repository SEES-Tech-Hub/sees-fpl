import "server-only";
import { cache } from "react";
import { z } from "zod";
import { Constants } from "@/lib/supabase/types";
import { fixtureLabel } from "../domain/fixtures";
import { parseInput } from "../schemas";
import { adminReadClient, throwReadError } from "../server";
import type { FixtureStatus, MatchdayStatus } from "../types";

// Owner: admin backend. Fixture and matchday reads for the admin portal.
// Server-only; call from Server Components inside <Suspense>.

export const FIXTURE_FIELDS = `
  id, event_id, stage, home_team_id, away_team_id, kickoff_at, venue, status, matchday_id,
  console_holder, home_score, away_score, updated_at,
  event:events ( name, sport:sports ( id, name, slug ) ),
  home:teams!fixtures_home_team_id_fkey ( short_name ),
  away:teams!fixtures_away_team_id_fkey ( short_name ),
  matchday:matchdays ( number ),
  holder:profiles!fixtures_console_holder_fkey ( display_name, email )
` as const;

export type AdminFixture = {
  id: string;
  eventId: string;
  eventName: string;
  sportId: string | null;
  sportName: string;
  sportSlug: string | null;
  stage: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  home: string | null;
  away: string | null;
  /** "Y1 v Y4", "Final: Y5 v Y3", "Final (teams to be confirmed)". */
  label: string;
  kickoffAt: string | null;
  venue: string | null;
  status: FixtureStatus;
  matchdayId: string | null;
  matchdayNumber: number | null;
  consoleHolderId: string | null;
  holderName: string | null;
  homeScore: number | null;
  awayScore: number | null;
  updatedAt: string;
};

export type FixtureRow = {
  id: string;
  event_id: string;
  stage: string;
  home_team_id: string | null;
  away_team_id: string | null;
  kickoff_at: string | null;
  venue: string | null;
  status: FixtureStatus;
  matchday_id: string | null;
  console_holder: string | null;
  home_score: number | null;
  away_score: number | null;
  updated_at: string;
  event: { name: string; sport: { id: string; name: string; slug: string } | null } | null;
  home: { short_name: string } | null;
  away: { short_name: string } | null;
  matchday: { number: number } | null;
  holder: { display_name: string | null; email: string | null } | null;
};

export function toAdminFixture(row: FixtureRow): AdminFixture {
  const home = row.home?.short_name ?? null;
  const away = row.away?.short_name ?? null;
  return {
    id: row.id,
    eventId: row.event_id,
    eventName: row.event?.name ?? "",
    sportId: row.event?.sport?.id ?? null,
    sportName: row.event?.sport?.name ?? "Unknown sport",
    sportSlug: row.event?.sport?.slug ?? null,
    stage: row.stage,
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id,
    home,
    away,
    label: fixtureLabel(row.stage, home, away),
    kickoffAt: row.kickoff_at,
    venue: row.venue,
    status: row.status,
    matchdayId: row.matchday_id,
    matchdayNumber: row.matchday?.number ?? null,
    consoleHolderId: row.console_holder,
    holderName: row.holder ? (row.holder.display_name ?? row.holder.email) : null,
    homeScore: row.home_score,
    awayScore: row.away_score,
    updatedAt: row.updated_at,
  };
}

export const listFixturesFilter = z
  .object({
    eventId: z.uuid().optional(),
    matchdayId: z.uuid().optional(),
    status: z.enum(Constants.public.Enums.fixture_status).optional(),
    /** Kickoff on or after (ISO). */
    from: z.iso.datetime({ offset: true }).optional(),
    /** Kickoff before (ISO). */
    to: z.iso.datetime({ offset: true }).optional(),
  })
  .default({});

/**
 * Fixtures by kickoff (fixtures with no time yet last). About 100 in the whole
 * Games, so no paging; filter by event, matchday, status or date range.
 */
export const listFixtures = cache(async (filter?: z.input<typeof listFixturesFilter>): Promise<AdminFixture[]> => {
  const parsed = parseInput(listFixturesFilter, filter ?? {});
  const f = parsed.ok ? parsed.data : {};
  const { supabase } = await adminReadClient();

  let query = supabase.from("fixtures").select(FIXTURE_FIELDS);
  if (f.eventId) query = query.eq("event_id", f.eventId);
  if (f.matchdayId) query = query.eq("matchday_id", f.matchdayId);
  if (f.status) query = query.eq("status", f.status);
  if (f.from) query = query.gte("kickoff_at", f.from);
  if (f.to) query = query.lt("kickoff_at", f.to);
  const { data, error } = await query.order("kickoff_at", { ascending: true, nullsFirst: false });
  if (error) throwReadError("fixtures", error);
  return ((data ?? []) as FixtureRow[]).map(toAdminFixture);
});

export const getFixture = cache(async (fixtureId: string): Promise<AdminFixture | null> => {
  const { supabase } = await adminReadClient();
  const { data, error } = await supabase.from("fixtures").select(FIXTURE_FIELDS).eq("id", fixtureId).maybeSingle();
  if (error) throwReadError("fixture", error);
  return data ? toAdminFixture(data as FixtureRow) : null;
});

export type AdminMatchday = {
  id: string;
  number: number;
  name: string;
  deadlineAt: string | null;
  status: MatchdayStatus;
  /** Earliest kickoff among its fixtures, to show next to the deadline. */
  firstKickoffAt: string | null;
  fixtureCount: number;
};

/** The football matchdays, with each one's first kickoff. Prices lock at matchday 1's deadline. */
export const listMatchdays = cache(async (): Promise<AdminMatchday[]> => {
  const { supabase } = await adminReadClient();
  const { data, error } = await supabase
    .from("matchdays")
    .select("id, number, name, deadline_at, status, fixtures ( kickoff_at )")
    .order("number");
  if (error) throwReadError("matchdays", error);
  return (data ?? []).map((m) => {
    const kickoffs = (m.fixtures ?? [])
      .map((f) => f.kickoff_at)
      .filter((k): k is string => Boolean(k))
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    return {
      id: m.id,
      number: m.number,
      name: m.name,
      deadlineAt: m.deadline_at,
      status: m.status,
      firstKickoffAt: kickoffs[0] ?? null,
      fixtureCount: (m.fixtures ?? []).length,
    };
  });
});
