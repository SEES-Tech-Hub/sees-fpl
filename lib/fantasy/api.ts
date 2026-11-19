import "server-only";
// Owner: Henry. The ONLY place the fantasy screens talk to the backend.
// Contract: docs/fantasy-backend-contract.md. Types: lib/fantasy/types.ts.
//
// Real today: teams, players, matchdays and fixtures (base schema).
// Everything else is marked `// STUB: replace with Mary's RPC` and keeps its
// state in a cookie (lib/fantasy/stub/store.ts) so the preview is clickable.
// When one of Mary's functions lands, replace that one function body here.

import { cache } from "react";
import { connection } from "next/server";
import { getCurrentUser, requireSignedIn } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fantasyError } from "./errors";
import { defaultLineup, FAKE_MANAGERS, fakeManagerPoints, fakeMatchdayScore, rankRows } from "./stub/fake";
import { STUB_MATCHDAYS, STUB_PLAYERS, STUB_TEAMS } from "./stub/reference";
import { STUB_RULES } from "./stub/rules";
import { hash, readStub, writeStub, type StubState } from "./stub/store";
import { formationIssue, squadIssues } from "./validate";
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
  Player,
  RankingPage,
  RankingRow,
  RankingScope,
  Team,
  TransferInput,
  TransferRecord,
  TransferState,
} from "./types";

/** Flip to true when Mary's backend is wired in; hides the "sample data" banner. */
export const FANTASY_BACKEND_LIVE = false;

/**
 * Without Supabase env vars, or with FANTASY_LOCAL_STUB=1 (local testing with
 * dummy Supabase values, so proxy.ts can start), use stub reference data and
 * a stub user too. Never set FANTASY_LOCAL_STUB on Vercel.
 */
const HAS_SUPABASE =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) &&
  process.env.FANTASY_LOCAL_STUB !== "1";

export const usingStubReferenceData = !HAS_SUPABASE;

// ===========================================================================
// Who is calling
// ===========================================================================

export type FantasyUser = { id: string; name: string; yearGroup: number | null };

const STUB_USER: FantasyUser = { id: "local-stub-user", name: "Local tester", yearGroup: null };

/** For signed-in pages: sends signed-out visitors to /login and back. */
export async function requireFantasyUser(nextPath: string): Promise<FantasyUser> {
  if (!HAS_SUPABASE) {
    // Local dev without .env.local only. Production always has the env vars.
    await connection();
    return STUB_USER;
  }
  const { profile } = await requireSignedIn(nextPath);
  return { id: profile.id, name: profile.display_name ?? "Manager", yearGroup: profile.year_group };
}

/** For public pages (rankings, rules): the user if signed in, else null. */
export async function getOptionalFantasyUser(): Promise<FantasyUser | null> {
  await connection();
  if (!HAS_SUPABASE) return STUB_USER;
  const current = await getCurrentUser();
  if (!current) return null;
  const { profile } = current;
  return { id: profile.id, name: profile.display_name ?? "Manager", yearGroup: profile.year_group };
}

// ===========================================================================
// Reads: reference data (real)
// ===========================================================================

export const getFantasyRules = cache(async (): Promise<FantasyRules> => {
  // STUB: replace with Mary's RPC (rules config table, contract §2.1).
  return STUB_RULES;
});

export const getTeams = cache(async (): Promise<Team[]> => {
  if (!HAS_SUPABASE) return STUB_TEAMS;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .select("id, year, name, short_name, class_label")
    .order("year");
  if (error) throw new Error(`Couldn't load teams: ${error.message}`);
  return data.map((t) => ({ id: t.id, year: t.year, name: t.name, shortName: t.short_name, classLabel: t.class_label }));
});

export const getPlayers = cache(async (): Promise<Player[]> => {
  if (!HAS_SUPABASE) return STUB_PLAYERS;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .select("id, team_id, full_name, display_name, position, price_tenths, status, shirt_number, teams(year, short_name)")
    .order("display_name");
  if (error) throw new Error(`Couldn't load players: ${error.message}`);
  return data.map((p) => ({
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
    // STUB: replace with Mary's RPC (player_fantasy_stats view, contract §2.2).
    totalPoints: 0,
    selectedByPct: 0,
  }));
});

export const getMatchdayState = cache(async (): Promise<MatchdayState> => {
  await connection();
  let matchdays: Matchday[];
  if (!HAS_SUPABASE) {
    matchdays = STUB_MATCHDAYS;
  } else {
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
    if (mds.error) throw new Error(`Couldn't load matchdays: ${mds.error.message}`);
    if (fx.error) throw new Error(`Couldn't load fixtures: ${fx.error.message}`);
    matchdays = mds.data.map((m) => ({
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
  }
  const now = Date.now();
  const passed = (m: Matchday) => m.deadlineAt !== null && new Date(m.deadlineAt).getTime() <= now;
  const next = matchdays.find((m) => m.deadlineAt !== null && !passed(m) && m.status !== "finalised") ?? null;
  const current = [...matchdays].reverse().find(passed) ?? null;
  return { matchdays, next, current };
});

// ===========================================================================
// Reads: the manager (STUB)
// ===========================================================================

async function stubFor(user: FantasyUser) {
  return readStub(user.id);
}

function playersById(players: Player[]) {
  return new Map(players.map((p) => [p.id, p]));
}

/** The stub squad as players, or null if missing or out of date. */
function stubSquad(state: StubState, players: Player[]): Player[] | null {
  if (!state.squad || state.squad.length !== 15) return null;
  const byId = playersById(players);
  const squad = state.squad.map((id) => byId.get(id));
  return squad.every(Boolean) ? (squad as Player[]) : null;
}

export async function getMyManager(user: FantasyUser): Promise<Manager | null> {
  // STUB: replace with Mary's RPC (managers table, contract §2.4).
  const state = await stubFor(user);
  if (!state.manager) return null;
  return {
    id: user.id,
    teamName: state.manager.teamName,
    managerName: user.name,
    yearGroup: state.manager.yearGroup,
    createdAt: state.manager.createdAt,
  };
}

export async function getMyTeam(user: FantasyUser): Promise<MyTeam | null> {
  // STUB: replace with Mary's RPC (squad_players / picks, contract §2.5).
  const [state, players, rules, md] = await Promise.all([stubFor(user), getPlayers(), getFantasyRules(), getMatchdayState()]);
  const squad = stubSquad(state, players);
  if (!squad) return null;
  const value = squad.reduce((s, p) => s + p.priceTenths, 0);
  const target = md.next ?? md.current;
  return {
    matchdayId: target?.id ?? "",
    matchdayNumber: target?.number ?? 0,
    picks: squad.map((p, i) => ({
      playerId: p.id,
      slot: i + 1,
      isCaptain: p.id === state.captain,
      isViceCaptain: p.id === state.vice,
    })),
    bankTenths: rules.budgetTenths - value,
    squadValueTenths: value,
    locked: md.next === null,
  };
}

function stubTransferState(state: StubState, md: MatchdayState, rules: FantasyRules, bank: number): TransferState | null {
  const target = md.next;
  if (!target) return null;
  const t = state.transfers?.md === target.number ? state.transfers : { md: target.number, made: 0, cost: 0 };
  const wildcardActive = state.wildcardMd === target.number;
  const unlimited =
    md.current === null || rules.unlimitedTransferMatchdays.includes(target.number) || wildcardActive;
  return {
    matchdayId: target.id,
    matchdayNumber: target.number,
    freeTransfers: unlimited ? null : Math.max(0, rules.freeTransfersPerMatchday - t.made),
    made: t.made,
    costPoints: t.cost,
    bankTenths: bank,
    wildcard: {
      available: state.wildcardMd === undefined,
      activeThisMatchday: wildcardActive,
      usedOnMatchday: state.wildcardMd ?? null,
    },
    locked: false,
  };
}

export async function getTransferState(user: FantasyUser): Promise<TransferState | null> {
  // STUB: replace with Mary's RPC (transfers, chips, contract §2.6).
  const [state, md, rules, team] = await Promise.all([stubFor(user), getMatchdayState(), getFantasyRules(), getMyTeam(user)]);
  if (!team) return null;
  return stubTransferState(state, md, rules, team.bankTenths);
}

export async function getTransferHistory(user: FantasyUser): Promise<TransferRecord[]> {
  // STUB: replace with Mary's RPC (transfers table, contract §2.6). The stub keeps no history.
  void user;
  return [];
}

// ===========================================================================
// Reads: points, rankings, leagues (STUB)
// ===========================================================================

/**
 * STUB helper: the matchdays that "have points". Real: matchdays whose
 * deadline has passed. Before MD1 locks, the stub shows MD1 as a sample so
 * the breakdown screen can be tested.
 */
async function stubPointsMatchdays(): Promise<Matchday[]> {
  const md = await getMatchdayState();
  const passed = md.matchdays.filter((m) => m.deadlineAt && md.current && m.number <= md.current.number);
  return passed.length ? passed : md.matchdays.slice(0, 1);
}

export async function getManagerPoints(
  user: FantasyUser,
  managerId: string,
  matchdayNumber: number,
): Promise<ManagerMatchdayPoints | null> {
  // STUB: replace with Mary's RPC (manager_matchday_points + player_matchday_points, contract §2.7).
  const [mds, players, rules] = await Promise.all([stubPointsMatchdays(), getPlayers(), getFantasyRules()]);
  const matchday = mds.find((m) => m.number === matchdayNumber);
  if (!matchday) return null;

  if (managerId === user.id) {
    const state = await stubFor(user);
    const squad = stubSquad(state, players);
    if (!squad || !state.manager) return null;
    const cost = state.transfers?.md === matchdayNumber ? state.transfers.cost : 0;
    return fakeManagerPoints({
      managerId,
      teamName: state.manager.teamName,
      squad,
      captainId: state.captain,
      viceId: state.vice,
      matchday,
      rules,
      transferCost: cost,
      wildcardPlayed: state.wildcardMd === matchdayNumber,
    });
  }

  const other = FAKE_MANAGERS.find((m) => m.id === managerId);
  if (!other) return null;
  // A made-up but valid squad for another manager.
  const pool = [...players].sort((a, b) => hash(`${managerId}${a.id}`) - hash(`${managerId}${b.id}`));
  const pick = (pos: Player["position"], n: number) => pool.filter((p) => p.position === pos).slice(0, n);
  const squad = [...pick("GK", 2), ...pick("DEF", 5), ...pick("MID", 5), ...pick("FWD", 3)];
  const lineup = defaultLineup(squad);
  const byId = playersById(squad);
  return fakeManagerPoints({
    managerId,
    teamName: other.teamName,
    squad: lineup.order.map((id) => byId.get(id)!),
    captainId: lineup.captain,
    viceId: lineup.vice,
    matchday,
    rules,
    transferCost: hash(managerId) % 7 === 0 ? 4 : 0,
    wildcardPlayed: false,
  });
}

export async function getMatchdayHistory(user: FantasyUser, managerId: string): Promise<MatchdayHistoryRow[]> {
  // STUB: replace with Mary's RPC (manager_matchday_points, contract §2.8).
  const mds = await stubPointsMatchdays();
  const rows: MatchdayHistoryRow[] = [];
  for (const m of mds) {
    const pts = await getManagerPoints(user, managerId, m.number);
    if (!pts) continue;
    rows.push({
      matchdayNumber: m.number,
      points: pts.total,
      transferCost: pts.transferCost,
      overallRank: null,
      provisional: pts.provisional,
    });
  }
  return rows;
}

/** STUB helper: every manager's ranking row, including the caller if they've joined. */
async function stubAllRankingRows(user: FantasyUser | null): Promise<Omit<RankingRow, "rank">[]> {
  const mds = await stubPointsMatchdays();
  const last = mds[mds.length - 1]?.number ?? 1;
  const rows: Omit<RankingRow, "rank">[] = FAKE_MANAGERS.map((m) => ({
    managerId: m.id,
    teamName: m.teamName,
    managerName: m.managerName,
    yearGroup: m.yearGroup,
    totalPoints: mds.reduce((s, md) => s + fakeMatchdayScore(m.id, md.number), 0),
    lastMatchdayPoints: fakeMatchdayScore(m.id, last),
  }));
  if (user) {
    const manager = await getMyManager(user);
    if (manager) {
      const history = await getMatchdayHistory(user, user.id);
      rows.push({
        managerId: user.id,
        teamName: manager.teamName,
        managerName: manager.managerName,
        yearGroup: manager.yearGroup,
        totalPoints: history.reduce((s, h) => s + h.points, 0),
        lastMatchdayPoints: history[history.length - 1]?.points ?? 0,
      });
    }
  }
  return rows;
}

export async function getRankings(
  user: FantasyUser | null,
  scope: RankingScope,
  page = 1,
  pageSize = 50,
): Promise<RankingPage> {
  // STUB: replace with Mary's RPC (manager_rankings view, contract §2.9).
  const all = await stubAllRankingRows(user);
  const scoped = scope.kind === "year" ? all.filter((r) => r.yearGroup === scope.year) : all;
  const ranked = rankRows(scoped);
  const safePage = Math.max(1, page);
  return {
    rows: ranked.slice((safePage - 1) * pageSize, safePage * pageSize),
    page: safePage,
    pageSize,
    totalManagers: ranked.length,
    me: user ? (ranked.find((r) => r.managerId === user.id) ?? null) : null,
    provisional: true,
  };
}

const STUB_PUBLIC_LEAGUE = { id: "00000000-0000-4000-8000-600000000001", name: "SEES Games 2026", code: "SEES26" };

function stubLeagueMembers(leagueId: string) {
  if (leagueId === STUB_PUBLIC_LEAGUE.id) return FAKE_MANAGERS;
  const n = 3 + (hash(leagueId) % 9);
  return [...FAKE_MANAGERS].sort((a, b) => hash(leagueId + a.id) - hash(leagueId + b.id)).slice(0, n);
}

export async function getMyLeagues(user: FantasyUser): Promise<League[]> {
  // STUB: replace with Mary's RPC (leagues, league_members, contract §2.10).
  const state = await stubFor(user);
  const leagues = state.leagues ?? [];
  return Promise.all(
    leagues.map(async (l) => {
      const standings = await getLeagueStandings(user, l.id);
      return standings?.league ?? { id: l.id, name: l.name, code: l.code, memberCount: 1, isOwner: l.owner, myRank: null };
    }),
  );
}

export async function getLeagueStandings(user: FantasyUser, leagueId: string): Promise<LeagueStandings | null> {
  // STUB: replace with Mary's RPC (leagues + manager_rankings, contract §2.10).
  const state = await stubFor(user);
  const mine = state.leagues?.find((l) => l.id === leagueId);
  if (!mine) return null;
  const memberIds = new Set([user.id, ...stubLeagueMembers(leagueId).map((m) => m.id)]);
  const rows = rankRows((await stubAllRankingRows(user)).filter((r) => memberIds.has(r.managerId)));
  return {
    league: {
      id: mine.id,
      name: mine.name,
      code: mine.code,
      memberCount: rows.length,
      isOwner: mine.owner,
      myRank: rows.find((r) => r.managerId === user.id)?.rank ?? null,
    },
    rows,
    provisional: true,
  };
}

// ===========================================================================
// Writes (STUB). Call these from Server Actions only.
// Each stub re-checks the rules so the UI's error paths can be tested; the
// real checks are Mary's (contract §3).
// ===========================================================================

async function openMatchday(): Promise<ActionResult<Matchday>> {
  const md = await getMatchdayState();
  if (!md.next) return { ok: false, error: fantasyError("NO_OPEN_MATCHDAY") };
  return { ok: true, data: md.next };
}

export async function createManager(
  user: FantasyUser,
  input: { teamName: string; yearGroup: number | null },
): Promise<ActionResult<Manager>> {
  // STUB: replace with Mary's RPC create_manager (contract §3.1).
  const rules = await getFantasyRules();
  const state = await stubFor(user);
  if (state.manager) return { ok: false, error: fantasyError("MANAGER_EXISTS") };
  const teamName = input.teamName.trim().replace(/\s+/g, " ");
  if (teamName.length < 3 || teamName.length > rules.teamNameMaxLength) {
    return {
      ok: false,
      error: fantasyError("TEAM_NAME_INVALID", `Team names need 3 to ${rules.teamNameMaxLength} characters.`),
    };
  }
  if (input.yearGroup !== null && !(input.yearGroup >= 1 && input.yearGroup <= 5)) {
    return { ok: false, error: fantasyError("YEAR_GROUP_INVALID") };
  }
  const createdAt = new Date().toISOString();
  await writeStub({ ...state, manager: { teamName, yearGroup: input.yearGroup, createdAt } });
  return {
    ok: true,
    data: { id: user.id, teamName, managerName: user.name, yearGroup: input.yearGroup, createdAt },
  };
}

export async function saveSquad(user: FantasyUser, input: { playerIds: string[] }): Promise<ActionResult<null>> {
  // STUB: replace with Mary's RPC save_squad (contract §3.2).
  const [state, players, rules, open] = await Promise.all([stubFor(user), getPlayers(), getFantasyRules(), openMatchday()]);
  if (!state.manager) return { ok: false, error: fantasyError("NO_MANAGER") };
  if (stubSquad(state, players)) return { ok: false, error: fantasyError("SQUAD_EXISTS") };
  if (!open.ok) return open;
  const byId = playersById(players);
  const picked = input.playerIds.map((id) => byId.get(id));
  if (picked.some((p) => !p)) return { ok: false, error: fantasyError("PLAYER_UNKNOWN") };
  const squad = picked as Player[];
  const issues = squadIssues(squad, rules);
  const first = issues.find((i) => i.blocking) ?? issues[0];
  if (first) return { ok: false, error: fantasyError(first.code, first.message, first.playerIds) };
  const lineup = defaultLineup(squad);
  await writeStub({ ...state, squad: lineup.order, captain: lineup.captain, vice: lineup.vice });
  return { ok: true, data: null };
}

export async function saveLineup(user: FantasyUser, input: LineupInput): Promise<ActionResult<null>> {
  // STUB: replace with Mary's RPC save_lineup (contract §3.3).
  const [state, players, rules, open] = await Promise.all([stubFor(user), getPlayers(), getFantasyRules(), openMatchday()]);
  if (!open.ok) return { ok: false, error: fantasyError("DEADLINE_PASSED") };
  const squad = stubSquad(state, players);
  if (!squad) return { ok: false, error: fantasyError("NO_SQUAD") };
  const order = [...input.starters, ...input.bench];
  const squadIds = new Set(squad.map((p) => p.id));
  if (order.length !== 15 || new Set(order).size !== 15 || order.some((id) => !squadIds.has(id))) {
    return { ok: false, error: fantasyError("LINEUP_NOT_IN_SQUAD") };
  }
  const byId = playersById(squad);
  const formation = formationIssue(input.starters.map((id) => byId.get(id)!), rules);
  if (formation) return { ok: false, error: fantasyError("FORMATION_INVALID", formation) };
  if (byId.get(input.bench[0])?.position !== "GK") return { ok: false, error: fantasyError("BENCH_GK_INVALID") };
  if (
    input.captainId === input.viceCaptainId ||
    !input.starters.includes(input.captainId) ||
    !input.starters.includes(input.viceCaptainId)
  ) {
    return { ok: false, error: fantasyError("CAPTAIN_INVALID") };
  }
  await writeStub({ ...state, squad: order, captain: input.captainId, vice: input.viceCaptainId });
  return { ok: true, data: null };
}

export async function makeTransfers(user: FantasyUser, input: TransferInput): Promise<ActionResult<TransferState>> {
  // STUB: replace with Mary's RPC make_transfers (contract §3.4).
  const [state, players, rules, md, open] = await Promise.all([
    stubFor(user),
    getPlayers(),
    getFantasyRules(),
    getMatchdayState(),
    openMatchday(),
  ]);
  if (!open.ok) return { ok: false, error: fantasyError("DEADLINE_PASSED") };
  const squad = stubSquad(state, players);
  if (!squad) return { ok: false, error: fantasyError("NO_SQUAD") };
  const byId = playersById(players);
  const squadIds = squad.map((p) => p.id);
  const ins = input.in.map((id) => byId.get(id));
  if (
    input.out.length === 0 ||
    input.out.length !== input.in.length ||
    new Set(input.out).size !== input.out.length ||
    new Set(input.in).size !== input.in.length ||
    input.out.some((id) => !squadIds.includes(id)) ||
    input.in.some((id) => squadIds.includes(id)) ||
    ins.some((p) => !p)
  ) {
    return { ok: false, error: fantasyError("TRANSFER_INVALID") };
  }
  if (input.out.some((id, i) => byId.get(id)!.position !== ins[i]!.position)) {
    return { ok: false, error: fantasyError("TRANSFER_POSITION") };
  }
  const order = squadIds.map((id) => {
    const i = input.out.indexOf(id);
    return i === -1 ? id : input.in[i];
  });
  const newSquad = order.map((id) => byId.get(id)!);
  const blocking = squadIssues(newSquad, rules).find((i) => i.blocking);
  if (blocking) return { ok: false, error: fantasyError(blocking.code, blocking.message, blocking.playerIds) };

  const before = stubTransferState(state, md, rules, 0)!;
  const extra = before.freeTransfers === null ? 0 : Math.max(0, input.out.length - before.freeTransfers);
  const swap = (id: string | undefined) => {
    const i = id ? input.out.indexOf(id) : -1;
    return i === -1 ? id : input.in[i];
  };
  const next: StubState = {
    ...state,
    squad: order,
    captain: swap(state.captain),
    vice: swap(state.vice),
    transfers: {
      md: open.data.number,
      made: before.made + input.out.length,
      cost: before.costPoints + extra * rules.transferHitPoints,
    },
  };
  await writeStub(next);
  const bank = rules.budgetTenths - newSquad.reduce((s, p) => s + p.priceTenths, 0);
  return { ok: true, data: stubTransferState(next, md, rules, bank)! };
}

export async function activateWildcard(user: FantasyUser): Promise<ActionResult<null>> {
  // STUB: replace with Mary's RPC activate_wildcard (contract §3.5).
  const [state, rules, md, open] = await Promise.all([stubFor(user), getFantasyRules(), getMatchdayState(), openMatchday()]);
  if (!open.ok) return { ok: false, error: fantasyError("DEADLINE_PASSED") };
  if (state.wildcardMd !== undefined) return { ok: false, error: fantasyError("WILDCARD_USED") };
  if (md.current === null || rules.unlimitedTransferMatchdays.includes(open.data.number)) {
    // Q7 Version A in the scoring doc; Mary may change this.
    return {
      ok: false,
      error: fantasyError("WILDCARD_NOT_ALLOWED", "Transfers are already free this matchday, so save your Wildcard."),
    };
  }
  const t = state.transfers?.md === open.data.number ? state.transfers : undefined;
  await writeStub({
    ...state,
    wildcardMd: open.data.number,
    // Playing the Wildcard refunds this matchday's transfer costs.
    transfers: t ? { ...t, cost: 0 } : undefined,
  });
  return { ok: true, data: null };
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function createLeague(user: FantasyUser, input: { name: string }): Promise<ActionResult<League>> {
  // STUB: replace with Mary's RPC create_league (contract §3.6).
  const [state, rules] = await Promise.all([stubFor(user), getFantasyRules()]);
  if (!state.manager) return { ok: false, error: fantasyError("NO_MANAGER") };
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 3 || name.length > 30) return { ok: false, error: fantasyError("LEAGUE_NAME_INVALID") };
  const id = crypto.randomUUID();
  const code = Array.from(crypto.getRandomValues(new Uint8Array(rules.leagueCodeLength)))
    .map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length])
    .join("");
  await writeStub({ ...state, leagues: [...(state.leagues ?? []), { id, name, code, owner: true }] });
  return { ok: true, data: { id, name, code, memberCount: 1, isOwner: true, myRank: 1 } };
}

export async function joinLeague(user: FantasyUser, input: { code: string }): Promise<ActionResult<League>> {
  // STUB: replace with Mary's RPC join_league (contract §3.7).
  // The stub knows one league: code SEES26.
  const [state, rules] = await Promise.all([stubFor(user), getFantasyRules()]);
  if (!state.manager) return { ok: false, error: fantasyError("NO_MANAGER") };
  const code = input.code.trim().toUpperCase();
  if (code.length !== rules.leagueCodeLength || [...code].some((c) => !CODE_ALPHABET.includes(c))) {
    return { ok: false, error: fantasyError("LEAGUE_CODE_INVALID") };
  }
  if (state.leagues?.some((l) => l.code === code)) return { ok: false, error: fantasyError("LEAGUE_ALREADY_MEMBER") };
  if (code !== STUB_PUBLIC_LEAGUE.code) return { ok: false, error: fantasyError("LEAGUE_NOT_FOUND") };
  await writeStub({ ...state, leagues: [...(state.leagues ?? []), { ...STUB_PUBLIC_LEAGUE, owner: false }] });
  return {
    ok: true,
    data: { ...STUB_PUBLIC_LEAGUE, memberCount: FAKE_MANAGERS.length + 1, isOwner: false, myRank: null },
  };
}
