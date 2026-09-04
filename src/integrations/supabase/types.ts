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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      attendance_records: {
        Row: {
          created_at: string
          id: string
          joined_at: string
          left_at: string | null
          member_id: string
          organization_id: string
          session_id: string
          source: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at: string
          left_at?: string | null
          member_id: string
          organization_id: string
          session_id: string
          source?: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          member_id?: string
          organization_id?: string
          session_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          activated_at: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          invite_token: string | null
          invited_at: string | null
          kind: Database["public"]["Enums"]["member_kind"]
          last_name: string
          organization_id: string
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          email: string
          first_name: string
          id?: string
          invite_token?: string | null
          invited_at?: string | null
          kind: Database["public"]["Enums"]["member_kind"]
          last_name: string
          organization_id: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          invite_token?: string | null
          invited_at?: string | null
          kind?: Database["public"]["Enums"]["member_kind"]
          last_name?: string
          organization_id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          position: number
          program_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          position?: number
          program_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          position?: number
          program_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modules_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_google_credentials: {
        Row: {
          organization_id: string
          google_account_email: string
          access_token_encrypted: string
          refresh_token_encrypted: string | null
          expires_at: string
          scope: string
          created_at: string
          updated_at: string
        }
        Insert: {
          organization_id: string
          google_account_email: string
          access_token_encrypted: string
          refresh_token_encrypted?: string | null
          expires_at: string
          scope: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          organization_id?: string
          google_account_email?: string
          access_token_encrypted?: string
          refresh_token_encrypted?: string | null
          expires_at?: string
          scope?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_google_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          early_leave_threshold: number
          google_account: string | null
          google_connected: boolean
          id: string
          late_threshold: number
          name: string
          partial_threshold: number
          present_threshold: number
          reconnection_threshold: number
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          early_leave_threshold?: number
          google_account?: string | null
          google_connected?: boolean
          id?: string
          late_threshold?: number
          name: string
          partial_threshold?: number
          present_threshold?: number
          reconnection_threshold?: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          early_leave_threshold?: number
          google_account?: string | null
          google_connected?: boolean
          id?: string
          late_threshold?: number
          name?: string
          partial_threshold?: number
          present_threshold?: number
          reconnection_threshold?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      program_participants: {
        Row: {
          created_at: string
          member_id: string
          organization_id: string
          program_id: string
        }
        Insert: {
          created_at?: string
          member_id: string
          organization_id: string
          program_id: string
        }
        Update: {
          created_at?: string
          member_id?: string
          organization_id?: string
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_participants_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_participants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_participants_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          archived: boolean
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          organization_id: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          organization_id: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          organization_id?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      session_participants: {
        Row: {
          created_at: string
          member_id: string
          organization_id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          member_id: string
          organization_id: string
          session_id: string
        }
        Update: {
          created_at?: string
          member_id?: string
          organization_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_participants_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          cancelled: boolean
          created_at: string
          end_time: string
          google_event_id: string | null
          id: string
          integration_error: string | null
          meeting_code: string | null
          meeting_url: string | null
          module_id: string
          name: string
          organization_id: string
          session_date: string
          start_time: string
          synced: boolean
          synced_at: string | null
          trainer_id: string | null
          updated_at: string
        }
        Insert: {
          cancelled?: boolean
          created_at?: string
          end_time: string
          google_event_id?: string | null
          id?: string
          integration_error?: string | null
          meeting_code?: string | null
          meeting_url?: string | null
          module_id: string
          name: string
          organization_id: string
          session_date: string
          start_time: string
          synced?: boolean
          synced_at?: string | null
          trainer_id?: string | null
          updated_at?: string
        }
        Update: {
          cancelled?: boolean
          created_at?: string
          end_time?: string
          google_event_id?: string | null
          id?: string
          integration_error?: string | null
          meeting_code?: string | null
          meeting_url?: string | null
          module_id?: string
          name?: string
          organization_id?: string
          session_date?: string
          start_time?: string
          synced?: boolean
          synced_at?: string | null
          trainer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_organization: {
        Args: { _name: string; _timezone?: string }
        Returns: string
      }
      current_org_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "ORGANISATION" | "FORMATEUR" | "PARTICIPANT"
      member_kind: "FORMATEUR" | "PARTICIPANT"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["ORGANISATION", "FORMATEUR", "PARTICIPANT"],
      member_kind: ["FORMATEUR", "PARTICIPANT"],
    },
  },
} as const
