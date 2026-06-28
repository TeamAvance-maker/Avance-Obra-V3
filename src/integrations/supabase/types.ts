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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      deletion_log: {
        Row: {
          action: string
          batch_id: string
          changes: Json | null
          created_at: string
          deleted_at: string
          deleted_by: string
          id: string
          parent_id: string | null
          parent_table: string | null
          reason: string | null
          record_id: string
          record_label: string | null
          record_snapshot: Json
          table_name: string
        }
        Insert: {
          action?: string
          batch_id: string
          changes?: Json | null
          created_at?: string
          deleted_at?: string
          deleted_by?: string
          id?: string
          parent_id?: string | null
          parent_table?: string | null
          reason?: string | null
          record_id: string
          record_label?: string | null
          record_snapshot: Json
          table_name: string
        }
        Update: {
          action?: string
          batch_id?: string
          changes?: Json | null
          created_at?: string
          deleted_at?: string
          deleted_by?: string
          id?: string
          parent_id?: string | null
          parent_table?: string | null
          reason?: string | null
          record_id?: string
          record_label?: string | null
          record_snapshot?: Json
          table_name?: string
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          created_at: string
          date: string
          id: string
          mode: Database["public"]["Enums"]["delivery_mode"]
          note: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          mode: Database["public"]["Enums"]["delivery_mode"]
          note?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          mode?: Database["public"]["Enums"]["delivery_mode"]
          note?: string
        }
        Relationships: []
      }
      delivery_houses: {
        Row: {
          delivery_id: string
          house_type_code: string
          id: string
          qty: number
        }
        Insert: {
          delivery_id: string
          house_type_code: string
          id?: string
          qty: number
        }
        Update: {
          delivery_id?: string
          house_type_code?: string
          id?: string
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_houses_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_houses_house_type_code_fkey"
            columns: ["house_type_code"]
            isOneToOne: false
            referencedRelation: "house_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "delivery_houses_house_type_code_fkey"
            columns: ["house_type_code"]
            isOneToOne: false
            referencedRelation: "v_houses_executed"
            referencedColumns: ["house_type_code"]
          },
        ]
      }
      delivery_items: {
        Row: {
          delivery_id: string
          handedness: Database["public"]["Enums"]["handedness"]
          id: string
          material_code: string
          qty: number
        }
        Insert: {
          delivery_id: string
          handedness?: Database["public"]["Enums"]["handedness"]
          id?: string
          material_code: string
          qty: number
        }
        Update: {
          delivery_id?: string
          handedness?: Database["public"]["Enums"]["handedness"]
          id?: string
          material_code?: string
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_material_code_fkey"
            columns: ["material_code"]
            isOneToOne: false
            referencedRelation: "materials_v2"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "delivery_items_material_code_fkey"
            columns: ["material_code"]
            isOneToOne: false
            referencedRelation: "v_delivered"
            referencedColumns: ["material_code"]
          },
          {
            foreignKeyName: "delivery_items_material_code_fkey"
            columns: ["material_code"]
            isOneToOne: false
            referencedRelation: "v_required"
            referencedColumns: ["material_code"]
          },
        ]
      }
      house_exec_overrides: {
        Row: {
          created_at: string
          date: string
          delta: number
          house_type_code: string
          id: string
          reason: string
        }
        Insert: {
          created_at?: string
          date?: string
          delta: number
          house_type_code: string
          id?: string
          reason?: string
        }
        Update: {
          created_at?: string
          date?: string
          delta?: number
          house_type_code?: string
          id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "house_exec_overrides_house_type_code_fkey"
            columns: ["house_type_code"]
            isOneToOne: false
            referencedRelation: "house_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "house_exec_overrides_house_type_code_fkey"
            columns: ["house_type_code"]
            isOneToOne: false
            referencedRelation: "v_houses_executed"
            referencedColumns: ["house_type_code"]
          },
        ]
      }
      house_material_req: {
        Row: {
          handedness: Database["public"]["Enums"]["handedness"]
          house_type_code: string
          id: string
          material_code: string
          qty: number
        }
        Insert: {
          handedness?: Database["public"]["Enums"]["handedness"]
          house_type_code: string
          id?: string
          material_code: string
          qty: number
        }
        Update: {
          handedness?: Database["public"]["Enums"]["handedness"]
          house_type_code?: string
          id?: string
          material_code?: string
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "house_material_req_house_type_code_fkey"
            columns: ["house_type_code"]
            isOneToOne: false
            referencedRelation: "house_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "house_material_req_house_type_code_fkey"
            columns: ["house_type_code"]
            isOneToOne: false
            referencedRelation: "v_houses_executed"
            referencedColumns: ["house_type_code"]
          },
        ]
      }
      house_types: {
        Row: {
          code: string
          created_at: string
          name: string
          qty: number
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          name?: string
          qty?: number
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          name?: string
          qty?: number
          sort_order?: number
        }
        Relationships: []
      }
      inventory_adjustments: {
        Row: {
          applied_at: string
          count_id: string | null
          counted_qty: number
          created_at: string
          date: string
          delta: number
          handedness: Database["public"]["Enums"]["handedness"]
          id: string
          material_code: string
          note: string | null
          prev_system_qty: number
        }
        Insert: {
          applied_at?: string
          count_id?: string | null
          counted_qty: number
          created_at?: string
          date?: string
          delta: number
          handedness?: Database["public"]["Enums"]["handedness"]
          id?: string
          material_code: string
          note?: string | null
          prev_system_qty: number
        }
        Update: {
          applied_at?: string
          count_id?: string | null
          counted_qty?: number
          created_at?: string
          date?: string
          delta?: number
          handedness?: Database["public"]["Enums"]["handedness"]
          id?: string
          material_code?: string
          note?: string | null
          prev_system_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustments_count_id_fkey"
            columns: ["count_id"]
            isOneToOne: false
            referencedRelation: "inventory_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustments_material_code_fkey"
            columns: ["material_code"]
            isOneToOne: false
            referencedRelation: "materials_v2"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "inventory_adjustments_material_code_fkey"
            columns: ["material_code"]
            isOneToOne: false
            referencedRelation: "v_delivered"
            referencedColumns: ["material_code"]
          },
          {
            foreignKeyName: "inventory_adjustments_material_code_fkey"
            columns: ["material_code"]
            isOneToOne: false
            referencedRelation: "v_required"
            referencedColumns: ["material_code"]
          },
        ]
      }
      inventory_counts: {
        Row: {
          adjustment_applied: boolean
          counted_qty: number
          created_at: string
          date: string
          handedness: Database["public"]["Enums"]["handedness"]
          id: string
          material_code: string
          note: string
        }
        Insert: {
          adjustment_applied?: boolean
          counted_qty: number
          created_at?: string
          date?: string
          handedness?: Database["public"]["Enums"]["handedness"]
          id?: string
          material_code: string
          note?: string
        }
        Update: {
          adjustment_applied?: boolean
          counted_qty?: number
          created_at?: string
          date?: string
          handedness?: Database["public"]["Enums"]["handedness"]
          id?: string
          material_code?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_counts_material_code_fkey"
            columns: ["material_code"]
            isOneToOne: false
            referencedRelation: "materials_v2"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "inventory_counts_material_code_fkey"
            columns: ["material_code"]
            isOneToOne: false
            referencedRelation: "v_delivered"
            referencedColumns: ["material_code"]
          },
          {
            foreignKeyName: "inventory_counts_material_code_fkey"
            columns: ["material_code"]
            isOneToOne: false
            referencedRelation: "v_required"
            referencedColumns: ["material_code"]
          },
        ]
      }
      materials_v2: {
        Row: {
          code: string
          created_at: string
          description: string
          id: string
          sort_order: number
          tracks_handedness: boolean
          unit: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          id?: string
          sort_order?: number
          tracks_handedness?: boolean
          unit?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          id?: string
          sort_order?: number
          tracks_handedness?: boolean
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_config: {
        Row: {
          critical_stock_threshold: number
          id: number
          name: string
          total_houses: number
          updated_at: string
        }
        Insert: {
          critical_stock_threshold?: number
          id?: number
          name?: string
          total_houses?: number
          updated_at?: string
        }
        Update: {
          critical_stock_threshold?: number
          id?: number
          name?: string
          total_houses?: number
          updated_at?: string
        }
        Relationships: []
      }
      receptions: {
        Row: {
          created_at: string
          date: string
          guia: string
          handedness: Database["public"]["Enums"]["handedness"]
          id: string
          material_code: string
          qty: number
        }
        Insert: {
          created_at?: string
          date?: string
          guia?: string
          handedness?: Database["public"]["Enums"]["handedness"]
          id?: string
          material_code: string
          qty: number
        }
        Update: {
          created_at?: string
          date?: string
          guia?: string
          handedness?: Database["public"]["Enums"]["handedness"]
          id?: string
          material_code?: string
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "receptions_material_code_fkey"
            columns: ["material_code"]
            isOneToOne: false
            referencedRelation: "materials_v2"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "receptions_material_code_fkey"
            columns: ["material_code"]
            isOneToOne: false
            referencedRelation: "v_delivered"
            referencedColumns: ["material_code"]
          },
          {
            foreignKeyName: "receptions_material_code_fkey"
            columns: ["material_code"]
            isOneToOne: false
            referencedRelation: "v_required"
            referencedColumns: ["material_code"]
          },
        ]
      }
      site_deliveries: {
        Row: {
          created_at: string
          date: string
          id: string
          mode: string
          note: string
          site_id: string
          vale_stage_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          mode?: string
          note?: string
          site_id: string
          vale_stage_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          mode?: string
          note?: string
          site_id?: string
          vale_stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_deliveries_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_deliveries_vale_stage_id_fkey"
            columns: ["vale_stage_id"]
            isOneToOne: false
            referencedRelation: "vale_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      site_delivery_items: {
        Row: {
          created_at: string
          delivery_id: string
          id: string
          material_id: string
          qty: number
        }
        Insert: {
          created_at?: string
          delivery_id: string
          id?: string
          material_id: string
          qty: number
        }
        Update: {
          created_at?: string
          delivery_id?: string
          id?: string
          material_id?: string
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "site_delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "site_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_delivery_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          created_at: string
          house_type: Database["public"]["Enums"]["house_type_v2"]
          id: string
          manzana: number
          sitio: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          house_type: Database["public"]["Enums"]["house_type_v2"]
          id?: string
          manzana: number
          sitio: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          house_type?: Database["public"]["Enums"]["house_type_v2"]
          id?: string
          manzana?: number
          sitio?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vale_reqs: {
        Row: {
          created_at: string
          house_type: Database["public"]["Enums"]["house_type_v2"]
          id: string
          material_id: string
          qty: number
          vale_stage_id: string
        }
        Insert: {
          created_at?: string
          house_type: Database["public"]["Enums"]["house_type_v2"]
          id?: string
          material_id: string
          qty: number
          vale_stage_id: string
        }
        Update: {
          created_at?: string
          house_type?: Database["public"]["Enums"]["house_type_v2"]
          id?: string
          material_id?: string
          qty?: number
          vale_stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vale_reqs_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vale_reqs_vale_stage_id_fkey"
            columns: ["vale_stage_id"]
            isOneToOne: false
            referencedRelation: "vale_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      vale_stages: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          stage_number: number
          vale_type_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          stage_number?: number
          vale_type_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          stage_number?: number
          vale_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vale_stages_vale_type_id_fkey"
            columns: ["vale_type_id"]
            isOneToOne: false
            referencedRelation: "vale_types_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      vale_types_v2: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          section: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          section?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          section?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_delivered: {
        Row: {
          handedness: Database["public"]["Enums"]["handedness"] | null
          material_code: string | null
          qty: number | null
        }
        Relationships: []
      }
      v_houses_executed: {
        Row: {
          house_type_code: string | null
          qty: number | null
        }
        Relationships: []
      }
      v_received: {
        Row: {
          handedness: Database["public"]["Enums"]["handedness"] | null
          material_code: string | null
          qty: number | null
        }
        Relationships: [
          {
            foreignKeyName: "receptions_material_code_fkey"
            columns: ["material_code"]
            isOneToOne: false
            referencedRelation: "materials_v2"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "receptions_material_code_fkey"
            columns: ["material_code"]
            isOneToOne: false
            referencedRelation: "v_delivered"
            referencedColumns: ["material_code"]
          },
          {
            foreignKeyName: "receptions_material_code_fkey"
            columns: ["material_code"]
            isOneToOne: false
            referencedRelation: "v_required"
            referencedColumns: ["material_code"]
          },
        ]
      }
      v_required: {
        Row: {
          handedness: Database["public"]["Enums"]["handedness"] | null
          material_code: string | null
          qty: number | null
        }
        Relationships: []
      }
      v_stock: {
        Row: {
          handedness: Database["public"]["Enums"]["handedness"] | null
          material_code: string | null
          qty: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "superadmin" | "user"
      delivery_mode: "manual" | "by_house"
      handedness: "left" | "right" | "none"
      house_type_v2: "A1" | "A2" | "B" | "C"
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
      app_role: ["superadmin", "user"],
      delivery_mode: ["manual", "by_house"],
      handedness: ["left", "right", "none"],
      house_type_v2: ["A1", "A2", "B", "C"],
    },
  },
} as const
