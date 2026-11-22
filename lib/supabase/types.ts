export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_imports: {
        Row: {
          actor: string | null
          counts: Json | null
          created_at: string
          import_id: string
          kind: string
        }
        Insert: {
          actor?: string | null
          counts?: Json | null
          created_at?: string
          import_id: string
          kind: string
        }
        Update: {
          actor?: string | null
          counts?: Json | null
          created_at?: string
          import_id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_imports_actor_fkey"
            columns: ["actor"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_imports_actor_fkey"
            columns: ["actor"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          message: string
          starts_at: string
          tone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          message: string
          starts_at: string
          tone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          message?: string
          starts_at?: string
          tone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor: string | null
          context: Json | null
          id: number
          new: Json | null
          occurred_at: string
          old: Json | null
          row_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor?: string | null
          context?: Json | null
          id?: never
          new?: Json | null
          occurred_at?: string
          old?: Json | null
          row_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor?: string | null
          context?: Json | null
          id?: never
          new?: Json | null
          occurred_at?: string
          old?: Json | null
          row_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_fkey"
            columns: ["actor"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_actor_fkey"
            columns: ["actor"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chips: {
        Row: {
          chip_type: Database["public"]["Enums"]["fantasy_chip_type"]
          created_at: string
          id: string
          manager_id: string
          matchday_id: string
        }
        Insert: {
          chip_type: Database["public"]["Enums"]["fantasy_chip_type"]
          created_at?: string
          id?: string
          manager_id: string
          matchday_id: string
        }
        Update: {
          chip_type?: Database["public"]["Enums"]["fantasy_chip_type"]
          created_at?: string
          id?: string
          manager_id?: string
          matchday_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chips_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chips_matchday_id_fkey"
            columns: ["matchday_id"]
            isOneToOne: false
            referencedRelation: "matchdays"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          extra_period_minutes: number | null
          id: string
          name: string
          period_count: number | null
          period_minutes: number | null
          slug: string
          sport_id: string
        }
        Insert: {
          created_at?: string
          extra_period_minutes?: number | null
          id?: string
          name: string
          period_count?: number | null
          period_minutes?: number | null
          slug: string
          sport_id: string
        }
        Update: {
          created_at?: string
          extra_period_minutes?: number | null
          id?: string
          name?: string
          period_count?: number | null
          period_minutes?: number | null
          slug?: string
          sport_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      fantasy_rules: {
        Row: {
          budget_tenths: number
          captain_multiplier: number
          def_quota: number
          extra_transfer_cost: number
          free_transfers_per_md: number
          fwd_quota: number
          gk_quota: number
          id: number
          max_per_team: number
          max_saved_transfers: number
          max_start_def: number
          max_start_fwd: number
          max_start_gk: number
          max_start_mid: number
          mid_quota: number
          min_minutes_threshold: number
          min_start_def: number
          min_start_fwd: number
          min_start_gk: number
          min_start_mid: number
          pts_30_mins: number
          pts_appearance: number
          pts_assist: number
          pts_clean_sheet_def: number
          pts_clean_sheet_fwd: number
          pts_clean_sheet_gk: number
          pts_clean_sheet_mid: number
          pts_goal_def: number
          pts_goal_fwd: number
          pts_goal_gk: number
          pts_goal_mid: number
          pts_goals_conceded_def: number
          pts_goals_conceded_fwd: number
          pts_goals_conceded_gk: number
          pts_goals_conceded_mid: number
          pts_goals_conceded_step: number
          pts_motm: number
          pts_own_goal: number
          pts_penalty_miss: number
          pts_penalty_save: number
          pts_red_card: number
          pts_yellow_card: number
          squad_size: number
          starting_size: number
          unlimited_transfer_matchdays: number[]
          updated_at: string
        }
        Insert: {
          budget_tenths?: number
          captain_multiplier?: number
          def_quota?: number
          extra_transfer_cost?: number
          free_transfers_per_md?: number
          fwd_quota?: number
          gk_quota?: number
          id?: number
          max_per_team?: number
          max_saved_transfers?: number
          max_start_def?: number
          max_start_fwd?: number
          max_start_gk?: number
          max_start_mid?: number
          mid_quota?: number
          min_minutes_threshold?: number
          min_start_def?: number
          min_start_fwd?: number
          min_start_gk?: number
          min_start_mid?: number
          pts_30_mins?: number
          pts_appearance?: number
          pts_assist?: number
          pts_clean_sheet_def?: number
          pts_clean_sheet_fwd?: number
          pts_clean_sheet_gk?: number
          pts_clean_sheet_mid?: number
          pts_goal_def?: number
          pts_goal_fwd?: number
          pts_goal_gk?: number
          pts_goal_mid?: number
          pts_goals_conceded_def?: number
          pts_goals_conceded_fwd?: number
          pts_goals_conceded_gk?: number
          pts_goals_conceded_mid?: number
          pts_goals_conceded_step?: number
          pts_motm?: number
          pts_own_goal?: number
          pts_penalty_miss?: number
          pts_penalty_save?: number
          pts_red_card?: number
          pts_yellow_card?: number
          squad_size?: number
          starting_size?: number
          unlimited_transfer_matchdays?: number[]
          updated_at?: string
        }
        Update: {
          budget_tenths?: number
          captain_multiplier?: number
          def_quota?: number
          extra_transfer_cost?: number
          free_transfers_per_md?: number
          fwd_quota?: number
          gk_quota?: number
          id?: number
          max_per_team?: number
          max_saved_transfers?: number
          max_start_def?: number
          max_start_fwd?: number
          max_start_gk?: number
          max_start_mid?: number
          mid_quota?: number
          min_minutes_threshold?: number
          min_start_def?: number
          min_start_fwd?: number
          min_start_gk?: number
          min_start_mid?: number
          pts_30_mins?: number
          pts_appearance?: number
          pts_assist?: number
          pts_clean_sheet_def?: number
          pts_clean_sheet_fwd?: number
          pts_clean_sheet_gk?: number
          pts_clean_sheet_mid?: number
          pts_goal_def?: number
          pts_goal_fwd?: number
          pts_goal_gk?: number
          pts_goal_mid?: number
          pts_goals_conceded_def?: number
          pts_goals_conceded_fwd?: number
          pts_goals_conceded_gk?: number
          pts_goals_conceded_mid?: number
          pts_goals_conceded_step?: number
          pts_motm?: number
          pts_own_goal?: number
          pts_penalty_miss?: number
          pts_penalty_save?: number
          pts_red_card?: number
          pts_yellow_card?: number
          squad_size?: number
          starting_size?: number
          unlimited_transfer_matchdays?: number[]
          updated_at?: string
        }
        Relationships: []
      }
      fixtures: {
        Row: {
          away_score: number | null
          away_shootout: number | null
          away_team_id: string | null
          console_holder: string | null
          created_at: string
          current_period: Database["public"]["Enums"]["match_period"] | null
          event_id: string
          home_score: number | null
          home_shootout: number | null
          home_team_id: string | null
          id: string
          kickoff_at: string | null
          matchday_id: string | null
          period_started_at: string | null
          result_note: string | null
          stage: string
          status: Database["public"]["Enums"]["fixture_status"]
          updated_at: string
          venue: string | null
          winner_team_id: string | null
        }
        Insert: {
          away_score?: number | null
          away_shootout?: number | null
          away_team_id?: string | null
          console_holder?: string | null
          created_at?: string
          current_period?: Database["public"]["Enums"]["match_period"] | null
          event_id: string
          home_score?: number | null
          home_shootout?: number | null
          home_team_id?: string | null
          id?: string
          kickoff_at?: string | null
          matchday_id?: string | null
          period_started_at?: string | null
          result_note?: string | null
          stage?: string
          status?: Database["public"]["Enums"]["fixture_status"]
          updated_at?: string
          venue?: string | null
          winner_team_id?: string | null
        }
        Update: {
          away_score?: number | null
          away_shootout?: number | null
          away_team_id?: string | null
          console_holder?: string | null
          created_at?: string
          current_period?: Database["public"]["Enums"]["match_period"] | null
          event_id?: string
          home_score?: number | null
          home_shootout?: number | null
          home_team_id?: string | null
          id?: string
          kickoff_at?: string | null
          matchday_id?: string | null
          period_started_at?: string | null
          result_note?: string | null
          stage?: string
          status?: Database["public"]["Enums"]["fixture_status"]
          updated_at?: string
          venue?: string | null
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixtures_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_console_holder_fkey"
            columns: ["console_holder"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_console_holder_fkey"
            columns: ["console_holder"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_matchday_id_fkey"
            columns: ["matchday_id"]
            isOneToOne: false
            referencedRelation: "matchdays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      league_members: {
        Row: {
          joined_at: string
          league_id: string
          manager_id: string
        }
        Insert: {
          joined_at?: string
          league_id: string
          manager_id: string
        }
        Update: {
          joined_at?: string
          league_id?: string
          manager_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_members_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          created_at: string
          created_by: string
          id: string
          invite_code: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          invite_code: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          invite_code?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "leagues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
        ]
      }
      lineups: {
        Row: {
          fixture_id: string
          player_id: string
          role: Database["public"]["Enums"]["lineup_role"]
          set_at: string
          set_by: string | null
          team_id: string
        }
        Insert: {
          fixture_id: string
          player_id: string
          role: Database["public"]["Enums"]["lineup_role"]
          set_at?: string
          set_by?: string | null
          team_id: string
        }
        Update: {
          fixture_id?: string
          player_id?: string
          role?: Database["public"]["Enums"]["lineup_role"]
          set_at?: string
          set_by?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineups_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "football_suspensions"
            referencedColumns: ["banned_fixture_id"]
          },
          {
            foreignKeyName: "lineups_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_matchday_points: {
        Row: {
          breakdown: Json
          calculated_at: string
          gross_points: number
          is_provisional: boolean
          manager_id: string
          matchday_id: string
          net_points: number
          transfer_cost: number
        }
        Insert: {
          breakdown?: Json
          calculated_at?: string
          gross_points?: number
          is_provisional?: boolean
          manager_id: string
          matchday_id: string
          net_points?: number
          transfer_cost?: number
        }
        Update: {
          breakdown?: Json
          calculated_at?: string
          gross_points?: number
          is_provisional?: boolean
          manager_id?: string
          matchday_id?: string
          net_points?: number
          transfer_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "manager_matchday_points_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_matchday_points_matchday_id_fkey"
            columns: ["matchday_id"]
            isOneToOne: false
            referencedRelation: "matchdays"
            referencedColumns: ["id"]
          },
        ]
      }
      managers: {
        Row: {
          created_at: string
          free_transfers: number
          id: string
          last_rollover_matchday: number
          overall_rank: number | null
          team_name: string
          total_points: number
          updated_at: string
          user_id: string
          wildcard_used: boolean
          year_group: number | null
          year_rank: number | null
        }
        Insert: {
          created_at?: string
          free_transfers?: number
          id?: string
          last_rollover_matchday?: number
          overall_rank?: number | null
          team_name: string
          total_points?: number
          updated_at?: string
          user_id: string
          wildcard_used?: boolean
          year_group?: number | null
          year_rank?: number | null
        }
        Update: {
          created_at?: string
          free_transfers?: number
          id?: string
          last_rollover_matchday?: number
          overall_rank?: number | null
          team_name?: string
          total_points?: number
          updated_at?: string
          user_id?: string
          wildcard_used?: boolean
          year_group?: number | null
          year_rank?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "managers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "managers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_events: {
        Row: {
          card: Database["public"]["Enums"]["card_colour"] | null
          client_event_id: string
          fixture_id: string
          id: number
          is_own_goal: boolean
          is_penalty: boolean
          occurred_at: string
          other_player_id: string | null
          period: Database["public"]["Enums"]["match_period"] | null
          player_id: string | null
          points: number | null
          recorded_at: string
          recorded_by: string | null
          scored: boolean | null
          team_id: string | null
          type: Database["public"]["Enums"]["match_event_type"]
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          card?: Database["public"]["Enums"]["card_colour"] | null
          client_event_id: string
          fixture_id: string
          id?: never
          is_own_goal?: boolean
          is_penalty?: boolean
          occurred_at: string
          other_player_id?: string | null
          period?: Database["public"]["Enums"]["match_period"] | null
          player_id?: string | null
          points?: number | null
          recorded_at?: string
          recorded_by?: string | null
          scored?: boolean | null
          team_id?: string | null
          type: Database["public"]["Enums"]["match_event_type"]
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          card?: Database["public"]["Enums"]["card_colour"] | null
          client_event_id?: string
          fixture_id?: string
          id?: never
          is_own_goal?: boolean
          is_penalty?: boolean
          occurred_at?: string
          other_player_id?: string | null
          period?: Database["public"]["Enums"]["match_period"] | null
          player_id?: string | null
          points?: number | null
          recorded_at?: string
          recorded_by?: string | null
          scored?: boolean | null
          team_id?: string | null
          type?: Database["public"]["Enums"]["match_event_type"]
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_events_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "football_suspensions"
            referencedColumns: ["banned_fixture_id"]
          },
          {
            foreignKeyName: "match_events_other_player_id_fkey"
            columns: ["other_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matchdays: {
        Row: {
          deadline_at: string | null
          id: string
          name: string
          number: number
          status: Database["public"]["Enums"]["matchday_status"]
        }
        Insert: {
          deadline_at?: string | null
          id?: string
          name: string
          number: number
          status?: Database["public"]["Enums"]["matchday_status"]
        }
        Update: {
          deadline_at?: string | null
          id?: string
          name?: string
          number?: number
          status?: Database["public"]["Enums"]["matchday_status"]
        }
        Relationships: []
      }
      picks: {
        Row: {
          bench_order: number | null
          created_at: string
          id: string
          is_captain: boolean
          is_starter: boolean
          is_vice_captain: boolean
          manager_id: string
          matchday_id: string
          player_id: string
          updated_at: string
        }
        Insert: {
          bench_order?: number | null
          created_at?: string
          id?: string
          is_captain?: boolean
          is_starter: boolean
          is_vice_captain?: boolean
          manager_id: string
          matchday_id: string
          player_id: string
          updated_at?: string
        }
        Update: {
          bench_order?: number | null
          created_at?: string
          id?: string
          is_captain?: boolean
          is_starter?: boolean
          is_vice_captain?: boolean
          manager_id?: string
          matchday_id?: string
          player_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "picks_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picks_matchday_id_fkey"
            columns: ["matchday_id"]
            isOneToOne: false
            referencedRelation: "matchdays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picks_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          display_name: string
          full_name: string
          id: string
          position: Database["public"]["Enums"]["player_position"]
          price_tenths: number
          shirt_number: number | null
          status: Database["public"]["Enums"]["player_status"]
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          full_name: string
          id?: string
          position: Database["public"]["Enums"]["player_position"]
          price_tenths?: number
          shirt_number?: number | null
          status?: Database["public"]["Enums"]["player_status"]
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          full_name?: string
          id?: string
          position?: Database["public"]["Enums"]["player_position"]
          price_tenths?: number
          shirt_number?: number | null
          status?: Database["public"]["Enums"]["player_status"]
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          year_group: number | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          year_group?: number | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          year_group?: number | null
        }
        Relationships: []
      }
      sports: {
        Row: {
          id: string
          name: string
          result_format: Database["public"]["Enums"]["result_format"]
          slug: string
          sort_order: number
        }
        Insert: {
          id?: string
          name: string
          result_format: Database["public"]["Enums"]["result_format"]
          slug: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          result_format?: Database["public"]["Enums"]["result_format"]
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      squads: {
        Row: {
          added_at: string
          manager_id: string
          player_id: string
        }
        Insert: {
          added_at?: string
          manager_id: string
          player_id: string
        }
        Update: {
          added_at?: string
          manager_id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squads_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squads_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          class_label: string
          coaches: string[]
          created_at: string
          id: string
          name: string
          short_name: string
          year: number
        }
        Insert: {
          class_label: string
          coaches?: string[]
          created_at?: string
          id?: string
          name: string
          short_name: string
          year: number
        }
        Update: {
          class_label?: string
          coaches?: string[]
          created_at?: string
          id?: string
          name?: string
          short_name?: string
          year?: number
        }
        Relationships: []
      }
      transfers: {
        Row: {
          created_at: string
          id: string
          manager_id: string
          matchday_id: string
          player_in_id: string
          player_out_id: string
          points_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          manager_id: string
          matchday_id: string
          player_in_id: string
          player_out_id: string
          points_cost?: number
        }
        Update: {
          created_at?: string
          id?: string
          manager_id?: string
          matchday_id?: string
          player_in_id?: string
          player_out_id?: string
          points_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "transfers_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_matchday_id_fkey"
            columns: ["matchday_id"]
            isOneToOne: false
            referencedRelation: "matchdays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_player_in_id_fkey"
            columns: ["player_in_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_player_out_id_fkey"
            columns: ["player_out_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      football_player_totals: {
        Row: {
          appearances: number | null
          assists: number | null
          clean_sheets: number | null
          display_name: string | null
          event_id: string | null
          goals: number | null
          man_of_the_match: number | null
          minutes_played: number | null
          own_goals: number | null
          player_id: string | null
          position: Database["public"]["Enums"]["player_position"] | null
          red_cards: number | null
          team_id: string | null
          team_name: string | null
          team_short_name: string | null
          team_year: number | null
          yellow_cards: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fixtures_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      football_standings: {
        Row: {
          drawn: number | null
          event_id: string | null
          goal_difference: number | null
          goals_against: number | null
          goals_for: number | null
          h2h_points: number | null
          live: boolean | null
          lost: number | null
          played: number | null
          points: number | null
          position: number | null
          position_shared: boolean | null
          team_id: string | null
          team_name: string | null
          team_short_name: string | null
          team_year: number | null
          won: number | null
        }
        Relationships: []
      }
      football_suspensions: {
        Row: {
          ban_served: boolean | null
          banned_fixture_id: string | null
          banned_fixture_kickoff_at: string | null
          display_name: string | null
          event_id: string | null
          player_id: string | null
          red_card_event_id: number | null
          red_card_fixture_id: string | null
          team_id: string | null
          team_short_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixtures_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_fixture_id_fkey"
            columns: ["red_card_fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_fixture_id_fkey"
            columns: ["red_card_fixture_id"]
            isOneToOne: false
            referencedRelation: "football_suspensions"
            referencedColumns: ["banned_fixture_id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_timeline: {
        Row: {
          added_minutes: number | null
          card: Database["public"]["Enums"]["card_colour"] | null
          client_event_id: string | null
          fixture_id: string | null
          id: number | null
          is_own_goal: boolean | null
          is_penalty: boolean | null
          minute: number | null
          occurred_at: string | null
          other_player_id: string | null
          other_player_name: string | null
          period: Database["public"]["Enums"]["match_period"] | null
          player_id: string | null
          player_name: string | null
          points: number | null
          scored: boolean | null
          team_id: string | null
          team_short_name: string | null
          type: Database["public"]["Enums"]["match_event_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "match_events_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "football_suspensions"
            referencedColumns: ["banned_fixture_id"]
          },
          {
            foreignKeyName: "match_events_other_player_id_fkey"
            columns: ["other_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      player_match_stats: {
        Row: {
          appeared: boolean | null
          assists: number | null
          event_id: string | null
          fixture_finished: boolean | null
          fixture_id: string | null
          goals: number | null
          goals_conceded_on_pitch: number | null
          lineup_role: Database["public"]["Enums"]["lineup_role"] | null
          lineup_set: boolean | null
          man_of_the_match: boolean | null
          matchday_id: string | null
          minutes_played: number | null
          own_goals: number | null
          own_goals_conceded_on_pitch: number | null
          penalties_missed: number | null
          penalties_saved: number | null
          player_id: string | null
          position: Database["public"]["Enums"]["player_position"] | null
          red_cards: number | null
          red_from_second_yellow: boolean | null
          started: boolean | null
          team_id: string | null
          walkover: boolean | null
          yellow_cards: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fixtures_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_matchday_id_fkey"
            columns: ["matchday_id"]
            isOneToOne: false
            referencedRelation: "matchdays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          id: string | null
          year_group: number | null
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          id?: string | null
          year_group?: number | null
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          id?: string | null
          year_group?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      activate_wildcard: { Args: never; Returns: Json }
      admin_audit_page: {
        Args: {
          p_actor?: string
          p_before_at?: string
          p_before_id?: number
          p_before_source?: string
          p_from?: string
          p_limit?: number
          p_table?: string
          p_to?: string
        }
        Returns: {
          action: string
          actor: string
          actor_name: string
          context: Json
          id: number
          new: Json
          occurred_at: string
          old: Json
          row_id: string
          source: string
          table_name: string
        }[]
      }
      admin_begin_import: {
        Args: { p_import_id: string; p_kind: string; p_rows: Json }
        Returns: Json
      }
      admin_deadline_rules: {
        Args: never
        Returns: {
          minutes_before_kickoff: number
        }[]
      }
      admin_fail: {
        Args: { p_code: string; p_message: string }
        Returns: undefined
      }
      admin_finish_import: {
        Args: {
          p_import_id: string
          p_inserted: number
          p_unchanged: number
          p_updated: number
        }
        Returns: Json
      }
      admin_import_fixtures: {
        Args: { p_import_id: string; p_rows: Json }
        Returns: Json
      }
      admin_import_players: {
        Args: { p_import_id: string; p_rows: Json }
        Returns: Json
      }
      admin_normalise_name: { Args: { p_name: string }; Returns: string }
      admin_price_lock_at: { Args: never; Returns: string }
      admin_price_problem: { Args: { p_tenths: number }; Returns: string }
      admin_price_rules: {
        Args: never
        Returns: {
          max_tenths: number
          min_tenths: number
          step_tenths: number
        }[]
      }
      admin_raise_row_errors: {
        Args: { p_errors: string[] }
        Returns: undefined
      }
      admin_set_audit_context: { Args: { p_context: Json }; Returns: undefined }
      admin_set_prices: {
        Args: { p_import_id: string; p_rows: Json }
        Returns: Json
      }
      admin_set_role: {
        Args: {
          p_profile_id: string
          p_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: Json
      }
      create_league: { Args: { p_name: string }; Returns: Json }
      create_manager: {
        Args: { p_team_name: string; p_year_group?: number }
        Returns: {
          created_at: string
          free_transfers: number
          id: string
          last_rollover_matchday: number
          overall_rank: number | null
          team_name: string
          total_points: number
          updated_at: string
          user_id: string
          wildcard_used: boolean
          year_group: number | null
          year_rank: number | null
        }
        SetofOptions: {
          from: "*"
          to: "managers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fantasy_fail: {
        Args: { p_code: string; p_message: string }
        Returns: undefined
      }
      fantasy_get_open_matchday: {
        Args: never
        Returns: {
          deadline_at: string | null
          id: string
          name: string
          number: number
          status: Database["public"]["Enums"]["matchday_status"]
        }
        SetofOptions: {
          from: "*"
          to: "matchdays"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fantasy_is_league_member: {
        Args: { p_league_id: string }
        Returns: boolean
      }
      fantasy_prepare_matchday_snapshots: {
        Args: { p_matchday_id: string }
        Returns: undefined
      }
      fantasy_sync_manager_for_matchday: {
        Args: {
          p_manager_id: string
          p_target_md: Database["public"]["Tables"]["matchdays"]["Row"]
        }
        Returns: {
          created_at: string
          free_transfers: number
          id: string
          last_rollover_matchday: number
          overall_rank: number | null
          team_name: string
          total_points: number
          updated_at: string
          user_id: string
          wildcard_used: boolean
          year_group: number | null
          year_rank: number | null
        }
        SetofOptions: {
          from: "*"
          to: "managers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fill_football_knockouts: {
        Args: { p_event_id: string }
        Returns: {
          away_score: number | null
          away_shootout: number | null
          away_team_id: string | null
          console_holder: string | null
          created_at: string
          current_period: Database["public"]["Enums"]["match_period"] | null
          event_id: string
          home_score: number | null
          home_shootout: number | null
          home_team_id: string | null
          id: string
          kickoff_at: string | null
          matchday_id: string | null
          period_started_at: string | null
          result_note: string | null
          stage: string
          status: Database["public"]["Enums"]["fixture_status"]
          updated_at: string
          venue: string | null
          winner_team_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "fixtures"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      fixture_player_state: {
        Args: { p_fixture_id: string }
        Returns: {
          appeared: boolean
          lineup_role: Database["public"]["Enums"]["lineup_role"]
          on_pitch: boolean
          player_id: string
          sent_off: boolean
          team_id: string
          yellow_cards: number
        }[]
      }
      holds_fixture: { Args: { p_fixture_id: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_official: { Args: never; Returns: boolean }
      join_league: { Args: { p_code: string }; Returns: Json }
      live_check_on_pitch: {
        Args: {
          p_fixture_id: string
          p_is_own_goal: boolean
          p_opponent_id: string
          p_other_player_id: string
          p_player_id: string
          p_team_id: string
          p_type: Database["public"]["Enums"]["match_event_type"]
        }
        Returns: undefined
      }
      live_check_player: {
        Args: { p_label: string; p_player_id: string; p_team_id: string }
        Returns: undefined
      }
      live_fail: {
        Args: { p_code: string; p_message: string }
        Returns: undefined
      }
      live_is_on_pitch: {
        Args: { p_fixture_id: string; p_player_id: string }
        Returns: boolean
      }
      live_lock_fixture_for_console: {
        Args: { p_fixture_id: string }
        Returns: {
          away_score: number | null
          away_shootout: number | null
          away_team_id: string | null
          console_holder: string | null
          created_at: string
          current_period: Database["public"]["Enums"]["match_period"] | null
          event_id: string
          home_score: number | null
          home_shootout: number | null
          home_team_id: string | null
          id: string
          kickoff_at: string | null
          matchday_id: string | null
          period_started_at: string | null
          result_note: string | null
          stage: string
          status: Database["public"]["Enums"]["fixture_status"]
          updated_at: string
          venue: string | null
          winner_team_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "fixtures"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      live_period_end_minute: {
        Args: {
          p_extra_period_minutes: number
          p_period: Database["public"]["Enums"]["match_period"]
          p_period_minutes: number
        }
        Returns: number
      }
      make_transfers: {
        Args: {
          p_in_ids: string[]
          p_out_ids: string[]
          p_use_wildcard?: boolean
        }
        Returns: Json
      }
      match_minute: {
        Args: {
          p_at: string
          p_extra_period_minutes: number
          p_period: Database["public"]["Enums"]["match_period"]
          p_period_minutes: number
          p_period_started_at: string
        }
        Returns: {
          added_minutes: number
          minute: number
        }[]
      }
      record_match_event: {
        Args: {
          p_card?: Database["public"]["Enums"]["card_colour"]
          p_client_event_id: string
          p_fixture_id: string
          p_is_own_goal?: boolean
          p_is_penalty?: boolean
          p_occurred_at?: string
          p_other_player_id?: string
          p_period?: Database["public"]["Enums"]["match_period"]
          p_player_id?: string
          p_points?: number
          p_scored?: boolean
          p_team_id?: string
          p_type: Database["public"]["Enums"]["match_event_type"]
        }
        Returns: {
          card: Database["public"]["Enums"]["card_colour"] | null
          client_event_id: string
          fixture_id: string
          id: number
          is_own_goal: boolean
          is_penalty: boolean
          occurred_at: string
          other_player_id: string | null
          period: Database["public"]["Enums"]["match_period"] | null
          player_id: string | null
          points: number | null
          recorded_at: string
          recorded_by: string | null
          scored: boolean | null
          team_id: string | null
          type: Database["public"]["Enums"]["match_event_type"]
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "match_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      refresh_fixture_state: {
        Args: { p_fixture_id: string }
        Returns: undefined
      }
      release_fixture: {
        Args: { p_fixture_id: string }
        Returns: {
          away_score: number | null
          away_shootout: number | null
          away_team_id: string | null
          console_holder: string | null
          created_at: string
          current_period: Database["public"]["Enums"]["match_period"] | null
          event_id: string
          home_score: number | null
          home_shootout: number | null
          home_team_id: string | null
          id: string
          kickoff_at: string | null
          matchday_id: string | null
          period_started_at: string | null
          result_note: string | null
          stage: string
          status: Database["public"]["Enums"]["fixture_status"]
          updated_at: string
          venue: string | null
          winner_team_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "fixtures"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_lineup: { Args: { p_picks: Json }; Returns: Json }
      save_squad: {
        Args: { p_picks?: Json; p_player_ids: string[] }
        Returns: Json
      }
      set_lineup: {
        Args: {
          p_bench?: string[]
          p_fixture_id: string
          p_starters: string[]
          p_team_id: string
        }
        Returns: number
      }
      take_fixture: {
        Args: { p_fixture_id: string }
        Returns: {
          away_score: number | null
          away_shootout: number | null
          away_team_id: string | null
          console_holder: string | null
          created_at: string
          current_period: Database["public"]["Enums"]["match_period"] | null
          event_id: string
          home_score: number | null
          home_shootout: number | null
          home_team_id: string | null
          id: string
          kickoff_at: string | null
          matchday_id: string | null
          period_started_at: string | null
          result_note: string | null
          stage: string
          status: Database["public"]["Enums"]["fixture_status"]
          updated_at: string
          venue: string | null
          winner_team_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "fixtures"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      void_match_event: {
        Args: { p_client_event_id: string; p_reason?: string }
        Returns: {
          card: Database["public"]["Enums"]["card_colour"] | null
          client_event_id: string
          fixture_id: string
          id: number
          is_own_goal: boolean
          is_penalty: boolean
          occurred_at: string
          other_player_id: string | null
          period: Database["public"]["Enums"]["match_period"] | null
          player_id: string | null
          points: number | null
          recorded_at: string
          recorded_by: string | null
          scored: boolean | null
          team_id: string | null
          type: Database["public"]["Enums"]["match_event_type"]
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "match_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "user" | "official" | "admin"
      card_colour: "yellow" | "red"
      fantasy_chip_type: "wildcard"
      fixture_status:
        | "scheduled"
        | "live"
        | "half_time"
        | "full_time"
        | "postponed"
        | "walkover"
        | "cancelled"
      lineup_role: "starter" | "bench"
      match_event_type:
        | "period_start"
        | "period_end"
        | "goal"
        | "card"
        | "substitution"
        | "penalty_miss"
        | "shootout_kick"
        | "man_of_the_match"
        | "full_time"
        | "walkover"
      match_period:
        | "first_half"
        | "second_half"
        | "extra_first"
        | "extra_second"
        | "penalties"
      matchday_status: "upcoming" | "open" | "locked" | "finalised"
      player_position: "GK" | "DEF" | "MID" | "FWD"
      player_status: "available" | "injured" | "suspended" | "left"
      result_format: "timed" | "sets" | "head_to_head" | "ranked"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["user", "official", "admin"],
      card_colour: ["yellow", "red"],
      fantasy_chip_type: ["wildcard"],
      fixture_status: [
        "scheduled",
        "live",
        "half_time",
        "full_time",
        "postponed",
        "walkover",
        "cancelled",
      ],
      lineup_role: ["starter", "bench"],
      match_event_type: [
        "period_start",
        "period_end",
        "goal",
        "card",
        "substitution",
        "penalty_miss",
        "shootout_kick",
        "man_of_the_match",
        "full_time",
        "walkover",
      ],
      match_period: [
        "first_half",
        "second_half",
        "extra_first",
        "extra_second",
        "penalties",
      ],
      matchday_status: ["upcoming", "open", "locked", "finalised"],
      player_position: ["GK", "DEF", "MID", "FWD"],
      player_status: ["available", "injured", "suspended", "left"],
      result_format: ["timed", "sets", "head_to_head", "ranked"],
    },
  },
} as const
