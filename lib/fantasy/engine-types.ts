import type { Database } from "../supabase/types";

export type PlayerPosition = Database["public"]["Enums"]["player_position"];
export type PlayerStatus = Database["public"]["Enums"]["player_status"];
export type MatchdayStatus = Database["public"]["Enums"]["matchday_status"];

export type ScoringKey =
  | "appeared"
  | "played_30"
  | "goal"
  | "assist"
  | "clean_sheet"
  | "goals_conceded_2"
  | "penalty_saved"
  | "saves"
  | "penalty_missed"
  | "yellow_card"
  | "red_card"
  | "own_goal"
  | "man_of_the_match";

export type ScoreBreakdownItem = {
  key: ScoringKey;
  label: string;
  count: number;
  points: number;
};

export type FantasyRules = {
  id: number;
  squad_size: number;
  budget_tenths: number;
  max_per_team: number;
  gk_quota: number;
  def_quota: number;
  mid_quota: number;
  fwd_quota: number;
  starting_size: number;
  min_start_gk: number;
  max_start_gk: number;
  min_start_def: number;
  max_start_def: number;
  min_start_mid: number;
  max_start_mid: number;
  min_start_fwd: number;
  max_start_fwd: number;
  free_transfers_per_md: number;
  max_saved_transfers: number;
  extra_transfer_cost: number;
  unlimited_transfer_matchdays: number[];
  captain_multiplier: number;
  min_minutes_threshold: number;
  pts_appearance: number;
  pts_30_mins: number;
  pts_goal_gk: number;
  pts_goal_def: number;
  pts_goal_mid: number;
  pts_goal_fwd: number;
  pts_assist: number;
  pts_clean_sheet_gk: number;
  pts_clean_sheet_def: number;
  pts_clean_sheet_mid: number;
  pts_clean_sheet_fwd: number;
  pts_goals_conceded_step: number;
  pts_goals_conceded_gk: number;
  pts_goals_conceded_def: number;
  pts_goals_conceded_mid: number;
  pts_goals_conceded_fwd: number;
  pts_penalty_save: number;
  /** Points for every pts_saves_step saves (FPL: 1 per 3). Missing before the saves migration. */
  pts_saves?: number;
  pts_saves_step?: number;
  pts_penalty_miss: number;
  pts_yellow_card: number;
  pts_red_card: number;
  pts_own_goal: number;
  pts_motm: number;
};

export type FantasyPlayer = {
  id: string;
  team_id: string;
  display_name: string;
  position: PlayerPosition;
  price_tenths: number;
  status: PlayerStatus;
};

export type MatchdayInfo = {
  id: string;
  number: number;
  name: string;
  deadline_at: string | null;
  status: MatchdayStatus;
};

export type ManagerProfile = {
  id: string;
  user_id: string;
  team_name: string;
  year_group: number | null;
  free_transfers: number;
  wildcard_used: boolean;
  total_points: number;
  overall_rank: number | null;
  year_rank: number | null;
};

export type PickInput = {
  player_id: string;
  is_starter: boolean;
  bench_order: number | null;
  is_captain: boolean;
  is_vice_captain: boolean;
};

export type PlayerMatchStats = {
  playerId: string;
  fixtureId: string;
  appeared: boolean;
  minutesPlayed: number;
  goals: number;
  assists: number;
  ownGoals: number;
  goalsConcededOnPitch: number;
  yellowCards: number;
  redCards: number;
  penaltiesMissed: number;
  penaltiesSaved: number;
  /** Saves made, penalties saved included. */
  saves: number;
  manOfTheMatch: boolean;
  walkover: boolean;
  fixtureFinished: boolean;
};

export type PlayerScoreBreakdown = {
  player_id: string;
  is_starter: boolean;
  played_minutes: number;
  subbed_in: boolean;
  subbed_out: boolean;
  multiplier: number;
  base_points: number;
  applied_points: number;
  items: ScoreBreakdownItem[];
};

export type ManagerMatchdayScoreResult = {
  gross_points: number;
  transfer_cost: number;
  net_points: number;
  captain_used: "captain" | "vice_captain" | "none";
  auto_subs: { out_player_id: string; in_player_id: string }[];
  breakdown: PlayerScoreBreakdown[];
};

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

export type FantasyError = {
  code: string;
  message: string;
  playerIds?: string[];
};

export type FantasyActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: FantasyError };