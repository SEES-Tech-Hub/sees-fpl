import "server-only";
// The ONLY place the fantasy screens talk to the backend.
// Contract: docs/fantasy-backend-contract.md. UI types: lib/fantasy/types.ts.
//
// Reads go straight to the tables (RLS decides who sees what). Writes call
// Mary's SECURITY DEFINER functions (save_squad, save_lineup, make_transfers,
// activate_wildcard, create_manager, create_league, join_league), which raise
// "CODE: message" on failure.
//
// A manager is identified to the screens by their user id (managers.user_id),
// so links like /fantasy/points?manager=<id> and "is this me?" checks use the
// same id as the signed-in user. managers.id stays internal to this file.

import { playerPhotoUrl } from "./player-photos";
import { cache } from "react";
import { connection } from "next/server";
import { getCurrentUser, requireSignedIn } from "@/lib/auth";
import { getPlayerMatchStats } from "@/lib/live/stats";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type {
  FantasyPlayer as EnginePlayer,
  FantasyRules as EngineRules,
  PickInput,
  PlayerMatchStats,
} from "./engine-types";
import { fantasyError, parseRpcError } from "./errors";
import { aggregatePlayerStats, calculateManagerMatchdayScore, calculatePlayerPoints } from "./scoring";
import type {
  ActionResult,
  FantasyRules,
  League,
  LeagueStandings,
  LineupInput,
  Manager,
  ManagerMatchdayPoints,
  Matchday,
  MatchdayHistoryRow,
  MatchdayState,
  MyTeam,
  Pick as TeamPick,
  Player,
  PlayerPoints,
  Position,
  RankingPage,
  RankingRow,
  RankingScope,
  ScoringRule,
  Team,
  TransferInput,
  TransferRecord,
  TransferState,
} from "./types";

type Tables = Database["public"]["Tables"];
type RulesRow = Tables["fantasy_rules"]["Row"];
type ManagerRow = Tables["managers"]["Row"];
type PickRow = Pick<Tables["picks"]["Row"], "matchday_id" | "player_id" | "is_starter" | "bench_order" | "is_captain" | "is_vice_captain">;

function fail(message: string, context: string): never {
  throw new Error(`Couldn't load ${context}: ${message}`);
}

// ===========================================================================
// Who is calling
// ===========================================================================

export type FantasyUser = { id: string; name: string; yearGroup: number | null };

/** For signed-in pages: sends signed-out visitors to /login and back. */
export async function requireFantasyUser(nextPath: string): Promise<FantasyUser> {
  const { profile } = await requireSignedIn(nextPath);
  return { id: profile.id, name: profile.display_name ?? "Manager", yearGroup: profile.year_group };
}

/** For public pages (rankings, rules): the user if signed in, else null. */
export async function getOptionalFantasyUser(): Promise<FantasyUser | null> {
  await connection();
  const current = await getCurrentUser();
  if (!current) return null;
  const { profile } = current;
  return { id: profile.id, name: profile.display_name ?? "Manager", yearGroup: profile.year_group };
}

// ===========================================================================
// Rules
// ===========================================================================

const getRulesRow = cache(async (): Promise<RulesRow> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("fantasy_rules").select("*").eq("id", 1).single();
  if (error) fail(error.message, "the fantasy rules");
  return data;
});

const getDeadlineMinutes = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_deadline_rules");
  return data?.[0]?.minutes_before_kickoff ?? 30;
});

const same = (n: number): Record<Position, number> => ({ GK: n, DEF: n, MID: n, FWD: n });

function scoringRules(r: RulesRow): ScoringRule[] {
  return [
    { key: "appeared", label: "Appeared", points: same(r.pts_appearance), note: "Any minutes" },
    {
      key: "played_30",
      label: `Played ${r.min_minutes_threshold} min or more`,
      points: same(r.pts_30_mins),
      note: "On top of appearing. Extra time counts",
    },
    { key: "goal", label: "Goal", points: { GK: r.pts_goal_gk, DEF: r.pts_goal_def, MID: r.pts_goal_mid, FWD: r.pts_goal_fwd } },
    { key: "assist", label: "Assist", points: same(r.pts_assist) },
    {
      key: "clean_sheet",
      label: "Clean sheet",
      points: { GK: r.pts_clean_sheet_gk, DEF: r.pts_clean_sheet_def, MID: r.pts_clean_sheet_mid, FWD: r.pts_clean_sheet_fwd },
      note: `${r.min_minutes_threshold} min or more on the pitch, no goals conceded while on it`,
    },
    {
      key: "goals_conceded_2",
      label: `Every ${r.pts_goals_conceded_step} goals conceded`,
      points: {
        GK: r.pts_goals_conceded_gk,
        DEF: r.pts_goals_conceded_def,
        MID: r.pts_goals_conceded_mid,
        FWD: r.pts_goals_conceded_fwd,
      },
      note: "Only while on the pitch",
    },
    { key: "penalty_saved", label: "Penalty saved", points: same(r.pts_penalty_save), note: "Normal or extra time, not shootouts" },
    { key: "penalty_missed", label: "Penalty missed", points: same(r.pts_penalty_miss), note: "Not shootouts" },
    { key: "yellow_card", label: "Yellow card", points: same(r.pts_yellow_card) },
    { key: "red_card", label: "Red card", points: same(r.pts_red_card) },
    { key: "own_goal", label: "Own goal", points: same(r.pts_own_goal) },
    { key: "man_of_the_match", label: "Man of the Match", points: same(r.pts_motm), note: "Chosen by the match official" },
  ];
}

export const getFantasyRules = cache(async (): Promise<FantasyRules> => {
  const [r, deadlineMinutes] = await Promise.all([getRulesRow(), getDeadlineMinutes()]);
  return {
    budgetTenths: r.budget_tenths,
    squadSize: r.squad_size,
    squadPositions: { GK: r.gk_quota, DEF: r.def_quota, MID: r.mid_quota, FWD: r.fwd_quota },
    maxPerTeam: r.max_per_team,
    startingSize: r.starting_size,
    formation: {
      GK: { min: r.min_start_gk, max: r.max_start_gk },
      DEF: { min: r.min_start_def, max: r.max_start_def },
      MID: { min: r.min_start_mid, max: r.max_start_mid },
      FWD: { min: r.min_start_fwd, max: r.max_start_fwd },
    },
    benchSize: r.squad_size - r.starting_size,
    captainMultiplier: r.captain_multiplier,
    freeTransfersPerMatchday: r.free_transfers_per_md,
    maxSavedFreeTransfers: r.max_saved_transfers,
    transferHitPoints: r.extra_transfer_cost,
    unlimitedTransferMatchdays: r.unlimited_transfer_matchdays,
    // The chips table allows one of each chip per manager.
    wildcardsPerManager: 1,
    deadlineMinutesBeforeKickoff: deadlineMinutes,
    // Fixed by check constraints on leagues.invite_code and managers.team_name.
    leagueCodeLength: 6,
    teamNameMaxLength: 30,
    scoring: scoringRules(r),
  };
});

// ===========================================================================
// Reference data: teams, players, matchdays
// ===========================================================================

export const getTeams = cache(async (): Promise<Team[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("teams").select("id, year, name, short_name, class_label").order("year");
  if (error) fail(error.message, "teams");
  return data.map((t) => ({ id: t.id, year: t.year, name: t.name, shortName: t.short_name, classLabel: t.class_label }));
});

/** Every finished-or-live stat row that belongs to a matchday. */
const getMatchdayStats = cache(async (): Promise<Map<string, PlayerMatchStats[]>> => {
  const md = await getMatchdayState();
  const byMatchday = new Map<string, PlayerMatchStats[]>();
  const played = md.matchdays.filter((m) => m.fixtures.some((f) => f.status !== "scheduled" && f.status !== "postponed" && f.status !== "cancelled"));
  await Promise.all(
    played.map(async (m) => {
      byMatchday.set(m.id, await getPlayerMatchStats({ matchdayId: m.id }));
    }),
  );
  return byMatchday;
});

export const getPlayers = cache(async (): Promise<Player[]> => {
  const supabase = await createClient();
  const [players, selection, rules, stats, md] = await Promise.all([
    supabase
      .from("players")
      .select("id, team_id, full_name, display_name, position, price_tenths, status, shirt_number, teams(year, short_name)")
      .order("display_name"),
    supabase.rpc("fantasy_player_selection"),
    getRulesRow(),
    getMatchdayStats(),
    getMatchdayState(),
  ]);
  if (players.error) fail(players.error.message, "players");

  // Each team's next match that hasn't kicked off (fantasy matchdays only).
  const nextByTeam = new Map<string, NonNullable<Player["nextMatch"]>>();
  const upcoming = md.matchdays
    .flatMap((m) => m.fixtures)
    .filter((f) => f.kickoffAt && f.status === "scheduled" && new Date(f.kickoffAt).getTime() > md.serverNow)
    .sort((a, b) => a.kickoffAt!.localeCompare(b.kickoffAt!));
  for (const f of upcoming) {
    if (f.homeTeamId && !nextByTeam.has(f.homeTeamId)) nextByTeam.set(f.homeTeamId, { opponentShort: f.awayShort, kickoffAt: f.kickoffAt! });
    if (f.awayTeamId && !nextByTeam.has(f.awayTeamId)) nextByTeam.set(f.awayTeamId, { opponentShort: f.homeShort, kickoffAt: f.kickoffAt! });
  }
  const selectedBy = new Map((selection.data ?? []).map((s) => [s.player_id, Number(s.selected_by_pct)]));

  // Fantasy points so far: each matchday's stats, scored with the live rules.
  const totals = new Map<string, number>();
  const positionOf = new Map(players.data.map((p) => [p.id, p.position]));
  for (const rows of stats.values()) {
    for (const [playerId, s] of aggregatePlayerStats(rows)) {
      const position = positionOf.get(playerId);
      if (!position) continue;
      totals.set(playerId, (totals.get(playerId) ?? 0) + calculatePlayerPoints(position, s, rules as EngineRules).points);
    }
  }

  return players.data.map((p) => ({
    id: p.id,
    teamId: p.team_id,
    teamShort: p.teams?.short_name ?? "?",
    teamYear: p.teams?.year ?? 0,
    fullName: p.full_name,
    displayName: p.display_name,
    position: p.position,
    priceTenths: p.price_tenths,
    status: p.status,
    shirtNumber: p.shirt_number,
    totalPoints: totals.get(p.id) ?? 0,
    selectedByPct: selectedBy.get(p.id) ?? 0,
    photoUrl: playerPhotoUrl(p.id),
    nextMatch: nextByTeam.get(p.team_id) ?? null,
  }));
});

export const getMatchdayState = cache(async (): Promise<MatchdayState> => {
  await connection();
  const supabase = await createClient();
  const [mds, fx] = await Promise.all([
    supabase.from("matchdays").select("id, number, name, deadline_at, status").order("number"),
    supabase
      .from("fixtures")
      .select(
        "id, matchday_id, stage, kickoff_at, status, venue, home_team_id, away_team_id, home_score, away_score, home:teams!fixtures_home_team_id_fkey(short_name), away:teams!fixtures_away_team_id_fkey(short_name)",
      )
      .not("matchday_id", "is", null)
      .order("kickoff_at"),
  ]);
  if (mds.error) fail(mds.error.message, "matchdays");
  if (fx.error) fail(fx.error.message, "fixtures");
  const matchdays: Matchday[] = mds.data.map((m) => ({
    id: m.id,
    number: m.number,
    name: m.name,
    deadlineAt: m.deadline_at,
    status: m.status,
    fixtures: fx.data
      .filter((f) => f.matchday_id === m.id)
      .map((f) => ({
        id: f.id,
        matchdayId: f.matchday_id,
        stage: f.stage,
        kickoffAt: f.kickoff_at,
        status: f.status,
        venue: f.venue,
        homeTeamId: f.home_team_id,
        awayTeamId: f.away_team_id,
        homeShort: f.home?.short_name ?? null,
        awayShort: f.away?.short_name ?? null,
        homeScore: f.home_score,
        awayScore: f.away_score,
      })),
  }));
  const now = Date.now();
  const passed = (m: Matchday) => m.deadlineAt !== null && new Date(m.deadlineAt).getTime() <= now;
  // Same rule as fantasy_get_open_matchday(): the first matchday that is still open.
  const next = matchdays.find((m) => (m.status === "upcoming" || m.status === "open") && !passed(m)) ?? null;
  const current = [...matchdays].reverse().find((m) => passed(m) || m.status === "locked" || m.status === "finalised") ?? null;
  return { matchdays, next, current, serverNow: now };
});

// ===========================================================================
// Managers
// ===========================================================================

/** Every manager, with the name from their public profile. Small: one per student. */
const getAllManagers = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("managers")
    .select("id, user_id, team_name, year_group, total_points, overall_rank, created_at");
  if (error) fail(error.message, "managers");
  const ids = data.map((m) => m.user_id);
  const names = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data: profiles } = await supabase.from("public_profiles").select("id, display_name").in("id", ids.slice(i, i + 200));
    for (const p of profiles ?? []) if (p.id) names.set(p.id, p.display_name ?? "Manager");
  }
  return data.map((m) => ({ ...m, managerName: names.get(m.user_id) ?? "Manager" }));
});

const getManagerRow = cache(async (userId: string): Promise<ManagerRow | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("managers").select("*").eq("user_id", userId).maybeSingle();
  if (error) fail(error.message, "your fantasy team");
  return data;
});

export async function getMyManager(user: FantasyUser): Promise<Manager | null> {
  const m = await getManagerRow(user.id);
  if (!m) return null;
  return { id: user.id, teamName: m.team_name, managerName: user.name, yearGroup: m.year_group, createdAt: m.created_at };
}

// ===========================================================================
// Squad and picks
// ===========================================================================

const POSITION_ORDER: Record<Position, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 };

/**
 * A manager's picks for a matchday. Picks are copied forward only when the
 * manager next saves, so a matchday with no picks of its own uses the latest
 * earlier matchday's, exactly as fantasy_sync_manager_for_matchday would.
 */
const getPicksFor = cache(async (managerRowId: string, matchdayNumber: number): Promise<PickRow[]> => {
  const md = await getMatchdayState();
  const numberOf = new Map(md.matchdays.map((m) => [m.id, m.number]));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("picks")
    .select("matchday_id, player_id, is_starter, bench_order, is_captain, is_vice_captain")
    .eq("manager_id", managerRowId);
  if (error) fail(error.message, "picks");
  const usable = data.filter((p) => (numberOf.get(p.matchday_id) ?? Infinity) <= matchdayNumber);
  const latest = Math.max(...usable.map((p) => numberOf.get(p.matchday_id)!), -Infinity);
  return usable.filter((p) => numberOf.get(p.matchday_id) === latest);
});

/** Picks in slot order: starters GK, DEF, MID, FWD, then the bench in order. */
function orderPicks(picks: PickRow[], positionOf: (id: string) => Position | undefined): PickRow[] {
  const starters = picks
    .filter((p) => p.is_starter)
    .sort((a, b) => POSITION_ORDER[positionOf(a.player_id) ?? "FWD"] - POSITION_ORDER[positionOf(b.player_id) ?? "FWD"]);
  const bench = picks.filter((p) => !p.is_starter).sort((a, b) => (a.bench_order ?? 9) - (b.bench_order ?? 9));
  return [...starters, ...bench];
}

export async function getMyTeam(user: FantasyUser): Promise<MyTeam | null> {
  const mgr = await getManagerRow(user.id);
  if (!mgr) return null;
  const supabase = await createClient();
  const [squad, players, rules, md] = await Promise.all([
    supabase.from("squads").select("player_id").eq("manager_id", mgr.id),
    getPlayers(),
    getFantasyRules(),
    getMatchdayState(),
  ]);
  if (squad.error) fail(squad.error.message, "your squad");
  if (squad.data.length === 0) return null;

  const target = md.next ?? md.current;
  const byId = new Map(players.map((p) => [p.id, p]));
  const squadIds = new Set(squad.data.map((s) => s.player_id));
  // Transfers swap the player inside the open matchday's picks, so picks and
  // squad agree; anything else (picks from before a transfer) falls back to
  // the squad in position order with no armbands.
  const picks = orderPicks(await getPicksFor(mgr.id, target?.number ?? Infinity), (id) => byId.get(id)?.position).filter(
    (p) => squadIds.has(p.player_id),
  );
  const ordered: TeamPick[] =
    picks.length === squadIds.size
      ? picks.map((p, i) => ({ playerId: p.player_id, slot: i + 1, isCaptain: p.is_captain, isViceCaptain: p.is_vice_captain }))
      : [...squadIds]
          .sort((a, b) => POSITION_ORDER[byId.get(a)?.position ?? "FWD"] - POSITION_ORDER[byId.get(b)?.position ?? "FWD"])
          .map((id, i) => ({ playerId: id, slot: i + 1, isCaptain: false, isViceCaptain: false }));

  const value = [...squadIds].reduce((s, id) => s + (byId.get(id)?.priceTenths ?? 0), 0);
  return {
    matchdayId: target?.id ?? "",
    matchdayNumber: target?.number ?? 0,
    picks: ordered,
    bankTenths: rules.budgetTenths - value,
    squadValueTenths: value,
    locked: md.next === null,
  };
}

// ===========================================================================
// Transfers
// ===========================================================================

export async function getTransferState(user: FantasyUser): Promise<TransferState | null> {
  const [mgr, md, rules, team] = await Promise.all([
    getManagerRow(user.id),
    getMatchdayState(),
    getFantasyRules(),
    getMyTeam(user),
  ]);
  if (!mgr || !team || !md.next) return null;
  const next = md.next;
  const supabase = await createClient();
  const [transfers, chips] = await Promise.all([
    supabase.from("transfers").select("points_cost").eq("manager_id", mgr.id).eq("matchday_id", next.id),
    supabase.from("chips").select("matchday_id, chip_type").eq("manager_id", mgr.id),
  ]);
  if (transfers.error) fail(transfers.error.message, "transfers");
  if (chips.error) fail(chips.error.message, "chips");

  const wildcard = chips.data.find((c) => c.chip_type === "wildcard");
  const wildcardMd = wildcard ? md.matchdays.find((m) => m.id === wildcard.matchday_id) : undefined;
  const wildcardActive = wildcard?.matchday_id === next.id;
  const unlimited = rules.unlimitedTransferMatchdays.includes(next.number) || wildcardActive;

  // free_transfers is topped up when the manager next saves; show the
  // topped-up number now (same sum as fantasy_sync_manager_for_matchday).
  let free = mgr.free_transfers;
  if (next.number > mgr.last_rollover_matchday) {
    const now = md.serverNow;
    const passedCount = md.matchdays.filter(
      (m) =>
        m.number > Math.max(1, mgr.last_rollover_matchday) &&
        m.number <= next.number &&
        m.deadlineAt !== null &&
        new Date(m.deadlineAt).getTime() <= now &&
        !rules.unlimitedTransferMatchdays.includes(m.number),
    ).length;
    free = Math.min(rules.maxSavedFreeTransfers, free + passedCount * rules.freeTransfersPerMatchday);
  }

  return {
    matchdayId: next.id,
    matchdayNumber: next.number,
    freeTransfers: unlimited ? null : free,
    made: transfers.data.length,
    costPoints: transfers.data.reduce((s, t) => s + t.points_cost, 0),
    bankTenths: team.bankTenths,
    wildcard: {
      available: !mgr.wildcard_used,
      activeThisMatchday: wildcardActive,
      usedOnMatchday: wildcardMd?.number ?? null,
    },
    locked: false,
  };
}

export async function getTransferHistory(user: FantasyUser): Promise<TransferRecord[]> {
  const mgr = await getManagerRow(user.id);
  if (!mgr) return [];
  const [md, supabase] = await Promise.all([getMatchdayState(), createClient()]);
  const { data, error } = await supabase
    .from("transfers")
    .select("matchday_id, player_out_id, player_in_id, created_at")
    .eq("manager_id", mgr.id)
    .order("created_at");
  if (error) fail(error.message, "transfers");
  const numberOf = new Map(md.matchdays.map((m) => [m.id, m.number]));
  return data.map((t) => ({
    matchdayNumber: numberOf.get(t.matchday_id) ?? 0,
    outPlayerId: t.player_out_id,
    inPlayerId: t.player_in_id,
    madeAt: t.created_at,
  }));
}

// ===========================================================================
// Points
// ===========================================================================

const getPointsRows = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("manager_matchday_points")
    .select("manager_id, matchday_id, gross_points, transfer_cost, net_points, is_provisional, breakdown");
  if (error) fail(error.message, "points");
  return data;
});

function passedMatchdays(md: MatchdayState): Matchday[] {
  return md.current ? md.matchdays.filter((m) => m.number <= md.current!.number) : [];
}

function fixtureLabelFor(matchday: Matchday, teamId: string): string | null {
  const f = matchday.fixtures.find((x) => x.homeTeamId === teamId || x.awayTeamId === teamId);
  if (!f) return null;
  return f.homeTeamId === teamId ? `v ${f.awayShort ?? "TBD"}` : `v ${f.homeShort ?? "TBD"}`;
}

const toEnginePlayer = (p: Player): EnginePlayer => ({
  id: p.id,
  team_id: p.teamId,
  display_name: p.displayName,
  position: p.position,
  price_tenths: p.priceTenths,
  status: p.status,
});

/**
 * One manager's score for one matchday. A finalised matchday uses the stored
 * score. Otherwise it's worked out now from the latest match stats, so points
 * move as goals go in without waiting for an admin to recalculate.
 */
async function scoreFor(managerRowId: string, matchday: Matchday) {
  const [rows, rules, players, stats, supabase] = await Promise.all([
    getPointsRows(),
    getRulesRow(),
    getPlayers(),
    getMatchdayStats(),
    createClient(),
  ]);
  const stored = rows.find((r) => r.manager_id === managerRowId && r.matchday_id === matchday.id);
  const picks = await getPicksFor(managerRowId, matchday.number);
  if (picks.length === 0) return null;

  const [transfers, chips] = await Promise.all([
    supabase.from("transfers").select("points_cost").eq("manager_id", managerRowId).eq("matchday_id", matchday.id),
    supabase.from("chips").select("chip_type").eq("manager_id", managerRowId).eq("matchday_id", matchday.id),
  ]);
  const wildcardPlayed = (chips.data ?? []).some((c) => c.chip_type === "wildcard");

  if (stored && (!stored.is_provisional || matchday.status === "finalised")) {
    return { picks, stored, wildcardPlayed, breakdown: stored.breakdown as unknown as ReturnType<typeof calculateManagerMatchdayScore>["breakdown"], gross: stored.gross_points, cost: stored.transfer_cost, provisional: stored.is_provisional };
  }
  const transferCost = (transfers.data ?? []).reduce((s, t) => s + t.points_cost, 0);
  const result = calculateManagerMatchdayScore({
    picks: picks.map<PickInput>((p) => ({
      player_id: p.player_id,
      is_starter: p.is_starter,
      bench_order: p.bench_order,
      is_captain: p.is_captain,
      is_vice_captain: p.is_vice_captain,
    })),
    players: players.map(toEnginePlayer),
    statsRows: stats.get(matchday.id) ?? [],
    rules: rules as EngineRules,
    transferCost,
  });
  return {
    picks,
    stored,
    wildcardPlayed,
    breakdown: result.breakdown,
    gross: result.gross_points,
    cost: result.transfer_cost,
    provisional: true,
  };
}

export async function getManagerPoints(
  user: FantasyUser,
  managerId: string,
  matchdayNumber: number,
): Promise<ManagerMatchdayPoints | null> {
  void user;
  const [mgr, md, players, rows, managers] = await Promise.all([
    getManagerRow(managerId),
    getMatchdayState(),
    getPlayers(),
    getPointsRows(),
    getAllManagers(),
  ]);
  const matchday = passedMatchdays(md).find((m) => m.number === matchdayNumber);
  if (!mgr || !matchday) return null;
  const score = await scoreFor(mgr.id, matchday);
  if (!score) return null;

  const byId = new Map(players.map((p) => [p.id, p]));
  const slotOf = new Map(orderPicks(score.picks, (id) => byId.get(id)?.position).map((p, i) => [p.player_id, i + 1]));
  const pickOf = new Map(score.picks.map((p) => [p.player_id, p]));

  const playerPoints: PlayerPoints[] = score.breakdown
    .map((b) => {
      const p = byId.get(b.player_id);
      const pick = pickOf.get(b.player_id);
      return {
        playerId: b.player_id,
        displayName: p?.displayName ?? "Player",
        position: p?.position ?? "MID",
        teamShort: p?.teamShort ?? "?",
        slot: slotOf.get(b.player_id) ?? 99,
        multiplier: b.multiplier,
        isCaptain: pick?.is_captain ?? false,
        isViceCaptain: pick?.is_vice_captain ?? false,
        autoSubIn: b.subbed_in,
        autoSubOut: b.subbed_out,
        minutes: b.played_minutes,
        fixtureLabel: p ? fixtureLabelFor(matchday, p.teamId) : null,
        items: b.items,
        basePoints: b.base_points,
        totalPoints: b.applied_points,
      };
    })
    .sort((a, b) => a.slot - b.slot);

  const mdRows = rows.filter((r) => r.matchday_id === matchday.id);
  const latestScored = Math.max(
    ...rows.map((r) => md.matchdays.find((m) => m.id === r.matchday_id)?.number ?? 0),
    0,
  );
  return {
    managerId,
    teamName: mgr.team_name,
    matchdayId: matchday.id,
    matchdayNumber: matchday.number,
    pointsBeforeCost: score.gross,
    transferCost: score.cost,
    total: score.gross - score.cost,
    provisional: score.provisional,
    wildcardPlayed: score.wildcardPlayed,
    averagePoints: mdRows.length ? Math.round(mdRows.reduce((s, r) => s + r.net_points, 0) / mdRows.length) : null,
    highestPoints: mdRows.length ? Math.max(...mdRows.map((r) => r.net_points)) : null,
    overallRank:
      matchday.number === latestScored ? (managers.find((m) => m.id === mgr.id)?.overall_rank ?? null) : null,
    previousOverallRank: null,
    players: playerPoints,
  };
}

export async function getMatchdayHistory(user: FantasyUser, managerId: string): Promise<MatchdayHistoryRow[]> {
  void user;
  const [mgr, md] = await Promise.all([getManagerRow(managerId), getMatchdayState()]);
  if (!mgr) return [];
  const history: MatchdayHistoryRow[] = [];
  for (const m of passedMatchdays(md)) {
    const score = await scoreFor(mgr.id, m);
    if (!score) continue;
    history.push({
      matchdayNumber: m.number,
      points: score.gross - score.cost,
      transferCost: score.cost,
      overallRank: null,
      provisional: score.provisional,
    });
  }
  return history;
}

// ===========================================================================
// Rankings and leagues
// ===========================================================================

function rankRows(rows: Omit<RankingRow, "rank">[]): RankingRow[] {
  const sorted = [...rows].sort((a, b) => b.totalPoints - a.totalPoints || a.teamName.localeCompare(b.teamName));
  let rank = 0;
  return sorted.map((row, i) => {
    if (i === 0 || row.totalPoints !== sorted[i - 1].totalPoints) rank = i + 1;
    return { ...row, rank };
  });
}

/** Ranking rows for every manager, from the totals the scoring job stores. */
const getRankingRows = cache(async (): Promise<{ rows: Omit<RankingRow, "rank">[]; byRowId: Map<string, string>; provisional: boolean }> => {
  const [managers, rows, md] = await Promise.all([getAllManagers(), getPointsRows(), getMatchdayState()]);
  const numberOf = new Map(md.matchdays.map((m) => [m.id, m.number]));
  const latest = rows.reduce((best, r) => Math.max(best, numberOf.get(r.matchday_id) ?? 0), 0);
  const lastPoints = new Map(rows.filter((r) => numberOf.get(r.matchday_id) === latest).map((r) => [r.manager_id, r.net_points]));
  return {
    rows: managers.map((m) => ({
      managerId: m.user_id,
      teamName: m.team_name,
      managerName: m.managerName,
      yearGroup: m.year_group,
      totalPoints: m.total_points,
      lastMatchdayPoints: lastPoints.get(m.id) ?? 0,
    })),
    byRowId: new Map(managers.map((m) => [m.id, m.user_id])),
    provisional: rows.some((r) => r.is_provisional),
  };
});

export async function getRankings(
  user: FantasyUser | null,
  scope: RankingScope,
  page = 1,
  pageSize = 50,
): Promise<RankingPage> {
  const { rows, provisional } = await getRankingRows();
  const scoped = scope.kind === "year" ? rows.filter((r) => r.yearGroup === scope.year) : rows;
  const ranked = rankRows(scoped);
  const safePage = Math.max(1, page);
  return {
    rows: ranked.slice((safePage - 1) * pageSize, safePage * pageSize),
    page: safePage,
    pageSize,
    totalManagers: ranked.length,
    me: user ? (ranked.find((r) => r.managerId === user.id) ?? null) : null,
    provisional,
  };
}

/** The caller's leagues with every member's managers.id (RLS: members only). */
async function loadLeagues(mgr: ManagerRow, onlyId?: string) {
  const supabase = await createClient();
  const mine = await supabase.from("league_members").select("league_id").eq("manager_id", mgr.id);
  if (mine.error) fail(mine.error.message, "your leagues");
  const ids = mine.data.map((m) => m.league_id).filter((id) => !onlyId || id === onlyId);
  if (ids.length === 0) return [];
  const [leagues, members] = await Promise.all([
    supabase.from("leagues").select("id, name, invite_code, created_by, created_at").in("id", ids).order("created_at"),
    supabase.from("league_members").select("league_id, manager_id").in("league_id", ids),
  ]);
  if (leagues.error) fail(leagues.error.message, "your leagues");
  if (members.error) fail(members.error.message, "league members");
  return leagues.data.map((l) => ({ ...l, memberRowIds: members.data.filter((m) => m.league_id === l.id).map((m) => m.manager_id) }));
}

async function standingsFor(user: FantasyUser, mgr: ManagerRow, league: Awaited<ReturnType<typeof loadLeagues>>[number]) {
  const { rows, byRowId, provisional } = await getRankingRows();
  const members = new Set(league.memberRowIds.map((id) => byRowId.get(id)));
  const ranked = rankRows(rows.filter((r) => members.has(r.managerId)));
  const summary: League = {
    id: league.id,
    name: league.name,
    code: league.invite_code,
    memberCount: league.memberRowIds.length,
    isOwner: league.created_by === mgr.id,
    myRank: ranked.find((r) => r.managerId === user.id)?.rank ?? null,
  };
  return { league: summary, rows: ranked, provisional };
}

export async function getMyLeagues(user: FantasyUser): Promise<League[]> {
  const mgr = await getManagerRow(user.id);
  if (!mgr) return [];
  const leagues = await loadLeagues(mgr);
  return Promise.all(leagues.map(async (l) => (await standingsFor(user, mgr, l)).league));
}

export async function getLeagueStandings(user: FantasyUser, leagueId: string): Promise<LeagueStandings | null> {
  const mgr = await getManagerRow(user.id);
  if (!mgr || !/^[0-9a-f-]{36}$/i.test(leagueId)) return null;
  const [league] = await loadLeagues(mgr, leagueId);
  if (!league) return null;
  return standingsFor(user, mgr, league);
}

// ===========================================================================
// Writes. Call these from Server Actions only. The database checks every rule.
// ===========================================================================

type RpcError = { message: string } | null;

function rpcFailure(error: RpcError): { ok: false; error: ReturnType<typeof parseRpcError> } {
  if (error && !/^[A-Z_]+:/.test(error.message)) console.error("[fantasy] unexpected RPC error:", error.message);
  return { ok: false, error: parseRpcError(error?.message) };
}

export async function createManager(
  user: FantasyUser,
  input: { teamName: string; yearGroup: number | null },
): Promise<ActionResult<Manager>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_manager", {
    p_team_name: input.teamName.trim().replace(/\s+/g, " "),
    ...(input.yearGroup !== null ? { p_year_group: input.yearGroup } : {}),
  });
  if (error || !data) return rpcFailure(error);
  return {
    ok: true,
    data: { id: user.id, teamName: data.team_name, managerName: user.name, yearGroup: input.yearGroup, createdAt: data.created_at },
  };
}

export async function saveSquad(user: FantasyUser, input: { playerIds: string[] }): Promise<ActionResult<null>> {
  void user;
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_squad", { p_player_ids: input.playerIds });
  if (error) return rpcFailure(error);
  return { ok: true, data: null };
}

export async function saveLineup(user: FantasyUser, input: LineupInput): Promise<ActionResult<null>> {
  void user;
  const picks = [
    ...input.starters.map((id) => ({
      player_id: id,
      is_starter: true,
      bench_order: null,
      is_captain: id === input.captainId,
      is_vice_captain: id === input.viceCaptainId,
    })),
    ...input.bench.map((id, i) => ({
      player_id: id,
      is_starter: false,
      bench_order: i + 1,
      is_captain: false,
      is_vice_captain: false,
    })),
  ];
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_lineup", { p_picks: picks });
  if (error) return rpcFailure(error);
  return { ok: true, data: null };
}

export async function makeTransfers(user: FantasyUser, input: TransferInput): Promise<ActionResult<TransferState>> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("make_transfers", { p_out_ids: input.out, p_in_ids: input.in });
  if (error) return rpcFailure(error);
  const state = await getTransferState(user);
  if (!state) return { ok: false, error: fantasyError("DEADLINE_PASSED") };
  return { ok: true, data: state };
}

export async function activateWildcard(user: FantasyUser): Promise<ActionResult<null>> {
  void user;
  const supabase = await createClient();
  const { error } = await supabase.rpc("activate_wildcard");
  if (error) return rpcFailure(error);
  return { ok: true, data: null };
}

export async function createLeague(user: FantasyUser, input: { name: string }): Promise<ActionResult<League>> {
  void user;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_league", { p_name: input.name.trim().replace(/\s+/g, " ") });
  if (error || !data) return rpcFailure(error);
  const league = data as { id: string; name: string; invite_code: string };
  return { ok: true, data: { id: league.id, name: league.name, code: league.invite_code, memberCount: 1, isOwner: true, myRank: 1 } };
}

export async function joinLeague(user: FantasyUser, input: { code: string }): Promise<ActionResult<League>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_league", { p_code: input.code });
  if (error || !data) return rpcFailure(error);
  const { leagueId } = data as { leagueId: string; leagueName: string };
  const standings = await getLeagueStandings(user, leagueId);
  if (!standings) return { ok: false, error: fantasyError("LEAGUE_NOT_FOUND") };
  return { ok: true, data: standings.league };
}
