import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { fixtureLabel } from "../domain/fixtures";
import { watDayBounds } from "../domain/wat";
import { adminReadClient, throwReadError } from "../server";

// Owner: admin backend. getDashboard() (task A3) for the admin home page.
// Same DashboardData shape as Tayo's temporary app/admin/dashboard-data.ts,
// so swapping it in is an import change:
//   import { getDashboard, type DashboardFixture } from "@/lib/admin/queries/dashboard";
// and app/admin/dashboard-data.ts can be deleted.

const FIXTURE_FIELDS = `
  id, kickoff_at, status, stage, venue, home_score, away_score, console_holder,
  event:events ( name, sport:sports ( name, slug ) ),
  home:teams!fixtures_home_team_id_fkey ( short_name ),
  away:teams!fixtures_away_team_id_fkey ( short_name ),
  holder:profiles!fixtures_console_holder_fkey ( display_name, email )
` as const;

export type DashboardFixture = {
  id: string;
  kickoff_at: string | null;
  status: string;
  stage: string;
  venue: string | null;
  home_score: number | null;
  away_score: number | null;
  sportName: string;
  eventName: string;
  label: string;
  holderName: string | null;
};

export type DashboardData = {
  now: string;
  today: DashboardFixture[];
  upcoming: DashboardFixture[];
  needsHolder: DashboardFixture[];
  counts: { players: number; teams: number; fixtures: number; officials: number };
};

type FixtureRow = {
  id: string;
  kickoff_at: string | null;
  status: string;
  stage: string;
  venue: string | null;
  home_score: number | null;
  away_score: number | null;
  console_holder: string | null;
  event: { name: string; sport: { name: string; slug: string } | null } | null;
  home: { short_name: string } | null;
  away: { short_name: string } | null;
  holder: { display_name: string | null; email: string | null } | null;
};

/** How far ahead the "no console holder" warning looks (the rule Tayo's page shows). */
const HOLDER_WARNING_MS = 2 * 60 * 60 * 1000;

function toFixture(row: FixtureRow): DashboardFixture {
  return {
    id: row.id,
    kickoff_at: row.kickoff_at,
    status: row.status,
    stage: row.stage,
    venue: row.venue,
    home_score: row.home_score,
    away_score: row.away_score,
    sportName: row.event?.sport?.name ?? "Unknown sport",
    eventName: row.event?.name ?? "",
    label: fixtureLabel(row.stage, row.home?.short_name ?? null, row.away?.short_name ?? null),
    holderName: row.holder ? (row.holder.display_name ?? row.holder.email) : null,
  };
}

/**
 * Today's fixtures (WAT day), the next 5 scheduled, scheduled fixtures
 * kicking off within 2 hours with no console holder, and counts.
 */
export const getDashboard = cache(async (): Promise<DashboardData> => {
  await connection(); // "now" is the request time, not build time
  const { supabase } = await adminReadClient();
  const now = new Date();
  const { start, end } = watDayBounds(now);
  const soon = new Date(now.getTime() + HOLDER_WARNING_MS);

  const count = (table: "players" | "teams" | "fixtures") =>
    supabase.from(table).select("id", { count: "exact", head: true });

  const [today, upcoming, needsHolder, players, teams, fixtures, officials] = await Promise.all([
    supabase
      .from("fixtures")
      .select(FIXTURE_FIELDS)
      .gte("kickoff_at", start.toISOString())
      .lt("kickoff_at", end.toISOString())
      .order("kickoff_at"),
    supabase
      .from("fixtures")
      .select(FIXTURE_FIELDS)
      .gte("kickoff_at", now.toISOString())
      .eq("status", "scheduled")
      .order("kickoff_at")
      .limit(5),
    supabase
      .from("fixtures")
      .select(FIXTURE_FIELDS)
      .is("console_holder", null)
      .eq("status", "scheduled")
      .gte("kickoff_at", now.toISOString())
      .lte("kickoff_at", soon.toISOString())
      .order("kickoff_at"),
    count("players"),
    count("teams"),
    count("fixtures"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "official"),
  ]);

  const firstError = [today, upcoming, needsHolder, players, teams, fixtures, officials].find((r) => r.error)?.error;
  if (firstError) throwReadError("the dashboard", firstError);

  const rows = (r: { data: unknown }) => ((r.data ?? []) as FixtureRow[]).map(toFixture);
  return {
    now: now.toISOString(),
    today: rows(today),
    upcoming: rows(upcoming),
    needsHolder: rows(needsHolder),
    counts: {
      players: players.count ?? 0,
      teams: teams.count ?? 0,
      fixtures: fixtures.count ?? 0,
      officials: officials.count ?? 0,
    },
  };
});
