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
      clothing_templates: {
        Row: {
          created_at: string
          item_id: string
          template_data_url: string
        }
        Insert: {
          created_at?: string
          item_id: string
          template_data_url: string
        }
        Update: {
          created_at?: string
          item_id?: string
          template_data_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "clothing_templates_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      friend_requests: {
        Row: {
          created_at: string
          id: string
          receiver_id: string
          sender_id: string
          status: Database["public"]["Enums"]["friend_request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_id: string
          sender_id: string
          status?: Database["public"]["Enums"]["friend_request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          receiver_id?: string
          sender_id?: string
          status?: Database["public"]["Enums"]["friend_request_status"]
          updated_at?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          id: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      item_accessories: {
        Row: {
          item_id: string
          mesh_b64: string | null
          meta: Json
          texture_data_url: string | null
          updated_at: string
        }
        Insert: {
          item_id: string
          mesh_b64?: string | null
          meta?: Json
          texture_data_url?: string | null
          updated_at?: string
        }
        Update: {
          item_id?: string
          mesh_b64?: string | null
          meta?: Json
          texture_data_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_accessories_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
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
      promocode_redemptions: {
        Row: {
          created_at: string
          id: string
          promocode_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          promocode_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          promocode_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promocode_redemptions_promocode_id_fkey"
            columns: ["promocode_id"]
            isOneToOne: false
            referencedRelation: "promocodes"
            referencedColumns: ["id"]
          },
        ]
      }
      promocodes: {
        Row: {
          code: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          item_id: string | null
          max_uses: number | null
          rawbux_reward: number
          updated_at: string
          uses: number
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          item_id?: string | null
          max_uses?: number | null
          rawbux_reward?: number
          updated_at?: string
          uses?: number
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          item_id?: string | null
          max_uses?: number | null
          rawbux_reward?: number
          updated_at?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "promocodes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          side: string
          trade_id: string
          user_item_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          side: string
          trade_id: string
          user_item_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          side?: string
          trade_id?: string
          user_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_items_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_items_user_item_id_fkey"
            columns: ["user_item_id"]
            isOneToOne: false
            referencedRelation: "user_items"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          created_at: string
          id: string
          receiver_id: string
          sender_id: string
          status: Database["public"]["Enums"]["trade_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_id: string
          sender_id: string
          status?: Database["public"]["Enums"]["trade_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          receiver_id?: string
          sender_id?: string
          status?: Database["public"]["Enums"]["trade_status"]
          updated_at?: string
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
      cancel_friend_request: { Args: { _request_id: string }; Returns: string }
      cancel_trade: { Args: { _trade_id: string }; Returns: string }
      change_username: { Args: { _new: string }; Returns: string }
      claim_daily: { Args: never; Returns: number }
      create_trade: {
        Args: { _offer: string[]; _receiver: string; _request: string[] }
        Returns: string
      }
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
      publish_clothing: {
        Args: {
          _description: string
          _kind: string
          _name: string
          _price: number
          _template: string
          _thumb: string
        }
        Returns: string
      }
      redeem_promocode: { Args: { _code: string }; Returns: string }
      remove_friend: { Args: { _other: string }; Returns: string }
      respond_friend_request: {
        Args: { _accept: boolean; _request_id: string }
        Returns: string
      }
      respond_trade: {
        Args: { _accept: boolean; _trade_id: string }
        Returns: string
      }
      save_avatar: {
        Args: { _colors: Json; _equipped: string[] }
        Returns: string
      }
      send_friend_request: { Args: { _target: string }; Returns: string }
      set_follow: {
        Args: { _follow: boolean; _target: string }
        Returns: string
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
      friend_request_status: "pending" | "accepted" | "declined" | "cancelled"
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
        | "shirt"
        | "pants"
        | "tshirt"
        | "head"
        | "torso"
        | "arm"
        | "leg"
      trade_status: "pending" | "accepted" | "declined" | "cancelled"
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
      friend_request_status: ["pending", "accepted", "declined", "cancelled"],
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
        "shirt",
        "pants",
        "tshirt",
        "head",
        "torso",
        "arm",
        "leg",
      ],
      trade_status: ["pending", "accepted", "declined", "cancelled"],
    },
  },
} as const
