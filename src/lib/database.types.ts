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
      calculations: {
        Row: {
          created_at: string
          id: string
          input: string
          kind: string
          result: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          input?: string
          kind?: string
          result?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          input?: string
          kind?: string
          result?: string
          user_id?: string
        }
        Relationships: []
      }
      concepts: {
        Row: {
          created_at: string
          discipline: string
          examples: string
          explanation: string
          favorite: boolean
          formalism: string
          id: string
          last_viewed_at: string | null
          observations: string
          related_ids: string[]
          seed: boolean
          summary: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          discipline?: string
          examples?: string
          explanation?: string
          favorite?: boolean
          formalism?: string
          id: string
          last_viewed_at?: string | null
          observations?: string
          related_ids?: string[]
          seed?: boolean
          summary?: string
          tags?: string[]
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          discipline?: string
          examples?: string
          explanation?: string
          favorite?: boolean
          formalism?: string
          id?: string
          last_viewed_at?: string | null
          observations?: string
          related_ids?: string[]
          seed?: boolean
          summary?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dev_problems: {
        Row: {
          created_at: string
          id: string
          kind: string
          lang: string
          mode: Database["public"]["Enums"]["devlab_mode"]
          revealed: number
          stage: string
          strategy: string
          text: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          kind?: string
          lang?: string
          mode?: Database["public"]["Enums"]["devlab_mode"]
          revealed?: number
          stage?: string
          strategy?: string
          text?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          lang?: string
          mode?: Database["public"]["Enums"]["devlab_mode"]
          revealed?: number
          stage?: string
          strategy?: string
          text?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      formulas: {
        Row: {
          concept_ids: string[]
          created_at: string
          description: string
          discipline: string
          eval_expression: string
          eval_target: string
          example: string
          id: string
          latex: string
          name: string
          result_unit: string
          seed: boolean
          tags: string[]
          tool_path: string | null
          updated_at: string
          user_id: string
          variables: Json
        }
        Insert: {
          concept_ids?: string[]
          created_at?: string
          description?: string
          discipline?: string
          eval_expression?: string
          eval_target?: string
          example?: string
          id: string
          latex?: string
          name: string
          result_unit?: string
          seed?: boolean
          tags?: string[]
          tool_path?: string | null
          updated_at?: string
          user_id?: string
          variables?: Json
        }
        Update: {
          concept_ids?: string[]
          created_at?: string
          description?: string
          discipline?: string
          eval_expression?: string
          eval_target?: string
          example?: string
          id?: string
          latex?: string
          name?: string
          result_unit?: string
          seed?: boolean
          tags?: string[]
          tool_path?: string | null
          updated_at?: string
          user_id?: string
          variables?: Json
        }
        Relationships: []
      }
      kv: {
        Row: {
          key: string
          user_id: string
          value: Json
        }
        Insert: {
          key: string
          user_id?: string
          value: Json
        }
        Update: {
          key?: string
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
      notes: {
        Row: {
          calculation_ids: string[]
          concept_ids: string[]
          content: string
          created_at: string
          favorite: boolean
          formula_ids: string[]
          id: string
          subject_id: string | null
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          calculation_ids?: string[]
          concept_ids?: string[]
          content?: string
          created_at?: string
          favorite?: boolean
          formula_ids?: string[]
          id: string
          subject_id?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          calculation_ids?: string[]
          concept_ids?: string[]
          content?: string
          created_at?: string
          favorite?: boolean
          formula_ids?: string[]
          id?: string
          subject_id?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          answer: string
          concept_id: string | null
          created_at: string
          id: string
          note_id: string | null
          resolved: boolean
          resolved_at: string | null
          text: string
          user_id: string
        }
        Insert: {
          answer?: string
          concept_id?: string | null
          created_at?: string
          id: string
          note_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          text: string
          user_id?: string
        }
        Update: {
          answer?: string
          concept_id?: string | null
          created_at?: string
          id?: string
          note_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          duration_ms: number
          ended_at: string
          id: string
          phase: Database["public"]["Enums"]["session_phase"]
          started_at: string
          subject_id: string | null
          task_id: string | null
          user_id: string
        }
        Insert: {
          duration_ms: number
          ended_at: string
          id: string
          phase: Database["public"]["Enums"]["session_phase"]
          started_at: string
          subject_id?: string | null
          task_id?: string | null
          user_id?: string
        }
        Update: {
          duration_ms?: number
          ended_at?: string
          id?: string
          phase?: Database["public"]["Enums"]["session_phase"]
          started_at?: string
          subject_id?: string | null
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      sketches: {
        Row: {
          background: string
          created_at: string
          id: string
          strokes: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          background?: string
          created_at?: string
          id: string
          strokes?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          background?: string
          created_at?: string
          id?: string
          strokes?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          name: string
          notes: string
          objectives: string
          period: string
          seed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id: string
          name: string
          notes?: string
          objectives?: string
          period?: string
          seed?: boolean
          updated_at?: string
          user_id?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          name?: string
          notes?: string
          objectives?: string
          period?: string
          seed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          details: string
          done: boolean
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["priority"]
          project: string
          subject_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          details?: string
          done?: boolean
          due_date?: string | null
          id: string
          priority?: Database["public"]["Enums"]["priority"]
          project?: string
          subject_id?: string | null
          title: string
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          details?: string
          done?: boolean
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["priority"]
          project?: string
          subject_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      tools: {
        Row: {
          description: string
          id: string
          name: string
          seed: boolean
          sort_order: number
          url: string
          user_id: string
        }
        Insert: {
          description?: string
          id: string
          name: string
          seed?: boolean
          sort_order?: number
          url: string
          user_id?: string
        }
        Update: {
          description?: string
          id?: string
          name?: string
          seed?: boolean
          sort_order?: number
          url?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      devlab_mode: "guided" | "consult"
      priority: "low" | "medium" | "high"
      session_phase: "work" | "short" | "long"
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
      devlab_mode: ["guided", "consult"],
      priority: ["low", "medium", "high"],
      session_phase: ["work", "short", "long"],
    },
  },
} as const
