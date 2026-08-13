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
      bank_accounts: {
        Row: {
          account_id: string | null
          balance: number
          created_at: string
          id: string
          is_active: boolean
          kind: string
          name: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          balance?: number
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          balance?: number
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          code: string
          created_at: string
          id: string
          is_system: boolean
          name: string
          type: Database["public"]["Enums"]["account_type"]
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_system?: boolean
          name: string
          type: Database["public"]["Enums"]["account_type"]
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_system?: boolean
          name?: string
          type?: Database["public"]["Enums"]["account_type"]
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          company: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          bank_account_id: string
          created_at: string
          created_by: string | null
          description: string
          expense_account_id: string
          expense_date: string
          id: string
        }
        Insert: {
          amount: number
          bank_account_id: string
          created_at?: string
          created_by?: string | null
          description: string
          expense_account_id: string
          expense_date?: string
          id?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          expense_account_id?: string
          expense_date?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          line_total: number
          product_id: string | null
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          line_total?: number
          product_id?: string | null
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number
          product_id?: string | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          bank_account_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          discount_amount: number
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          stock_committed: boolean
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          updated_at: string
        }
        Insert: {
          bank_account_id?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          stock_committed?: boolean
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Update: {
          bank_account_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          stock_committed?: boolean
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          created_by: string | null
          entry_date: string
          id: string
          memo: string | null
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          memo?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          memo?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: []
      }
      journal_lines: {
        Row: {
          account_id: string
          created_at: string
          credit: number
          debit: number
          entry_id: string
          id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          credit?: number
          debit?: number
          entry_id: string
          id?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          credit?: number
          debit?: number
          entry_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_run_items: {
        Row: {
          gross_pay: number
          id: string
          run_id: string
          user_id: string
        }
        Insert: {
          gross_pay?: number
          id?: string
          run_id: string
          user_id: string
        }
        Update: {
          gross_pay?: number
          id?: string
          run_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_run_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          bank_account_id: string
          id: string
          period_month: string
          run_at: string
          run_by: string | null
          total_gross: number
        }
        Insert: {
          bank_account_id: string
          id?: string
          period_month: string
          run_at?: string
          run_by?: string | null
          total_gross?: number
        }
        Update: {
          bank_account_id?: string
          id?: string
          period_month?: string
          run_at?: string
          run_by?: string | null
          total_gross?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      product_documents: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          product_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          product_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          product_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          product_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          product_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          product_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          low_stock_threshold: number
          name: string
          quantity: number
          selling_price: number
          sku: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          low_stock_threshold?: number
          name: string
          quantity?: number
          selling_price?: number
          sku: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          low_stock_threshold?: number
          name?: string
          quantity?: number
          selling_price?: number
          sku?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      receipts: {
        Row: {
          amount_paid: number
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          paid_at: string
          payment_method: string | null
          receipt_number: string
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          paid_at?: string
          payment_method?: string | null
          receipt_number: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          paid_at?: string
          payment_method?: string | null
          receipt_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_payroll: {
        Row: {
          active: boolean
          base_salary: number
          created_at: string
          hourly_rate: number
          hours_per_month: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          base_salary?: number
          created_at?: string
          hourly_rate?: number
          hours_per_month?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          base_salary?: number
          created_at?: string
          hourly_rate?: number
          hours_per_month?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tax_settings: {
        Row: {
          id: boolean
          rate: number
          updated_at: string
        }
        Insert: {
          id?: boolean
          rate?: number
          updated_at?: string
        }
        Update: {
          id?: boolean
          rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      product_status: {
        Args: { _qty: number; _threshold: number }
        Returns: string
      }
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "revenue" | "expense"
      app_role: "admin" | "staff"
      invoice_status: "draft" | "sent" | "overdue" | "paid" | "cancelled"
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
      account_type: ["asset", "liability", "equity", "revenue", "expense"],
      app_role: ["admin", "staff"],
      invoice_status: ["draft", "sent", "overdue", "paid", "cancelled"],
    },
  },
} as const
