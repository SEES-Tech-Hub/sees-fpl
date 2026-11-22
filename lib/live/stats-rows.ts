import type { Tables } from "@/lib/supabase/types";
import type {
  PlayerMatchStats,
  PlayerTotalsRow,
  StandingRow,
  SuspensionRow,
  TeamSummary,
} from "./types";

// Live scores: turns rows from the derived football views into the shapes in
// types.ts. Kept apart from stats.ts (which only runs on the server) so the
// mapping can be unit tested.
//
// Postgres reports every view column as nullable, even when the SQL can't
// produce a null. A row missing a key column is skipped (it can't happen with
// the current views); counts and flags default to 0 and false.

type PlayerMatchStatsView = Tables<"player_match_stats">;
type StandingsView = Tables<"football_standings">;
type PlayerTotalsView = Tables<"football_player_totals">;
type SuspensionsView = Tables<"football_suspensions">;

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

export function toPlayerMatchStats(row: PlayerMatchStatsView): PlayerMatchStats | null {
  if (!row.fixture_id || !row.event_id || !row.player_id || !row.team_id || !row.position) return null;
  return {
    fixtureId: row.fixture_id,
    eventId: row.event_id,
    matchdayId: row.matchday_id,
    playerId: row.player_id,
    teamId: row.team_id,
    position: row.position,
    lineupSet: yes(row.lineup_set),
    started: yes(row.started),
    appeared: yes(row.appeared),
    minutesPlayed: n(row.minutes_played),
    goals: n(row.goals),
    assists: n(row.assists),
    ownGoals: n(row.own_goals),
    goalsConcededOnPitch: n(row.goals_conceded_on_pitch),
    ownGoalsConcededOnPitch: n(row.own_goals_conceded_on_pitch),
    yellowCards: n(row.yellow_cards),
    redCards: n(row.red_cards),
    redFromSecondYellow: yes(row.red_from_second_yellow),
    penaltiesMissed: n(row.penalties_missed),
    penaltiesSaved: n(row.penalties_saved),
    manOfTheMatch: yes(row.man_of_the_match),
    walkover: yes(row.walkover),
    fixtureFinished: yes(row.fixture_finished),
  };
}

export function toStandingRow(row: StandingsView): StandingRow | null {
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
    goalsFor: n(row.goals_for),
    goalsAgainst: n(row.goals_against),
    goalDifference: n(row.goal_difference),
    points: n(row.points),
    live: yes(row.live),
  };
}

export function toPlayerTotalsRow(row: PlayerTotalsView): PlayerTotalsRow | null {
  const team = toTeam(row);
  if (!team || !row.player_id || !row.display_name || !row.position) return null;
  return {
    playerId: row.player_id,
    name: row.display_name,
    team,
    position: row.position,
    appearances: n(row.appearances),
    minutesPlayed: n(row.minutes_played),
    goals: n(row.goals),
    assists: n(row.assists),
    ownGoals: n(row.own_goals),
    cleanSheets: n(row.clean_sheets),
    yellowCards: n(row.yellow_cards),
    redCards: n(row.red_cards),
    manOfTheMatch: n(row.man_of_the_match),
  };
}

export function toSuspensionRow(row: SuspensionsView): SuspensionRow | null {
  if (!row.player_id || !row.display_name || !row.team_id || !row.team_short_name || !row.red_card_fixture_id) {
    return null;
  }
  return {
    playerId: row.player_id,
    name: row.display_name,
    teamId: row.team_id,
    teamShortName: row.team_short_name,
    redCardFixtureId: row.red_card_fixture_id,
    bannedFixtureId: row.banned_fixture_id,
    bannedFixtureKickoffAt: row.banned_fixture_kickoff_at,
    banServed: yes(row.ban_served),
  };
}

/** Keeps the rows that mapped. */
export function mapRows<Row, T>(rows: readonly Row[] | null, map: (row: Row) => T | null): T[] {
  const out: T[] = [];
  for (const row of rows ?? []) {
    const mapped = map(row);
    if (mapped) out.push(mapped);
  }
  return out;
}

/** Most goals first, then assists, then fewer minutes, then name. */
export function compareScorers(a: PlayerTotalsRow, b: PlayerTotalsRow): number {
  return (
    b.goals - a.goals ||
    b.assists - a.assists ||
    a.minutesPlayed - b.minutesPlayed ||
    a.name.localeCompare(b.name)
  );
}

/** Most assists first, then goals, then fewer minutes, then name. */
export function compareAssisters(a: PlayerTotalsRow, b: PlayerTotalsRow): number {
  return (
    b.assists - a.assists ||
    b.goals - a.goals ||
    a.minutesPlayed - b.minutesPlayed ||
    a.name.localeCompare(b.name)
  );
}
