"use server";

import { getCurrentUser, requireRole } from "@/lib/auth";
import { getPlayerMatchStats } from "@/lib/live/stats";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  FantasyActionResult,
  FantasyError,
  FantasyPlayer,
  FantasyRules,
  ManagerMatchdayScoreResult,
  ManagerProfile,
  MatchdayInfo,
  PickInput,
} from "./engine-types";
import { normalizeInviteCode } from "./leagues";
import { calculateManagerMatchdayScore } from "./scoring";

type RpcResult = Promise<{
  data: unknown;
  error: { message: string } | null;
}>;

type UntypedClient = {
  from: (table: string) => {
    select: (columns?: string) => UntypedFilter;
    update: (values: unknown) => UntypedFilter;
    upsert: (values: unknown, options?: { onConflict?: string }) => UntypedFilter;
  };
  rpc: (fn: string, params?: Record<string, unknown>) => RpcResult;
};

type UntypedFilter = PromiseLike<{
  data: unknown;
  error: { message: string } | null;
}> & {
  select: (columns?: string) => UntypedFilter;
  eq: (column: string, value: unknown) => UntypedFilter;
  in: (column: string, values: unknown[]) => UntypedFilter;
  is: (column: string, value: null) => UntypedFilter;
  single: () => RpcResult;
  maybeSingle: () => RpcResult;
};

function db(client: unknown): UntypedClient {
  return client as UntypedClient;
}

function fail(
  code: string,
  message: string,
  playerIds?: string[],
): { ok: false; error: FantasyError } {
  return playerIds
    ? { ok: false, error: { code, message, playerIds } }
    : { ok: false, error: { code, message } };
}

function parseRpcError(rawMessage: string): { ok: false; error: FantasyError } {
  const colonIdx = rawMessage.indexOf(":");
  if (colonIdx > 0) {
    const code = rawMessage.slice(0, colonIdx).trim();
    const message = rawMessage.slice(colonIdx + 1).trim();
    if (/^[A-Z0-9_]+$/.test(code) && message.length > 0) {
      return fail(code, message);
    }
  }
  console.error("[fantasy] unexpected RPC error:", rawMessage);
  return fail("UNKNOWN", "Something went wrong. Please try again.");
}

export async function getFantasyRules(): Promise<
  FantasyActionResult<FantasyRules>
> {
  const supabase = await createClient();
  const { data, error } = await db(supabase)
    .from("fantasy_rules")
    .select("*")
    .eq("id", 1)
    .single();

  if (error || !data) {
    return fail("RULES_NOT_FOUND", "Fantasy rules configuration not found.");
  }
  return { ok: true, data: data as FantasyRules };
}

export async function createOrGetManager(input: {
  teamName: string;
  yearGroup?: number | null;
}): Promise<FantasyActionResult<ManagerProfile>> {
  const current = await getCurrentUser();
  if (!current) {
    return fail("NOT_SIGNED_IN", "Sign in to create a fantasy team.");
  }

  const supabase = await createClient();
  const { data: existing } = await db(supabase)
    .from("managers")
    .select("*")
    .eq("user_id", current.user.id)
    .maybeSingle();

  if (existing) {
    return { ok: true, data: existing as ManagerProfile };
  }

  const { data, error } = await db(supabase).rpc("create_manager", {
    p_team_name: input.teamName,
    p_year_group: input.yearGroup ?? null,
  });

  if (error || !data) {
    return parseRpcError(error?.message ?? "Could not create manager profile.");
  }

  return { ok: true, data: data as ManagerProfile };
}

export async function saveInitialSquadAndPicks(input: {
  playerIds: string[];
  picks?: PickInput[];
}): Promise<FantasyActionResult<{ saved: true; matchdayId: string }>> {
  const current = await getCurrentUser();
  if (!current) {
    return fail("NOT_SIGNED_IN", "Sign in to save your squad.");
  }

  const supabase = await createClient();
  const { data, error } = await db(supabase).rpc("save_squad", {
    p_player_ids: input.playerIds,
    p_picks: input.picks ?? null,
  });

  if (error || !data) {
    return parseRpcError(error?.message ?? "Could not save squad.");
  }

  return { ok: true, data: data as { saved: true; matchdayId: string } };
}

export async function saveMatchdayLineup(input: {
  picks: PickInput[];
}): Promise<FantasyActionResult<{ saved: true; matchdayId: string }>> {
  const current = await getCurrentUser();
  if (!current) {
    return fail("NOT_SIGNED_IN", "Sign in to update your lineup.");
  }

  const supabase = await createClient();
  const { data, error } = await db(supabase).rpc("save_lineup", {
    p_picks: input.picks,
  });

  if (error || !data) {
    return parseRpcError(error?.message ?? "Could not save lineup.");
  }

  return { ok: true, data: data as { saved: true; matchdayId: string } };
}

export async function activateWildcard(): Promise<
  FantasyActionResult<{ activated: true; matchdayId: string }>
> {
  const current = await getCurrentUser();
  if (!current) {
    return fail("NOT_SIGNED_IN", "Sign in to activate your Wildcard.");
  }

  const supabase = await createClient();
  const { data, error } = await db(supabase).rpc("activate_wildcard");

  if (error || !data) {
    return parseRpcError(error?.message ?? "Could not activate Wildcard.");
  }

  return { ok: true, data: data as { activated: true; matchdayId: string } };
}

export async function submitTransfers(input: {
  swaps: { playerOutId: string; playerInId: string }[];
  useWildcard?: boolean;
}): Promise<
  FantasyActionResult<{
    pointsCost: number;
    freeTransfersRemaining: number;
    matchdayId: string;
  }>
> {
  const current = await getCurrentUser();
  if (!current) {
    return fail("NOT_SIGNED_IN", "Sign in to make transfers.");
  }

  const supabase = await createClient();
  const { data, error } = await db(supabase).rpc("make_transfers", {
    p_out_ids: input.swaps.map((s) => s.playerOutId),
    p_in_ids: input.swaps.map((s) => s.playerInId),
    p_use_wildcard: Boolean(input.useWildcard),
  });

  if (error || !data) {
    return parseRpcError(error?.message ?? "Could not complete transfers.");
  }

  return {
    ok: true,
    data: data as {
      pointsCost: number;
      freeTransfersRemaining: number;
      matchdayId: string;
    },
  };
}

export async function recalculateMatchdayAndRankings(input: {
  matchdayId: string;
  finalise: boolean;
}): Promise<FantasyActionResult<{ managersUpdated: number }>> {
  await requireRole("admin");
  const admin = createAdminClient();

  const { error: prepErr } = await db(admin).rpc(
    "fantasy_prepare_matchday_snapshots",
    {
      p_matchday_id: input.matchdayId,
    },
  );
  if (prepErr) {
    console.error("[fantasy] prepare_matchday_snapshots failed:", prepErr.message);
    return fail(
      "DB_ERROR",
      "Could not prepare matchday snapshots. Please try again.",
    );
  }

  let statsRows;
  try {
    statsRows = await getPlayerMatchStats({ matchdayId: input.matchdayId });
  } catch (err) {
    console.error("[fantasy] getPlayerMatchStats failed:", err);
    return fail(
      "DB_ERROR",
      "Could not load player match stats. Please try again.",
    );
  }

  const [
    rulesRes,
    mdRes,
    managersRes,
    playersRes,
    picksRes,
    transfersRes,
  ] = await Promise.all([
    db(admin).from("fantasy_rules").select("*").eq("id", 1).single(),
    db(admin).from("matchdays").select("*").eq("id", input.matchdayId).single(),
    db(admin).from("managers").select("*"),
    db(admin)
      .from("players")
      .select("id, team_id, display_name, position, price_tenths, status"),
    db(admin).from("picks").select("*").eq("matchday_id", input.matchdayId),
    db(admin)
      .from("transfers")
      .select("manager_id, points_cost")
      .eq("matchday_id", input.matchdayId),
  ]);

  if (rulesRes.error || !rulesRes.data) {
    return fail("RULES_NOT_FOUND", "Fantasy rules not found.");
  }
  if (mdRes.error || !mdRes.data) {
    return fail("MATCHDAY_NOT_FOUND", "Matchday not found.");
  }

  const rules = rulesRes.data as FantasyRules;
  const matchday = mdRes.data as MatchdayInfo;
  const managers = (managersRes.data ?? []) as ManagerProfile[];
  const players = (playersRes.data ?? []) as FantasyPlayer[];
  const allPicks = (picksRes.data ?? []) as (PickInput & {
    manager_id: string;
  })[];
  const allTransfers = (transfersRes.data ?? []) as {
    manager_id: string;
    points_cost: number;
  }[];

  const picksByManager = new Map<string, PickInput[]>();
  for (const row of allPicks) {
    const list = picksByManager.get(row.manager_id) ?? [];
    list.push({
      player_id: row.player_id,
      is_starter: row.is_starter,
      bench_order: row.bench_order,
      is_captain: row.is_captain,
      is_vice_captain: row.is_vice_captain,
    });
    picksByManager.set(row.manager_id, list);
  }

  const transferCostByManager = new Map<string, number>();
  for (const row of allTransfers) {
    transferCostByManager.set(
      row.manager_id,
      (transferCostByManager.get(row.manager_id) ?? 0) + row.points_cost,
    );
  }

  const upsertRows: {
    manager_id: string;
    matchday_id: string;
    gross_points: number;
    transfer_cost: number;
    net_points: number;
    is_provisional: boolean;
    breakdown: ManagerMatchdayScoreResult["breakdown"];
    calculated_at: string;
  }[] = [];

  const nowIso = new Date().toISOString();

  for (const manager of managers) {
    const managerPicks = picksByManager.get(manager.id) ?? [];
    const transferCost = transferCostByManager.get(manager.id) ?? 0;

    const scoreResult = calculateManagerMatchdayScore({
      picks: managerPicks,
      players,
      statsRows,
      rules,
      transferCost,
    });

    upsertRows.push({
      manager_id: manager.id,
      matchday_id: matchday.id,
      gross_points: scoreResult.gross_points,
      transfer_cost: scoreResult.transfer_cost,
      net_points: scoreResult.net_points,
      is_provisional: !input.finalise,
      breakdown: scoreResult.breakdown,
      calculated_at: nowIso,
    });
  }

  if (upsertRows.length > 0) {
    const { error: upsertErr } = await db(admin)
      .from("manager_matchday_points")
      .upsert(upsertRows, { onConflict: "manager_id,matchday_id" });
    if (upsertErr) {
      console.error(
        "[fantasy] manager_matchday_points upsert failed:",
        upsertErr.message,
      );
      return fail(
        "DB_ERROR",
        "Could not save matchday points. Please try again.",
      );
    }
  }

  if (input.finalise) {
    await db(admin)
      .from("matchdays")
      .update({ status: "finalised" })
      .eq("id", matchday.id);
  }

  const { data: allMdPoints } = await db(admin)
    .from("manager_matchday_points")
    .select("manager_id, net_points");

  const totalsByManager = new Map<string, number>();
  for (const row of (allMdPoints ?? []) as {
    manager_id: string;
    net_points: number;
  }[]) {
    totalsByManager.set(
      row.manager_id,
      (totalsByManager.get(row.manager_id) ?? 0) + row.net_points,
    );
  }

  const rankedManagers = managers
    .map((m) => ({
      ...m,
      total_points: totalsByManager.get(m.id) ?? 0,
    }))
    .sort((a, b) => b.total_points - a.total_points);

  let currentOverallRank = 0;
  let lastOverallPoints: number | null = null;

  const yearCounters = new Map<
    number,
    { rank: number; lastPts: number | null; seen: number }
  >();

  for (let i = 0; i < rankedManagers.length; i += 1) {
    const m = rankedManagers[i];
    if (lastOverallPoints === null || m.total_points < lastOverallPoints) {
      currentOverallRank = i + 1;
      lastOverallPoints = m.total_points;
    }

    let yearRank: number | null = null;
    if (m.year_group !== null) {
      const yc = yearCounters.get(m.year_group) ?? {
        rank: 0,
        lastPts: null,
        seen: 0,
      };
      yc.seen += 1;
      if (yc.lastPts === null || m.total_points < yc.lastPts) {
        yc.rank = yc.seen;
        yc.lastPts = m.total_points;
      }
      yearCounters.set(m.year_group, yc);
      yearRank = yc.rank;
    }

    await db(admin)
      .from("managers")
      .update({
        total_points: m.total_points,
        overall_rank: currentOverallRank,
        year_rank: yearRank,
      })
      .eq("id", m.id);
  }

  return { ok: true, data: { managersUpdated: rankedManagers.length } };
}

export async function createMiniLeague(input: {
  name: string;
}): Promise<
  FantasyActionResult<{ id: string; name: string; invite_code: string }>
> {
  const current = await getCurrentUser();
  if (!current) {
    return fail("NOT_SIGNED_IN", "Sign in to create a mini-league.");
  }

  const supabase = await createClient();
  const { data, error } = await db(supabase).rpc("create_league", {
    p_name: input.name,
  });

  if (error || !data) {
    return parseRpcError(error?.message ?? "Could not create league.");
  }

  return {
    ok: true,
    data: data as { id: string; name: string; invite_code: string },
  };
}

export async function joinMiniLeague(input: {
  inviteCode: string;
}): Promise<FantasyActionResult<{ leagueId: string; leagueName: string }>> {
  const current = await getCurrentUser();
  if (!current) {
    return fail("NOT_SIGNED_IN", "Sign in to join a mini-league.");
  }

  const supabase = await createClient();
  const { data, error } = await db(supabase).rpc("join_league", {
    p_code: normalizeInviteCode(input.inviteCode),
  });

  if (error || !data) {
    return parseRpcError(error?.message ?? "Could not join league.");
  }

  return {
    ok: true,
    data: data as { leagueId: string; leagueName: string },
  };
}