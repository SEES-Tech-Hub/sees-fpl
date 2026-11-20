import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  FantasyPlayer,
  FantasyRules,
  ManagerProfile,
  MatchdayInfo,
  PickInput,
} from "./types";

type QueryResult = Promise<{ data: unknown; error: { message: string } | null }>;

type FilterChain = PromiseLike<{ data: unknown; error: { message: string } | null }> & {
  select: (columns?: string) => FilterChain;
  eq: (column: string, value: unknown) => FilterChain;
  neq: (column: string, value: unknown) => FilterChain;
  in: (column: string, values: unknown[]) => FilterChain;
  order: (column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) => FilterChain;
  limit: (count: number) => FilterChain;
  single: () => QueryResult;
  maybeSingle: () => QueryResult;
};

type UntypedReader = {
  from: (table: string) => {
    select: (columns?: string) => FilterChain;
  };
};

function reader(client: unknown): UntypedReader {
  return client as UntypedReader;
}

export async function getFantasyRulesData(): Promise<FantasyRules | null> {
  const supabase = await createClient();
  const { data } = await reader(supabase)
    .from("fantasy_rules")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  return (data as FantasyRules | null) ?? null;
}

export async function getActiveOrUpcomingMatchday(): Promise<MatchdayInfo | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("matchdays")
    .select("*")
    .neq("status", "finalised")
    .order("number", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (data) return data as MatchdayInfo;

  const { data: latest } = await supabase
    .from("matchdays")
    .select("*")
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (latest as MatchdayInfo | null) ?? null;
}

export async function getFantasyPlayerPool(): Promise<
  (FantasyPlayer & { full_name: string; shirt_number: number | null })[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("players")
    .select("id, team_id, display_name, full_name, shirt_number, position, price_tenths, status")
    .neq("status", "left")
    .order("price_tenths", { ascending: false });

  return (data ?? []) as (FantasyPlayer & {
    full_name: string;
    shirt_number: number | null;
  })[];
}

export async function getManagerWithSquadAndPicks(params: {
  userId: string;
  matchdayId?: string;
}): Promise<{
  manager: ManagerProfile | null;
  squadPlayerIds: string[];
  picks: PickInput[];
}> {
  const supabase = await createClient();
  const { data: mgr } = await reader(supabase)
    .from("managers")
    .select("*")
    .eq("user_id", params.userId)
    .maybeSingle();

  if (!mgr) {
    return { manager: null, squadPlayerIds: [], picks: [] };
  }

  const manager = mgr as ManagerProfile;

  const [{ data: squadRows }, picksRes] = await Promise.all([
    reader(supabase)
      .from("squads")
      .select("player_id")
      .eq("manager_id", manager.id),
    params.matchdayId
      ? reader(supabase)
          .from("picks")
          .select("player_id, is_starter, bench_order, is_captain, is_vice_captain")
          .eq("manager_id", manager.id)
          .eq("matchday_id", params.matchdayId)
      : Promise.resolve({ data: [] }),
  ]);

  const squadPlayerIds = ((squadRows ?? []) as { player_id: string }[]).map(
    (r) => r.player_id,
  );
  const picks = (picksRes.data ?? []) as PickInput[];

  return { manager, squadPlayerIds, picks };
}

export async function getOverallLeaderboard(limit = 50): Promise<ManagerProfile[]> {
  const supabase = await createClient();
  const { data } = await reader(supabase)
    .from("managers")
    .select("*")
    .order("total_points", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);

  return (data ?? []) as ManagerProfile[];
}

export async function getYearLeaderboard(
  yearGroup: number,
  limit = 50,
): Promise<ManagerProfile[]> {
  const supabase = await createClient();
  const { data } = await reader(supabase)
    .from("managers")
    .select("*")
    .eq("year_group", yearGroup)
    .order("total_points", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);

  return (data ?? []) as ManagerProfile[];
}

export async function getMiniLeagueStandings(leagueId: string): Promise<{
  league: { id: string; name: string; invite_code: string } | null;
  members: ManagerProfile[];
}> {
  const supabase = await createClient();
  const [{ data: league }, { data: memberLinks }] = await Promise.all([
    reader(supabase)
      .from("leagues")
      .select("id, name, invite_code")
      .eq("id", leagueId)
      .maybeSingle(),
    reader(supabase)
      .from("league_members")
      .select("manager_id")
      .eq("league_id", leagueId),
  ]);

  if (!league) {
    return { league: null, members: [] };
  }

  const managerIds = ((memberLinks ?? []) as { manager_id: string }[]).map(
    (m) => m.manager_id,
  );
  if (managerIds.length === 0) {
    return {
      league: league as { id: string; name: string; invite_code: string },
      members: [],
    };
  }

  const { data: managers } = await reader(supabase)
    .from("managers")
    .select("*")
    .in("id", managerIds)
    .order("total_points", { ascending: false });

  return {
    league: league as { id: string; name: string; invite_code: string },
    members: (managers ?? []) as ManagerProfile[],
  };
}