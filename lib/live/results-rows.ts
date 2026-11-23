import type { Tables } from "@/lib/supabase/types";
import type {
  EventStandingRow,
  Medal,
  MedalRow,
  MedalTableRow,
  RaceResultRow,
  SetScore,
  TeamSummary,
} from "./types";

// Live scores: turns rows from the phase 3 views (sets, group tables, races,
// medals) into the shapes in types.ts. Kept apart from results.ts (server
// only) so the mapping can be unit tested. As in stats-rows.ts, view columns
// are all nullable to the type generator; a row missing a key is skipped.

const n = (value: number | null) => value ?? 0;
const yes = (value: boolean | null) => value ?? false;

function toTeam(row: {
  team_id: string | null;
  team_name: string | null;
  team_short_name: string | null;
  team_year: number | null;
}): TeamSummary | null {
  if (!row.team_id || !row.team_name || !row.team_short_name || row.team_year === null) return null;
  return { id: row.team_id, name: row.team_name, shortName: row.team_short_name, year: row.team_year };
}

function toMedal(value: string | null): Medal | null {
  return value === "gold" || value === "silver" || value === "bronze" ? value : null;
}

export function toSetScore(row: Tables<"fixture_set_scores">): SetScore | null {
  if (row.set_number === null) return null;
  return {
    setNumber: row.set_number,
    homePoints: n(row.home_points),
    awayPoints: n(row.away_points),
    complete: yes(row.complete),
    winnerTeamId: row.winner_team_id,
  };
}

export function toEventStandingRow(row: Tables<"event_standings">): EventStandingRow | null {
  const team = toTeam(row);
  if (!team || row.position === null) return null;
  return {
    position: row.position,
    positionShared: yes(row.position_shared),
    team,
    played: n(row.played),
    won: n(row.won),
    drawn: n(row.drawn),
    lost: n(row.lost),
    scoreFor: n(row.score_for),
    scoreAgainst: n(row.score_against),
    scoreDifference: n(row.score_difference),
    setsFor: n(row.sets_for),
    setsAgainst: n(row.sets_against),
    points: n(row.points),
    live: yes(row.live),
  };
}

export function toRaceResultRow(row: Tables<"race_results">): RaceResultRow | null {
  const team = toTeam(row);
  if (!team || row.id === null || !row.fixture_id || !row.stage) return null;
  return {
    entryId: row.id,
    fixtureId: row.fixture_id,
    stage: row.stage,
    team,
    athleteName: row.athlete_name,
    lane: row.lane,
    outcome: row.outcome,
    position: row.position,
    timeMs: row.time_ms,
    markMm: row.mark_mm,
    note: row.note,
    medal: toMedal(row.medal),
  };
}

export function toMedalRow(row: Tables<"event_medals">): MedalRow | null {
  const medal = toMedal(row.medal);
  if (!medal || !row.event_id || !row.fixture_id || !row.team_id || row.place === null) return null;
  return {
    eventId: row.event_id,
    fixtureId: row.fixture_id,
    medal,
    place: row.place,
    teamId: row.team_id,
    athleteName: row.athlete_name,
  };
}

export function toMedalTableRow(row: Tables<"medal_table">): MedalTableRow | null {
  const team = toTeam(row);
  if (!team || row.position === null) return null;
  return {
    position: row.position,
    team,
    gold: n(row.gold),
    silver: n(row.silver),
    bronze: n(row.bronze),
    total: n(row.total),
    points: n(row.points),
    rankBy: row.rank_by === "points" ? "points" : "medals",
  };
}

const OUTCOME_ORDER = { finished: 0, dnf: 1, dq: 2, dns: 3 } as const;

/**
 * Finishing order: finishers by place (then time), then DNF, DQ and DNS,
 * then entrants without a result by lane.
 */
export function compareRaceResults(a: RaceResultRow, b: RaceResultRow): number {
  const rank = (row: RaceResultRow) => (row.outcome ? OUTCOME_ORDER[row.outcome] : 4);
  return (
    rank(a) - rank(b) ||
    (a.position ?? 99) - (b.position ?? 99) ||
    (a.timeMs ?? Number.MAX_SAFE_INTEGER) - (b.timeMs ?? Number.MAX_SAFE_INTEGER) ||
    (a.lane ?? 99) - (b.lane ?? 99) ||
    (a.athleteName ?? a.team.name).localeCompare(b.athleteName ?? b.team.name)
  );
}

/** 12.41 s, or 4:05.30 for 245 300 ms. */
export function formatRaceTime(ms: number): string {
  const hundredths = Math.round(ms / 10);
  const minutes = Math.floor(hundredths / 6000);
  const seconds = (hundredths % 6000) / 100;
  if (minutes === 0) return `${seconds.toFixed(2)} s`;
  return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
}
