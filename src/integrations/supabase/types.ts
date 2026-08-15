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
      calibration_responses: {
        Row: {
          collab_type: string
          created_at: string
          engagement_minutes: number
          id: string
          min_posts: number
          respondent_source: string
          warmup_days: number
        }
        Insert: {
          collab_type: string
          created_at?: string
          engagement_minutes: number
          id?: string
          min_posts: number
          respondent_source?: string
          warmup_days: number
        }
        Update: {
          collab_type?: string
          created_at?: string
          engagement_minutes?: number
          id?: string
          min_posts?: number
          respondent_source?: string
          warmup_days?: number
        }
        Relationships: []
      }
      calibration_results: {
        Row: {
          avg_engagement_minutes: number | null
          avg_min_posts: number | null
          avg_warmup_days: number | null
          collab_type: string
          response_count: number
          updated_at: string
        }
        Insert: {
          avg_engagement_minutes?: number | null
          avg_min_posts?: number | null
          avg_warmup_days?: number | null
          collab_type: string
          response_count?: number
          updated_at?: string
        }
        Update: {
          avg_engagement_minutes?: number | null
          avg_min_posts?: number | null
          avg_warmup_days?: number | null
          collab_type?: string
          response_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      collabs: {
        Row: {
          base_pay: number
          brand_name: string
          cpm_rate: number
          created_at: string
          daily_engagement_minutes: number
          id: string
          main_poc: string
          min_daily_posts: number
          pay_frequency: string
          social_accounts: string
          source: string
          start_date: string
          status: string
          user_id: string
          warmup_days: number
        }
        Insert: {
          base_pay?: number
          brand_name: string
          cpm_rate?: number
          created_at?: string
          daily_engagement_minutes?: number
          id?: string
          main_poc?: string
          min_daily_posts?: number
          pay_frequency?: string
          social_accounts?: string
          source?: string
          start_date?: string
          status?: string
          user_id: string
          warmup_days?: number
        }
        Update: {
          base_pay?: number
          brand_name?: string
          cpm_rate?: number
          created_at?: string
          daily_engagement_minutes?: number
          id?: string
          main_poc?: string
          min_daily_posts?: number
          pay_frequency?: string
          social_accounts?: string
          source?: string
          start_date?: string
          status?: string
          user_id?: string
          warmup_days?: number
        }
        Relationships: []
      }
      daily_logs: {
        Row: {
          collab_id: string
          created_at: string
          engaged: boolean
          id: string
          log_date: string
          notes: string | null
          posted_count: number
          warmed_up: boolean
        }
        Insert: {
          collab_id: string
          created_at?: string
          engaged?: boolean
          id?: string
          log_date?: string
          notes?: string | null
          posted_count?: number
          warmed_up?: boolean
        }
        Update: {
          collab_id?: string
          created_at?: string
          engaged?: boolean
          id?: string
          log_date?: string
          notes?: string | null
          posted_count?: number
          warmed_up?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_collab_id_fkey"
            columns: ["collab_id"]
            isOneToOne: false
            referencedRelation: "collabs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string | null
          reminder_enabled: boolean
          reminder_time: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string
          timezone: string | null
          trial_ends_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          name?: string
          phone?: string | null
          reminder_enabled?: boolean
          reminder_time?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          timezone?: string | null
          trial_ends_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          reminder_enabled?: boolean
          reminder_time?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          timezone?: string | null
          trial_ends_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      reminder_logs: {
        Row: {
          collab_ids_flagged: string
          id: string
          message: string | null
          sent_at: string
          user_id: string
        }
        Insert: {
          collab_ids_flagged?: string
          id?: string
          message?: string | null
          sent_at?: string
          user_id: string
        }
        Update: {
          collab_ids_flagged?: string
          id?: string
          message?: string | null
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      view_logs: {
        Row: {
          collab_id: string
          day_number: number
          id: string
          logged_at: string
          view_count: number
        }
        Insert: {
          collab_id: string
          day_number: number
          id?: string
          logged_at?: string
          view_count?: number
        }
        Update: {
          collab_id?: string
          day_number?: number
          id?: string
          logged_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "view_logs_collab_id_fkey"
            columns: ["collab_id"]
            isOneToOne: false
            referencedRelation: "collabs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      recompute_calibration: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
