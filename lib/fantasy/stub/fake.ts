import "server-only";
// STUB: realistic fake data for everything Mary's backend will calculate.
// Nothing here is the real scoring engine: the numbers are made up so the
// screens have something to show. Delete this file when the backend is live.

import type {
  FantasyRules,
  Matchday,
  ManagerMatchdayPoints,
  Player,
  PlayerPoints,
  PointsItem,
  RankingRow,
  ScoringKey,
} from "../types";
import { hash } from "./store";

// ---------------------------------------------------------------------------
// Default lineup after the first squad save (the backend will do this, §3.2)
// ---------------------------------------------------------------------------

export function defaultLineup(squad: Player[]) {
  const byPrice = (a: Player, b: Player) => b.priceTenths - a.priceTenths || a.displayName.localeCompare(b.displayName);
  const of = (pos: Player["position"]) => squad.filter((p) => p.position === pos).sort(byPrice);
  const gk = of("GK");
  const def = of("DEF");
  const mid = of("MID");
  const fwd = of("FWD");
  const starters = [gk[0], ...def.slice(0, 4), ...mid.slice(0, 4), ...fwd.slice(0, 2)].filter(Boolean);
  const bench = [gk[1], ...[def[4], mid[4], fwd[2]].filter(Boolean).sort(byPrice)].filter(Boolean);
  const ranked = [...starters].sort(byPrice);
  return {
    order: [...starters, ...bench].map((p) => p.id),
    captain: ranked[0]?.id,
    vice: ranked[1]?.id,
  };
}

// ---------------------------------------------------------------------------
// Fake player points for one matchday
// ---------------------------------------------------------------------------

type FakeStats = Partial<Record<ScoringKey, number>> & { minutes: number };

function fakeStats(player: Player, md: number, plays: boolean): FakeStats {
  if (!plays) return { minutes: 0 };
  const h = hash(`${player.id}:${md}`);
  const roll = h % 100;
  const minutes = roll < 12 ? 0 : roll < 25 ? 20 : 50;
  if (minutes === 0) return { minutes };
  const goalChance = { GK: 0, DEF: 8, MID: 18, FWD: 30 }[player.position];
  const goals = (h >> 7) % 100 < goalChance ? 1 + (((h >> 14) % 100) < 15 ? 1 : 0) : 0;
  const assists = (h >> 9) % 100 < 18 ? 1 : 0;
  const conceded = (h >> 11) % 4;
  const s: FakeStats = { minutes, appeared: 1 };
  if (minutes >= 30) s.played_30 = 1;
  if (goals) s.goal = goals;
  if (assists) s.assist = assists;
  if (conceded === 0 && minutes >= 30) s.clean_sheet = 1;
  if (conceded >= 2) s.goals_conceded_2 = Math.floor(conceded / 2);
  if ((h >> 13) % 100 < 10) s.yellow_card = 1;
  if ((h >> 17) % 100 < 4) s.man_of_the_match = 1;
  if (player.position === "GK" && (h >> 19) % 100 < 6) s.penalty_saved = 1;
  return s;
}

function teamFixture(player: Player, matchday: Matchday | undefined) {
  const f = matchday?.fixtures.find((x) => x.homeTeamId === player.teamId || x.awayTeamId === player.teamId);
  return f ? `${f.homeShort ?? "TBD"} v ${f.awayShort ?? "TBD"}` : null;
}

export function fakePlayerPoints(
  player: Player,
  slot: number,
  md: number,
  matchday: Matchday | undefined,
  rules: FantasyRules,
  captain: boolean,
  vice: boolean,
): PlayerPoints {
  const fixtureLabel = teamFixture(player, matchday);
  const stats = fakeStats(player, md, fixtureLabel !== null);
  const items: PointsItem[] = [];
  for (const rule of rules.scoring) {
    const count = stats[rule.key] ?? 0;
    const points = count * rule.points[player.position];
    if (count && points) items.push({ key: rule.key, label: rule.label, count, points });
  }
  const basePoints = items.reduce((s, i) => s + i.points, 0);
  const multiplier = slot > rules.startingSize ? 0 : captain ? rules.captainMultiplier : 1;
  return {
    playerId: player.id,
    displayName: player.displayName,
    position: player.position,
    teamShort: player.teamShort,
    slot,
    multiplier,
    isCaptain: captain,
    isViceCaptain: vice,
    autoSubIn: false,
    autoSubOut: false,
    minutes: stats.minutes,
    fixtureLabel,
    items,
    basePoints,
    totalPoints: basePoints * multiplier,
  };
}

export function fakeManagerPoints(args: {
  managerId: string;
  teamName: string;
  squad: Player[];
  captainId: string | undefined;
  viceId: string | undefined;
  matchday: Matchday;
  rules: FantasyRules;
  transferCost: number;
  wildcardPlayed: boolean;
}): ManagerMatchdayPoints {
  const { squad, matchday, rules } = args;
  const players = squad.map((p, i) =>
    fakePlayerPoints(p, i + 1, matchday.number, matchday, rules, p.id === args.captainId, p.id === args.viceId),
  );
  const pointsBeforeCost = players.reduce((s, p) => s + p.totalPoints, 0);
  return {
    managerId: args.managerId,
    teamName: args.teamName,
    matchdayId: matchday.id,
    matchdayNumber: matchday.number,
    pointsBeforeCost,
    transferCost: args.transferCost,
    total: pointsBeforeCost - args.transferCost,
    provisional: matchday.status !== "finalised",
    wildcardPlayed: args.wildcardPlayed,
    players,
  };
}

// ---------------------------------------------------------------------------
// Fake managers for rankings and leagues
// ---------------------------------------------------------------------------

const FIRST = ["Tobi", "Ada", "Chidi", "Funmi", "Kunle", "Ngozi", "Seun", "Bisi", "Emeka", "Tolu", "Ife", "Dayo", "Zainab", "Femi", "Kemi", "Uche", "Yemi", "Halima", "Segun", "Amaka"];
const LAST = ["A.", "B.", "O.", "E.", "K.", "N.", "S.", "T.", "M.", "I."];
const WORD1 = ["Volt", "Ohm's", "Circuit", "Diode", "Ampere", "Watt", "Resistor", "Signal", "Capacitor", "Transistor", "Akoka", "Lagoon", "Faraday", "Tesla", "Kirchhoff"];
const WORD2 = ["Rangers", "United", "FC", "Breakers", "Warriors", "Eagles", "Stars", "XI", "Athletic", "Galacticos", "Lions", "City"];

export type FakeManager = { id: string; teamName: string; managerName: string; yearGroup: number | null };

export const FAKE_MANAGERS: FakeManager[] = Array.from({ length: 137 }, (_, i) => {
  const h = hash(`manager-${i}`);
  return {
    id: `00000000-0000-4000-8000-5${String(i).padStart(11, "0")}`,
    teamName: `${WORD1[h % WORD1.length]} ${WORD2[(h >> 5) % WORD2.length]}${i > 60 ? ` ${(i % 9) + 2}` : ""}`,
    managerName: `${FIRST[(h >> 9) % FIRST.length]} ${LAST[(h >> 13) % LAST.length]}`,
    yearGroup: (h >> 17) % 6 === 0 ? null : ((h >> 17) % 5) + 1,
  };
});

export function fakeMatchdayScore(managerId: string, md: number) {
  return 22 + (hash(`${managerId}:md${md}`) % 54);
}

/** Sort by points, then team name, and share ranks on ties (1, 2, 2, 4). */
export function rankRows(rows: Omit<RankingRow, "rank">[]): RankingRow[] {
  const sorted = [...rows].sort((a, b) => b.totalPoints - a.totalPoints || a.teamName.localeCompare(b.teamName));
  let rank = 0;
  return sorted.map((row, i) => {
    if (i === 0 || row.totalPoints !== sorted[i - 1].totalPoints) rank = i + 1;
    return { ...row, rank };
  });
}
