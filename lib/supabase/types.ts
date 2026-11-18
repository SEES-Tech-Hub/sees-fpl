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
          id: string
          name: string
          period_count: number | null
          period_minutes: number | null
          slug: string
          sport_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          period_count?: number | null
          period_minutes?: number | null
          slug: string
          sport_id: string
        }
        Update: {
          created_at?: string
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
          away_team_id: string | null
          console_holder: string | null
          created_at: string
          current_period: Database["public"]["Enums"]["match_period"] | null
          event_id: string
          home_score: number | null
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
          away_team_id?: string | null
          console_holder?: string | null
          created_at?: string
          current_period?: Database["public"]["Enums"]["match_period"] | null
          event_id: string
          home_score?: number | null
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
          away_team_id?: string | null
          console_holder?: string | null
          created_at?: string
          current_period?: Database["public"]["Enums"]["match_period"] | null
          event_id?: string
          home_score?: number | null
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
      holds_fixture: { Args: { p_fixture_id: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_official: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "user" | "official" | "admin"
      fixture_status:
        | "scheduled"
        | "live"
        | "half_time"
        | "full_time"
        | "postponed"
        | "walkover"
        | "cancelled"
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
      fixture_status: [
        "scheduled",
        "live",
        "half_time",
        "full_time",
        "postponed",
        "walkover",
        "cancelled",
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
