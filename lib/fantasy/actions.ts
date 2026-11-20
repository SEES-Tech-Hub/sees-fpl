"use server";

import { getCurrentUser, requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateInviteCode, normalizeInviteCode } from "./leagues";
import { calculateManagerMatchdayScore } from "./scoring";
import {
  calculateTransferCost,
  isUnlimitedTransferMatchday,
  nextMatchdayFreeTransfers,
  validateTransfersAndResultingSquad,
} from "./transfers";
import type {
  FantasyActionResult,
  FantasyPlayer,
  FantasyRules,
  ManagerMatchdayScoreResult,
  ManagerProfile,
  MatchdayInfo,
  PickInput,
  PlayerMatchStats,
} from "./types";
import {
  isDeadlinePassed,
  validateLineupAndCaptains,
  validateSquad,
} from "./validation";

type UntypedQueryResult = Promise<{
  data: unknown;
  error: { message: string } | null;
}>;

type UntypedFilterBuilder = PromiseLike<{
  data: unknown;
  error: { message: string } | null;
}> & {
  select: (columns?: string) => UntypedFilterBuilder;
  eq: (column: string, value: unknown) => UntypedFilterBuilder;
  in: (column: string, values: unknown[]) => UntypedFilterBuilder;
  single: () => UntypedQueryResult;
  maybeSingle: () => UntypedQueryResult;
};

type UntypedTableClient = {
  from: (table: string) => {
    select: (columns?: string) => UntypedFilterBuilder;
    insert: (values: unknown) => UntypedFilterBuilder;
    update: (values: unknown) => UntypedFilterBuilder;
    upsert: (
      values: unknown,
      options?: { onConflict?: string },
    ) => UntypedFilterBuilder;
    delete: () => UntypedFilterBuilder;
  };
};

function untyped(client: unknown): UntypedTableClient {
  return client as UntypedTableClient;
}

export async function getFantasyRules(): Promise<FantasyActionResult<FantasyRules>> {
  const supabase = await createClient();
  const { data, error } = await untyped(supabase)
    .from("fantasy_rules")
    .select("*")
    .eq("id", 1)
    .single();

  if (error || !data) {
    return { ok: false, error: "Fantasy rules configuration not found." };
  }
  return { ok: true, data: data as FantasyRules };
}

export async function createOrGetManager(input: {
  teamName: string;
  yearGroup?: number | null;
}): Promise<FantasyActionResult<ManagerProfile>> {
  const current = await getCurrentUser();
  if (!current) {
    return { ok: false, error: "Sign in to create a fantasy team." };
  }

  const trimmed = input.teamName.trim();
  if (trimmed.length < 2 || trimmed.length > 30) {
    return { ok: false, error: "Team name must be between 2 and 30 characters." };
  }

  const supabase = await createClient();
  const { data: existing } = await untyped(supabase)
    .from("managers")
    .select("*")
    .eq("user_id", current.user.id)
    .maybeSingle();

  if (existing) {
    return { ok: true, data: existing as ManagerProfile };
  }

  const yearGroup = input.yearGroup ?? current.profile.year_group ?? null;

  const { data: created, error } = await untyped(supabase)
    .from("managers")
    .insert({
      user_id: current.user.id,
      team_name: trimmed,
      year_group: yearGroup,
    })
    .select("*")
    .single();

  if (error || !created) {
    return { ok: false, error: error?.message ?? "Could not create manager profile." };
  }

  return { ok: true, data: created as ManagerProfile };
}

export async function saveInitialSquadAndPicks(input: {
  matchdayId: string;
  playerIds: string[];
  picks: PickInput[];
}): Promise<FantasyActionResult<{ saved: true }>> {
  const current = await getCurrentUser();
  if (!current) {
    return { ok: false, error: "Sign in to save your squad." };
  }

  const supabase = await createClient();

  const [rulesRes, mdRes, managerRes, playersRes] = await Promise.all([
    getFantasyRules(),
    supabase.from("matchdays").select("*").eq("id", input.matchdayId).single(),
    untyped(supabase)
      .from("managers")
      .select("*")
      .eq("user_id", current.user.id)
      .single(),
    supabase
      .from("players")
      .select("id, team_id, display_name, position, price_tenths, status")
      .in("id", input.playerIds),
  ]);

  if (!rulesRes.ok) return { ok: false, error: rulesRes.error };
  if (mdRes.error || !mdRes.data) {
    return { ok: false, error: "Target matchday not found." };
  }
  if (managerRes.error || !managerRes.data) {
    return { ok: false, error: "Create your manager profile first." };
  }
  if (playersRes.error || !playersRes.data) {
    return { ok: false, error: "Could not load selected players." };
  }

  const matchday = mdRes.data as MatchdayInfo;
  if (isDeadlinePassed(matchday)) {
    return { ok: false, error: "The deadline for this matchday has passed." };
  }

  const manager = managerRes.data as ManagerProfile;
  const players = playersRes.data as FantasyPlayer[];

  const squadCheck = validateSquad(players, rulesRes.data);
  if (!squadCheck.valid) {
    return { ok: false, error: squadCheck.reason };
  }

  const lineupCheck = validateLineupAndCaptains(
    input.picks,
    players,
    rulesRes.data,
  );
  if (!lineupCheck.valid) {
    return { ok: false, error: lineupCheck.reason };
  }

  const { error: delSquadErr } = await untyped(supabase)
    .from("squads")
    .delete()
    .eq("manager_id", manager.id);
  if (delSquadErr) {
    return { ok: false, error: delSquadErr.message };
  }

  const squadRows = input.playerIds.map((playerId) => ({
    manager_id: manager.id,
    player_id: playerId,
  }));
  const { error: insSquadErr } = await untyped(supabase)
    .from("squads")
    .insert(squadRows);
  if (insSquadErr) {
    return { ok: false, error: insSquadErr.message };
  }

  const { error: delPicksErr } = await untyped(supabase)
    .from("picks")
    .delete()
    .eq("manager_id", manager.id)
    .eq("matchday_id", matchday.id);
  if (delPicksErr) {
    return { ok: false, error: delPicksErr.message };
  }

  const pickRows = input.picks.map((p) => ({
    manager_id: manager.id,
    matchday_id: matchday.id,
    player_id: p.player_id,
    is_starter: p.is_starter,
    bench_order: p.bench_order,
    is_captain: p.is_captain,
    is_vice_captain: p.is_vice_captain,
  }));
  const { error: insPicksErr } = await untyped(supabase)
    .from("picks")
    .insert(pickRows);
  if (insPicksErr) {
    return { ok: false, error: insPicksErr.message };
  }

  return { ok: true, data: { saved: true } };
}

export async function saveMatchdayLineup(input: {
  matchdayId: string;
  picks: PickInput[];
}): Promise<FantasyActionResult<{ saved: true }>> {
  const current = await getCurrentUser();
  if (!current) {
    return { ok: false, error: "Sign in to update your lineup." };
  }

  const supabase = await createClient();
  const [rulesRes, mdRes, managerRes] = await Promise.all([
    getFantasyRules(),
    supabase.from("matchdays").select("*").eq("id", input.matchdayId).single(),
    untyped(supabase)
      .from("managers")
      .select("*")
      .eq("user_id", current.user.id)
      .single(),
  ]);

  if (!rulesRes.ok) return { ok: false, error: rulesRes.error };
  if (mdRes.error || !mdRes.data) {
    return { ok: false, error: "Matchday not found." };
  }
  if (managerRes.error || !managerRes.data) {
    return { ok: false, error: "Manager profile not found." };
  }

  const matchday = mdRes.data as MatchdayInfo;
  if (isDeadlinePassed(matchday)) {
    return { ok: false, error: "The deadline for this matchday has passed." };
  }

  const manager = managerRes.data as ManagerProfile;

  const { data: squadLinks, error: squadErr } = await untyped(supabase)
    .from("squads")
    .select("player_id")
    .eq("manager_id", manager.id);
  if (squadErr || !squadLinks) {
    return { ok: false, error: "Could not load your squad." };
  }

  const squadIds = (squadLinks as { player_id: string }[]).map((r) => r.player_id);
  const { data: playersData, error: playersErr } = await supabase
    .from("players")
    .select("id, team_id, display_name, position, price_tenths, status")
    .in("id", squadIds);
  if (playersErr || !playersData) {
    return { ok: false, error: "Could not load squad player details." };
  }

  const lineupCheck = validateLineupAndCaptains(
    input.picks,
    playersData as FantasyPlayer[],
    rulesRes.data,
  );
  if (!lineupCheck.valid) {
    return { ok: false, error: lineupCheck.reason };
  }

  const { error: delErr } = await untyped(supabase)
    .from("picks")
    .delete()
    .eq("manager_id", manager.id)
    .eq("matchday_id", matchday.id);
  if (delErr) return { ok: false, error: delErr.message };

  const pickRows = input.picks.map((p) => ({
    manager_id: manager.id,
    matchday_id: matchday.id,
    player_id: p.player_id,
    is_starter: p.is_starter,
    bench_order: p.bench_order,
    is_captain: p.is_captain,
    is_vice_captain: p.is_vice_captain,
  }));
  const { error: insErr } = await untyped(supabase)
    .from("picks")
    .insert(pickRows);
  if (insErr) return { ok: false, error: insErr.message };

  return { ok: true, data: { saved: true } };
}

export async function activateWildcard(input: {
  matchdayId: string;
}): Promise<FantasyActionResult<{ activated: true }>> {
  const current = await getCurrentUser();
  if (!current) {
    return { ok: false, error: "Sign in to activate your Wildcard." };
  }

  const supabase = await createClient();
  const [mdRes, managerRes] = await Promise.all([
    supabase.from("matchdays").select("*").eq("id", input.matchdayId).single(),
    untyped(supabase)
      .from("managers")
      .select("*")
      .eq("user_id", current.user.id)
      .single(),
  ]);

  if (mdRes.error || !mdRes.data) {
    return { ok: false, error: "Matchday not found." };
  }
  if (managerRes.error || !managerRes.data) {
    return { ok: false, error: "Manager profile not found." };
  }

  const matchday = mdRes.data as MatchdayInfo;
  if (isDeadlinePassed(matchday)) {
    return { ok: false, error: "Cannot activate Wildcard after the deadline." };
  }
  if (isUnlimitedTransferMatchday(matchday)) {
    return {
      ok: false,
      error: "Transfers are already unlimited and free before this matchday.",
    };
  }

  const manager = managerRes.data as ManagerProfile;
  if (manager.wildcard_used) {
    return { ok: false, error: "You have already used your Wildcard." };
  }

  const { error: chipErr } = await untyped(supabase).from("chips").insert({
    manager_id: manager.id,
    matchday_id: matchday.id,
    chip_type: "wildcard",
  });
  if (chipErr) {
    return { ok: false, error: chipErr.message };
  }

  await untyped(supabase)
    .from("managers")
    .update({ wildcard_used: true })
    .eq("id", manager.id);

  await untyped(supabase)
    .from("transfers")
    .update({ points_cost: 0 })
    .eq("manager_id", manager.id)
    .eq("matchday_id", matchday.id);

  return { ok: true, data: { activated: true } };
}

export async function submitTransfers(input: {
  matchdayId: string;
  swaps: { playerOutId: string; playerInId: string }[];
  useWildcard?: boolean;
}): Promise<FantasyActionResult<{ pointsCost: number; freeTransfersRemaining: number }>> {
  const current = await getCurrentUser();
  if (!current) {
    return { ok: false, error: "Sign in to make transfers." };
  }

  const supabase = await createClient();
  const [rulesRes, mdRes, managerRes] = await Promise.all([
    getFantasyRules(),
    supabase.from("matchdays").select("*").eq("id", input.matchdayId).single(),
    untyped(supabase)
      .from("managers")
      .select("*")
      .eq("user_id", current.user.id)
      .single(),
  ]);

  if (!rulesRes.ok) return { ok: false, error: rulesRes.error };
  if (mdRes.error || !mdRes.data) {
    return { ok: false, error: "Matchday not found." };
  }
  if (managerRes.error || !managerRes.data) {
    return { ok: false, error: "Manager profile not found." };
  }

  const matchday = mdRes.data as MatchdayInfo;
  if (isDeadlinePassed(matchday)) {
    return { ok: false, error: "Transfers are locked after the matchday deadline." };
  }

  let manager = managerRes.data as ManagerProfile;

  if (input.useWildcard && !manager.wildcard_used) {
    const wcRes = await activateWildcard({ matchdayId: matchday.id });
    if (!wcRes.ok) return { ok: false, error: wcRes.error };
    manager = { ...manager, wildcard_used: true };
  }

  const [{ data: squadLinks }, { data: activeChip }] = await Promise.all([
    untyped(supabase)
      .from("squads")
      .select("player_id")
      .eq("manager_id", manager.id),
    untyped(supabase)
      .from("chips")
      .select("id")
      .eq("manager_id", manager.id)
      .eq("matchday_id", matchday.id)
      .eq("chip_type", "wildcard")
      .maybeSingle(),
  ]);

  const currentSquadIds = ((squadLinks ?? []) as { player_id: string }[]).map(
    (r) => r.player_id,
  );
  const allRelevantIds = Array.from(
    new Set([
      ...currentSquadIds,
      ...input.swaps.map((s) => s.playerOutId),
      ...input.swaps.map((s) => s.playerInId),
    ]),
  );

  const { data: playersData, error: playersErr } = await supabase
    .from("players")
    .select("id, team_id, display_name, position, price_tenths, status")
    .in("id", allRelevantIds);
  if (playersErr || !playersData) {
    return { ok: false, error: "Could not load players for transfer check." };
  }

  const playerMap = new Map(
    (playersData as FantasyPlayer[]).map((p) => [p.id, p]),
  );
  const currentSquad = currentSquadIds
    .map((id) => playerMap.get(id))
    .filter((p): p is FantasyPlayer => Boolean(p));

  const resolvedSwaps: { outPlayer: FantasyPlayer; inPlayer: FantasyPlayer }[] = [];
  for (const s of input.swaps) {
    const outPlayer = playerMap.get(s.playerOutId);
    const inPlayer = playerMap.get(s.playerInId);
    if (!outPlayer || !inPlayer) {
      return { ok: false, error: "One or more selected players do not exist." };
    }
    resolvedSwaps.push({ outPlayer, inPlayer });
  }

  const transferCheck = validateTransfersAndResultingSquad({
    currentSquad,
    swaps: resolvedSwaps,
    rules: rulesRes.data,
  });
  if (!transferCheck.valid) {
    return { ok: false, error: transferCheck.reason };
  }

  const costCalc = calculateTransferCost({
    matchday,
    transfersCount: resolvedSwaps.length,
    freeTransfersAvailable: manager.free_transfers,
    wildcardActive: Boolean(activeChip),
    rules: rulesRes.data,
  });

  const outIds = resolvedSwaps.map((s) => s.outPlayer.id);
  const { error: delErr } = await untyped(supabase)
    .from("squads")
    .delete()
    .eq("manager_id", manager.id)
    .in("player_id", outIds);
  if (delErr) return { ok: false, error: delErr.message };

  const inRows = resolvedSwaps.map((s) => ({
    manager_id: manager.id,
    player_id: s.inPlayer.id,
  }));
  const { error: insErr } = await untyped(supabase)
    .from("squads")
    .insert(inRows);
  if (insErr) return { ok: false, error: insErr.message };

  const freeSlotsLeft =
    Boolean(activeChip) || isUnlimitedTransferMatchday(matchday)
      ? resolvedSwaps.length
      : manager.free_transfers;

  const transferRows = resolvedSwaps.map((s, idx) => ({
    manager_id: manager.id,
    matchday_id: matchday.id,
    player_out_id: s.outPlayer.id,
    player_in_id: s.inPlayer.id,
    points_cost: idx < freeSlotsLeft ? 0 : rulesRes.data.extra_transfer_cost,
  }));
  const { error: logErr } = await untyped(supabase)
    .from("transfers")
    .insert(transferRows);
  if (logErr) return { ok: false, error: logErr.message };

  const { error: mgrErr } = await untyped(supabase)
    .from("managers")
    .update({ free_transfers: costCalc.freeTransfersRemaining })
    .eq("id", manager.id);
  if (mgrErr) return { ok: false, error: mgrErr.message };

  return {
    ok: true,
    data: {
      pointsCost: costCalc.pointsCost,
      freeTransfersRemaining: costCalc.freeTransfersRemaining,
    },
  };
}

export async function recalculateMatchdayAndRankings(input: {
  matchdayId: string;
  statsRows: PlayerMatchStats[];
  finalise: boolean;
}): Promise<FantasyActionResult<{ managersUpdated: number }>> {
  await requireRole("admin");
  const admin = createAdminClient();

  const [rulesRes, mdRes, managersRes, playersRes, picksRes, transfersRes] =
    await Promise.all([
      untyped(admin).from("fantasy_rules").select("*").eq("id", 1).single(),
      admin.from("matchdays").select("*").eq("id", input.matchdayId).single(),
      untyped(admin).from("managers").select("*"),
      admin
        .from("players")
        .select("id, team_id, display_name, position, price_tenths, status"),
      untyped(admin).from("picks").select("*").eq("matchday_id", input.matchdayId),
      untyped(admin)
        .from("transfers")
        .select("manager_id, points_cost")
        .eq("matchday_id", input.matchdayId),
    ]);

  if (rulesRes.error || !rulesRes.data) {
    return { ok: false, error: "Fantasy rules not found." };
  }
  if (mdRes.error || !mdRes.data) {
    return { ok: false, error: "Matchday not found." };
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
      statsRows: input.statsRows,
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
    const { error: upsertErr } = await untyped(admin)
      .from("manager_matchday_points")
      .upsert(upsertRows, { onConflict: "manager_id,matchday_id" });
    if (upsertErr) {
      return { ok: false, error: upsertErr.message };
    }
  }

  const wasAlreadyFinalised = matchday.status === "finalised";

  if (input.finalise) {
    await admin
      .from("matchdays")
      .update({ status: "finalised" })
      .eq("id", matchday.id);
  }

  const { data: allMdPoints } = await untyped(admin)
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

    const updatedFreeTransfers =
      input.finalise && !wasAlreadyFinalised
        ? nextMatchdayFreeTransfers(m.free_transfers, rules)
        : m.free_transfers;

    await untyped(admin)
      .from("managers")
      .update({
        total_points: m.total_points,
        overall_rank: currentOverallRank,
        year_rank: yearRank,
        free_transfers: updatedFreeTransfers,
      })
      .eq("id", m.id);
  }

  return { ok: true, data: { managersUpdated: rankedManagers.length } };
}

export async function createMiniLeague(input: {
  name: string;
}): Promise<FantasyActionResult<{ id: string; name: string; invite_code: string }>> {
  const current = await getCurrentUser();
  if (!current) {
    return { ok: false, error: "Sign in to create a mini-league." };
  }

  const trimmed = input.name.trim();
  if (trimmed.length < 2 || trimmed.length > 40) {
    return { ok: false, error: "League name must be between 2 and 40 characters." };
  }

  const supabase = await createClient();
  const { data: managerData, error: mgrErr } = await untyped(supabase)
    .from("managers")
    .select("id")
    .eq("user_id", current.user.id)
    .single();
  if (mgrErr || !managerData) {
    return { ok: false, error: "Create your fantasy team before creating a league." };
  }

  const managerId = (managerData as { id: string }).id;
  const inviteCode = generateInviteCode(6);

  const { data: league, error: createErr } = await untyped(supabase)
    .from("leagues")
    .insert({
      name: trimmed,
      invite_code: inviteCode,
      created_by: managerId,
    })
    .select("id, name, invite_code")
    .single();

  if (createErr || !league) {
    return { ok: false, error: createErr?.message ?? "Could not create league." };
  }

  const createdLeague = league as { id: string; name: string; invite_code: string };

  await untyped(supabase).from("league_members").insert({
    league_id: createdLeague.id,
    manager_id: managerId,
  });

  return { ok: true, data: createdLeague };
}

export async function joinMiniLeague(input: {
  inviteCode: string;
}): Promise<FantasyActionResult<{ leagueId: string; leagueName: string }>> {
  const current = await getCurrentUser();
  if (!current) {
    return { ok: false, error: "Sign in to join a mini-league." };
  }

  const code = normalizeInviteCode(input.inviteCode);
  if (code.length !== 6) {
    return { ok: false, error: "Invite code must be 6 characters." };
  }

  const supabase = await createClient();
  const [mgrRes, leagueRes] = await Promise.all([
    untyped(supabase)
      .from("managers")
      .select("id")
      .eq("user_id", current.user.id)
      .single(),
    untyped(supabase)
      .from("leagues")
      .select("id, name")
      .eq("invite_code", code)
      .maybeSingle(),
  ]);

  if (mgrRes.error || !mgrRes.data) {
    return { ok: false, error: "Create your fantasy team before joining a league." };
  }
  if (leagueRes.error || !leagueRes.data) {
    return { ok: false, error: "Invalid invite code. No league found." };
  }

  const managerId = (mgrRes.data as { id: string }).id;
  const league = leagueRes.data as { id: string; name: string };

  const { error: joinErr } = await untyped(supabase)
    .from("league_members")
    .upsert(
      {
        league_id: league.id,
        manager_id: managerId,
      },
      { onConflict: "league_id,manager_id" },
    );

  if (joinErr) {
    return { ok: false, error: joinErr.message };
  }

  return { ok: true, data: { leagueId: league.id, leagueName: league.name } };
}