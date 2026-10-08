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
      items: {
        Row: {
          class: Database["public"]["Enums"]["item_class"]
          copies_sold: number
          created_at: string
          creator_id: string | null
          description: string
          id: string
          image_url: string | null
          kind: Database["public"]["Enums"]["item_kind"]
          name: string
          price: number
          rap: number
          sale_ends_at: string | null
          stock: number | null
          value: number
        }
        Insert: {
          class?: Database["public"]["Enums"]["item_class"]
          copies_sold?: number
          created_at?: string
          creator_id?: string | null
          description?: string
          id?: string
          image_url?: string | null
          kind: Database["public"]["Enums"]["item_kind"]
          name: string
          price?: number
          rap?: number
          sale_ends_at?: string | null
          stock?: number | null
          value?: number
        }
        Update: {
          class?: Database["public"]["Enums"]["item_class"]
          copies_sold?: number
          created_at?: string
          creator_id?: string | null
          description?: string
          id?: string
          image_url?: string | null
          kind?: Database["public"]["Enums"]["item_kind"]
          name?: string
          price?: number
          rap?: number
          sale_ends_at?: string | null
          stock?: number | null
          value?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_colors: Json
          ban_reason: string | null
          ban_until: string | null
          created_at: string
          description: string
          equipped_items: string[]
          id: string
          inventory_private: boolean
          is_banned: boolean
          last_daily_at: string
          rawbux: number
          username: string
        }
        Insert: {
          avatar_colors?: Json
          ban_reason?: string | null
          ban_until?: string | null
          created_at?: string
          description?: string
          equipped_items?: string[]
          id: string
          inventory_private?: boolean
          is_banned?: boolean
          last_daily_at?: string
          rawbux?: number
          username: string
        }
        Update: {
          avatar_colors?: Json
          ban_reason?: string | null
          ban_until?: string | null
          created_at?: string
          description?: string
          equipped_items?: string[]
          id?: string
          inventory_private?: boolean
          is_banned?: boolean
          last_daily_at?: string
          rawbux?: number
          username?: string
        }
        Relationships: []
      }
      user_items: {
        Row: {
          acquired_at: string
          id: string
          item_id: string
          sale_price: number | null
          serial: number | null
          user_id: string
        }
        Insert: {
          acquired_at?: string
          id?: string
          item_id: string
          sale_price?: number | null
          serial?: number | null
          user_id: string
        }
        Update: {
          acquired_at?: string
          id?: string
          item_id?: string
          sale_price?: number | null
          serial?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      buy_item: { Args: { _item_id: string }; Returns: string }
      change_username: { Args: { _new: string }; Returns: string }
      claim_daily: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      inventory_is_private: { Args: { _user_id: string }; Returns: boolean }
      item_is_limited: {
        Args: { _item: Database["public"]["Tables"]["items"]["Row"] }
        Returns: boolean
      }
      set_inventory_private: { Args: { _private: boolean }; Returns: string }
      set_resale: {
        Args: { _price: number; _user_item_id: string }
        Returns: string
      }
      update_description: { Args: { _desc: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "user"
      item_class: "normal" | "limited" | "limitedu"
      item_kind:
        | "hat"
        | "hair"
        | "face"
        | "neck"
        | "shoulder"
        | "front"
        | "back"
        | "waist"
        | "gear"
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
      app_role: ["admin", "user"],
      item_class: ["normal", "limited", "limitedu"],
      item_kind: [
        "hat",
        "hair",
        "face",
        "neck",
        "shoulder",
        "front",
        "back",
        "waist",
        "gear",
      ],
    },
  },
} as const
