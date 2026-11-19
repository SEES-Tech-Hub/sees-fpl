import "server-only";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { watDayBounds } from "./wat";

// TEMPORARY: reads tables directly so the dashboard works today.
// Switch to Henry's getDashboard() in lib/admin/dashboard.ts (A3) once it
// lands, and delete this file. It runs as the signed-in admin, so RLS applies.

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

const STAGE_LABELS: Record<string, string> = {
  final: "Final",
  third_place: "Third place",
  semi_final: "Semi-final",
};

function toFixture(row: FixtureRow): DashboardFixture {
  const stageLabel = STAGE_LABELS[row.stage];
  const teams =
    row.home && row.away
      ? `${row.home.short_name} v ${row.away.short_name}`
      : stageLabel
        ? `${stageLabel} (teams to be confirmed)`
        : row.home?.short_name ?? "Entrants to be confirmed";
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
    label: stageLabel && row.home && row.away ? `${stageLabel}: ${teams}` : teams,
    holderName: row.holder ? (row.holder.display_name ?? row.holder.email) : null,
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  await connection(); // "now" must be the request time, not build time
  const now = new Date();
  const { start, end } = watDayBounds(now);
  const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const supabase = await createClient();
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
      .lte("kickoff_at", inTwoHours.toISOString())
      .order("kickoff_at"),
    count("players"),
    count("teams"),
    count("fixtures"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "official"),
  ]);

  const firstError = [today, upcoming, needsHolder, players, teams, fixtures, officials].find((r) => r.error)?.error;
  if (firstError) throw new Error(`Dashboard query failed: ${firstError.message}`);

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
}
