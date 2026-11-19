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
    }
    Views: {
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
