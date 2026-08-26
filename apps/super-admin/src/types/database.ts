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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      absence_reasons: {
        Row: {
          code: string
          deducts: boolean
          id: string
          is_active: boolean
          name: string
          school_id: string
          sort_order: number
        }
        Insert: {
          code: string
          deducts?: boolean
          id?: string
          is_active?: boolean
          name: string
          school_id: string
          sort_order?: number
        }
        Update: {
          code?: string
          deducts?: boolean
          id?: string
          is_active?: boolean
          name?: string
          school_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "absence_reasons_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      absences: {
        Row: {
          branch_id: string
          day: string
          id: string
          marked_at: string
          marked_by: string | null
          note: string | null
          reason_id: string | null
          school_id: string
          service_id: string | null
          student_id: string
        }
        Insert: {
          branch_id: string
          day: string
          id?: string
          marked_at?: string
          marked_by?: string | null
          note?: string | null
          reason_id?: string | null
          school_id: string
          service_id?: string | null
          student_id: string
        }
        Update: {
          branch_id?: string
          day?: string
          id?: string
          marked_at?: string
          marked_by?: string | null
          note?: string | null
          reason_id?: string | null
          school_id?: string
          service_id?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "absences_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_reason_id_fkey"
            columns: ["reason_id"]
            isOneToOne: false
            referencedRelation: "absence_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_balances"
            referencedColumns: ["student_id"]
          },
        ]
      }
      app_users: {
        Row: {
          all_branches: boolean
          created_at: string
          deleted_at: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          lang: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          school_id: string
          updated_at: string
        }
        Insert: {
          all_branches?: boolean
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name: string
          id: string
          is_active?: boolean
          lang?: string
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
          school_id: string
          updated_at?: string
        }
        Update: {
          all_branches?: boolean
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          lang?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_users_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_checks: {
        Row: {
          absent_count: number
          branch_id: string
          class_name: string
          day: string
          marked_at: string
          marked_by: string | null
          school_id: string
        }
        Insert: {
          absent_count?: number
          branch_id: string
          class_name: string
          day: string
          marked_at?: string
          marked_by?: string | null
          school_id: string
        }
        Update: {
          absent_count?: number
          branch_id?: string
          class_name?: string
          day?: string
          marked_at?: string
          marked_by?: string | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_checks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_checks_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_checks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          after: Json | null
          at: string
          before: Json | null
          changed_keys: string[] | null
          id: number
          impersonated_by: string | null
          record_id: string | null
          school_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          after?: Json | null
          at?: string
          before?: Json | null
          changed_keys?: string[] | null
          id?: never
          impersonated_by?: string | null
          record_id?: string | null
          school_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          after?: Json | null
          at?: string
          before?: Json | null
          changed_keys?: string[] | null
          id?: never
          impersonated_by?: string | null
          record_id?: string | null
          school_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bank_statement_rows: {
        Row: {
          amount: number
          created_at: string
          doc_no: string | null
          id: string
          match_kind: string | null
          matched_at: string | null
          matched_by: string | null
          paid_on: string
          payer_name: string | null
          payment_code: string | null
          payment_id: string | null
          purpose: string | null
          row_no: number
          school_id: string
          statement_id: string
          student_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          doc_no?: string | null
          id?: string
          match_kind?: string | null
          matched_at?: string | null
          matched_by?: string | null
          paid_on: string
          payer_name?: string | null
          payment_code?: string | null
          payment_id?: string | null
          purpose?: string | null
          row_no: number
          school_id: string
          statement_id: string
          student_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          doc_no?: string | null
          id?: string
          match_kind?: string | null
          matched_at?: string | null
          matched_by?: string | null
          paid_on?: string
          payer_name?: string | null
          payment_code?: string | null
          payment_id?: string | null
          purpose?: string | null
          row_no?: number
          school_id?: string
          statement_id?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_statement_rows_matched_by_fkey"
            columns: ["matched_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_rows_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_rows_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_rows_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "bank_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_rows_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_rows_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_balances"
            referencedColumns: ["student_id"]
          },
        ]
      }
      bank_statements: {
        Row: {
          branch_id: string
          error: string | null
          file_hash: string | null
          file_name: string
          file_path: string
          id: string
          period_from: string | null
          period_to: string | null
          processed_at: string | null
          rows_matched: number
          rows_total: number
          school_id: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          branch_id: string
          error?: string | null
          file_hash?: string | null
          file_name: string
          file_path: string
          id?: string
          period_from?: string | null
          period_to?: string | null
          processed_at?: string | null
          rows_matched?: number
          rows_total?: number
          school_id: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          branch_id?: string
          error?: string | null
          file_hash?: string | null
          file_name?: string
          file_path?: string
          id?: string
          period_from?: string | null
          period_to?: string | null
          processed_at?: string | null
          rows_matched?: number
          rows_total?: number
          school_id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_statements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statements_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          is_default: boolean
          manager_name: string | null
          name: string
          phone: string | null
          school_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          manager_name?: string | null
          name: string
          phone?: string | null
          school_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          manager_name?: string | null
          name?: string
          phone?: string | null
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_days: {
        Row: {
          branch_id: string | null
          created_at: string
          day: string
          day_type: Database["public"]["Enums"]["calendar_day_type"]
          name: string | null
          school_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          day: string
          day_type: Database["public"]["Enums"]["calendar_day_type"]
          name?: string | null
          school_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          day?: string
          day_type?: Database["public"]["Enums"]["calendar_day_type"]
          name?: string | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_days_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_days_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_receipts: {
        Row: {
          branch_id: string
          cancelled_at: string | null
          id: string
          issued_at: string
          issued_by: string | null
          payment_id: string
          receipt_code: string
          receipt_no: number
          school_id: string
        }
        Insert: {
          branch_id: string
          cancelled_at?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          payment_id: string
          receipt_code: string
          receipt_no: number
          school_id: string
        }
        Update: {
          branch_id?: string
          cancelled_at?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          payment_id?: string
          receipt_code?: string
          receipt_no?: number
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_receipts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_receipts_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_receipts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_receipts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          academic_year: string
          branch_id: string
          capacity: number | null
          created_at: string
          deleted_at: string | null
          grade_level: number | null
          id: string
          is_active: boolean
          name: string
          note: string | null
          school_id: string
          teacher_id: string | null
          updated_at: string
        }
        Insert: {
          academic_year: string
          branch_id: string
          capacity?: number | null
          created_at?: string
          deleted_at?: string | null
          grade_level?: number | null
          id?: string
          is_active?: boolean
          name: string
          note?: string | null
          school_id: string
          teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          academic_year?: string
          branch_id?: string
          capacity?: number | null
          created_at?: string
          deleted_at?: string | null
          grade_level?: number | null
          id?: string
          is_active?: boolean
          name?: string
          note?: string | null
          school_id?: string
          teacher_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      closed_periods: {
        Row: {
          branch_id: string | null
          closed_at: string
          closed_by: string | null
          id: string
          note: string | null
          period: string
          school_id: string
        }
        Insert: {
          branch_id?: string | null
          closed_at?: string
          closed_by?: string | null
          id?: string
          note?: string | null
          period: string
          school_id: string
        }
        Update: {
          branch_id?: string | null
          closed_at?: string
          closed_by?: string | null
          id?: string
          note?: string | null
          period?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "closed_periods_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closed_periods_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closed_periods_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_versions: {
        Row: {
          changed_at: string
          changed_by: string | null
          contract_id: string
          id: number
          school_id: string
          snapshot: Json
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          contract_id: string
          id?: never
          school_id: string
          snapshot: Json
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          contract_id?: string
          id?: never
          school_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "contract_versions_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_versions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          billing_months: number
          created_at: string
          discount_kind: Database["public"]["Enums"]["discount_kind"] | null
          discount_type_id: string | null
          discount_value: number | null
          due_day: number
          ends_on: string | null
          id: string
          is_active: boolean
          note: string | null
          number: string
          school_id: string
          signed_on: string
          starts_on: string
          student_id: string
          tuition_amount: number
          updated_at: string
        }
        Insert: {
          billing_months?: number
          created_at?: string
          discount_kind?: Database["public"]["Enums"]["discount_kind"] | null
          discount_type_id?: string | null
          discount_value?: number | null
          due_day?: number
          ends_on?: string | null
          id?: string
          is_active?: boolean
          note?: string | null
          number: string
          school_id: string
          signed_on?: string
          starts_on: string
          student_id: string
          tuition_amount?: number
          updated_at?: string
        }
        Update: {
          billing_months?: number
          created_at?: string
          discount_kind?: Database["public"]["Enums"]["discount_kind"] | null
          discount_type_id?: string | null
          discount_value?: number | null
          due_day?: number
          ends_on?: string | null
          id?: string
          is_active?: boolean
          note?: string | null
          number?: string
          school_id?: string
          signed_on?: string
          starts_on?: string
          student_id?: string
          tuition_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_discount_type_id_fkey"
            columns: ["discount_type_id"]
            isOneToOne: false
            referencedRelation: "discount_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_balances"
            referencedColumns: ["student_id"]
          },
        ]
      }
      counters: {
        Row: {
          kind: string
          school_id: string
          scope_id: string
          value: number
        }
        Insert: {
          kind: string
          school_id: string
          scope_id: string
          value?: number
        }
        Update: {
          kind?: string
          school_id?: string
          scope_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "counters_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_types: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["discount_kind"]
          name: string
          school_id: string
          updated_at: string
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["discount_kind"]
          name: string
          school_id: string
          updated_at?: string
          value?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["discount_kind"]
          name?: string
          school_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "discount_types_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          school_id: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          school_id: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          school_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          branch_id: string
          category_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          document_path: string | null
          id: string
          note: string | null
          payment_method: string
          payroll_run_id: string | null
          school_id: string
          spent_on: string
          updated_at: string
        }
        Insert: {
          amount: number
          branch_id: string
          category_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_path?: string | null
          id?: string
          note?: string | null
          payment_method?: string
          payroll_run_id?: string | null
          school_id: string
          spent_on?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          branch_id?: string
          category_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_path?: string | null
          id?: string
          note?: string | null
          payment_method?: string
          payroll_run_id?: string | null
          school_id?: string
          spent_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_payroll_run_fk"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_payroll_run_fk"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "v_payroll_totals"
            referencedColumns: ["payroll_run_id"]
          },
          {
            foreignKeyName: "expenses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_log: {
        Row: {
          action: string
          admin_id: string
          at: string
          detail: Json | null
          id: number
          mode: Database["public"]["Enums"]["impersonation_mode"]
          school_id: string
          session_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          at?: string
          detail?: Json | null
          id?: never
          mode: Database["public"]["Enums"]["impersonation_mode"]
          school_id: string
          session_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          at?: string
          detail?: Json | null
          id?: never
          mode?: Database["public"]["Enums"]["impersonation_mode"]
          school_id?: string
          session_id?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "impersonation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_sessions: {
        Row: {
          admin_id: string
          ended_at: string | null
          expires_at: string
          id: string
          mode: Database["public"]["Enums"]["impersonation_mode"]
          reason: string | null
          school_id: string
          started_at: string
          target_user_id: string
        }
        Insert: {
          admin_id: string
          ended_at?: string | null
          expires_at?: string
          id?: string
          mode?: Database["public"]["Enums"]["impersonation_mode"]
          reason?: string | null
          school_id: string
          started_at?: string
          target_user_id: string
        }
        Update: {
          admin_id?: string
          ended_at?: string | null
          expires_at?: string
          id?: string
          mode?: Database["public"]["Enums"]["impersonation_mode"]
          reason?: string | null
          school_id?: string
          started_at?: string
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_sessions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "platform_admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          invoice_id: string
          is_preliminary: boolean
          kind: Database["public"]["Enums"]["invoice_line_kind"]
          quantity: number
          school_id: string
          service_id: string | null
          sort_order: number
          source: Json | null
          unit_price: number
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          is_preliminary?: boolean
          kind: Database["public"]["Enums"]["invoice_line_kind"]
          quantity?: number
          school_id: string
          service_id?: string | null
          sort_order?: number
          source?: Json | null
          unit_price?: number
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          is_preliminary?: boolean
          kind?: Database["public"]["Enums"]["invoice_line_kind"]
          quantity?: number
          school_id?: string
          service_id?: string | null
          sort_order?: number
          source?: Json | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_totals"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "invoice_lines_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string
          contract_id: string | null
          created_at: string
          due_date: string
          due_soon_sent_at: string | null
          finalized_at: string | null
          generated_at: string
          id: string
          note: string | null
          notified_at: string | null
          overdue_sent_at: string | null
          period: string
          school_id: string
          status: Database["public"]["Enums"]["invoice_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id: string
          contract_id?: string | null
          created_at?: string
          due_date: string
          due_soon_sent_at?: string | null
          finalized_at?: string | null
          generated_at?: string
          id?: string
          note?: string | null
          notified_at?: string | null
          overdue_sent_at?: string | null
          period: string
          school_id: string
          status?: Database["public"]["Enums"]["invoice_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string
          contract_id?: string | null
          created_at?: string
          due_date?: string
          due_soon_sent_at?: string | null
          finalized_at?: string | null
          generated_at?: string
          id?: string
          note?: string | null
          notified_at?: string | null
          overdue_sent_at?: string | null
          period?: string
          school_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_balances"
            referencedColumns: ["student_id"]
          },
        ]
      }
      lead_events: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status: Database["public"]["Enums"]["lead_status"] | null
          id: number
          lead_id: string
          note: string | null
          school_id: string
          to_status: Database["public"]["Enums"]["lead_status"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["lead_status"] | null
          id?: never
          lead_id: string
          note?: string | null
          school_id: string
          to_status: Database["public"]["Enums"]["lead_status"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["lead_status"] | null
          id?: never
          lead_id?: string
          note?: string | null
          school_id?: string
          to_status?: Database["public"]["Enums"]["lead_status"]
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          branch_id: string
          created_at: string
          created_by: string | null
          full_name: string
          id: string
          next_contact_on: string | null
          note: string | null
          phone: string
          school_id: string
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          student_id: string | null
          target_class: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          branch_id: string
          created_at?: string
          created_by?: string | null
          full_name: string
          id?: string
          next_contact_on?: string | null
          note?: string | null
          phone: string
          school_id: string
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          student_id?: string | null
          target_class?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          branch_id?: string
          created_at?: string
          created_by?: string | null
          full_name?: string
          id?: string
          next_contact_on?: string | null
          note?: string | null
          phone?: string
          school_id?: string
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          student_id?: string | null
          target_class?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_balances"
            referencedColumns: ["student_id"]
          },
        ]
      }
      lessons: {
        Row: {
          branch_id: string
          class_name: string | null
          created_at: string
          created_by: string | null
          day: string
          hours: number
          id: string
          kind: Database["public"]["Enums"]["lesson_kind"]
          reason: string | null
          school_id: string
          subject: string | null
          substitute_for: string | null
          teacher_id: string
        }
        Insert: {
          branch_id: string
          class_name?: string | null
          created_at?: string
          created_by?: string | null
          day: string
          hours?: number
          id?: string
          kind?: Database["public"]["Enums"]["lesson_kind"]
          reason?: string | null
          school_id: string
          subject?: string | null
          substitute_for?: string | null
          teacher_id: string
        }
        Update: {
          branch_id?: string
          class_name?: string | null
          created_at?: string
          created_by?: string | null
          day?: string
          hours?: number
          id?: string
          kind?: Database["public"]["Enums"]["lesson_kind"]
          reason?: string | null
          school_id?: string
          subject?: string | null
          substitute_for?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_substitute_for_fkey"
            columns: ["substitute_for"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      lookups: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          kind: string
          name: string
          school_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          kind: string
          name: string
          school_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          school_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lookups_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      message_queue: {
        Row: {
          attempts: number
          body: string | null
          chat_id: number
          created_at: string
          id: number
          lang: string
          last_error: string | null
          params: Json
          parent_id: string | null
          scheduled_at: string
          school_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["message_status"]
          student_id: string | null
          template_key: string
        }
        Insert: {
          attempts?: number
          body?: string | null
          chat_id: number
          created_at?: string
          id?: never
          lang?: string
          last_error?: string | null
          params?: Json
          parent_id?: string | null
          scheduled_at?: string
          school_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          student_id?: string | null
          template_key: string
        }
        Update: {
          attempts?: number
          body?: string | null
          chat_id?: number
          created_at?: string
          id?: never
          lang?: string
          last_error?: string | null
          params?: Json
          parent_id?: string | null
          scheduled_at?: string
          school_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          student_id?: string | null
          template_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_queue_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_queue_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_queue_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_queue_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_balances"
            referencedColumns: ["student_id"]
          },
        ]
      }
      parents: {
        Row: {
          created_at: string
          deleted_at: string | null
          full_name: string
          id: string
          is_active: boolean
          lang: string
          phone: string
          school_id: string
          telegram_id: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          lang?: string
          phone: string
          school_id: string
          telegram_id?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          lang?: string
          phone?: string
          school_id?: string
          telegram_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_proofs: {
        Row: {
          amount_claimed: number | null
          branch_id: string
          file_deleted_at: string | null
          file_path: string | null
          id: string
          parent_id: string | null
          payment_id: string | null
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string
          stale_notified_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          student_id: string
          submitted_at: string
          telegram_file_id: string | null
        }
        Insert: {
          amount_claimed?: number | null
          branch_id: string
          file_deleted_at?: string | null
          file_path?: string | null
          id?: string
          parent_id?: string | null
          payment_id?: string | null
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id: string
          stale_notified_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          student_id: string
          submitted_at?: string
          telegram_file_id?: string | null
        }
        Update: {
          amount_claimed?: number | null
          branch_id?: string
          file_deleted_at?: string | null
          file_path?: string | null
          id?: string
          parent_id?: string | null
          payment_id?: string | null
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string
          stale_notified_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          student_id?: string
          submitted_at?: string
          telegram_file_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_proofs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_balances"
            referencedColumns: ["student_id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          branch_id: string
          cancelled_reason: string | null
          channel: Database["public"]["Enums"]["payment_channel"]
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          paid_on: string
          school_id: string
          status: Database["public"]["Enums"]["payment_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          branch_id: string
          cancelled_reason?: string | null
          channel: Database["public"]["Enums"]["payment_channel"]
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          paid_on?: string
          school_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          branch_id?: string
          cancelled_reason?: string | null
          channel?: Database["public"]["Enums"]["payment_channel"]
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          paid_on?: string
          school_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_balances"
            referencedColumns: ["student_id"]
          },
        ]
      }
      payroll_lines: {
        Row: {
          amount: number
          branch_id: string | null
          created_at: string
          description: string
          id: string
          payroll_run_id: string
          quantity: number
          school_id: string
          sort_order: number
          source: Json | null
          source_kind: string
          unit_price: number
        }
        Insert: {
          amount: number
          branch_id?: string | null
          created_at?: string
          description: string
          id?: string
          payroll_run_id: string
          quantity?: number
          school_id: string
          sort_order?: number
          source?: Json | null
          source_kind: string
          unit_price?: number
        }
        Update: {
          amount?: number
          branch_id?: string | null
          created_at?: string
          description?: string
          id?: string
          payroll_run_id?: string
          quantity?: number
          school_id?: string
          sort_order?: number
          source?: Json | null
          source_kind?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_lines_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_lines_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_lines_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "v_payroll_totals"
            referencedColumns: ["payroll_run_id"]
          },
          {
            foreignKeyName: "payroll_lines_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          calculated_at: string
          created_at: string
          expense_id: string | null
          id: string
          note: string | null
          period: string
          period_from: string
          period_to: string
          school_id: string
          settings_snapshot: Json | null
          status: Database["public"]["Enums"]["payroll_status"]
          teacher_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          calculated_at?: string
          created_at?: string
          expense_id?: string | null
          id?: string
          note?: string | null
          period: string
          period_from: string
          period_to: string
          school_id: string
          settings_snapshot?: Json | null
          status?: Database["public"]["Enums"]["payroll_status"]
          teacher_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          calculated_at?: string
          created_at?: string
          expense_id?: string | null
          id?: string
          note?: string | null
          period?: string
          period_from?: string
          period_to?: string
          school_id?: string
          settings_snapshot?: Json | null
          status?: Database["public"]["Enums"]["payroll_status"]
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_settings: {
        Row: {
          created_at: string
          effective_from: string
          id: string
          key: string
          note: string | null
          school_id: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          effective_from?: string
          id?: string
          key: string
          note?: string | null
          school_id: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string
          effective_from?: string
          id?: string
          key?: string
          note?: string | null
          school_id?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "payroll_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          code: string
          created_at: string
          features: Json
          id: string
          is_active: boolean
          max_branches: number | null
          max_students: number | null
          monthly_price: number
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          max_branches?: number | null
          max_students?: number | null
          monthly_price?: number
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          max_branches?: number | null
          max_students?: number | null
          monthly_price?: number
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          is_active?: boolean
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
        }
        Relationships: []
      }
      platform_log: {
        Row: {
          action: string
          admin_id: string | null
          after: Json | null
          at: string
          before: Json | null
          entity: string | null
          entity_id: string | null
          id: number
          school_id: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: never
          school_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: never
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "platform_admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          is_public: boolean
          key: string
          note: string | null
          updated_at: string
          value: Json
        }
        Insert: {
          is_public?: boolean
          key: string
          note?: string | null
          updated_at?: string
          value: Json
        }
        Update: {
          is_public?: boolean
          key?: string
          note?: string | null
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          allowed: boolean
          permission: string
          role: Database["public"]["Enums"]["user_role"]
          school_id: string | null
        }
        Insert: {
          allowed?: boolean
          permission: string
          role: Database["public"]["Enums"]["user_role"]
          school_id?: string | null
        }
        Update: {
          allowed?: boolean
          permission?: string
          role?: Database["public"]["Enums"]["user_role"]
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_settings: {
        Row: {
          key: string
          note: string | null
          school_id: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          note?: string | null
          school_id: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          note?: string | null
          school_id?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "school_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      school_subscriptions: {
        Row: {
          created_at: string
          id: string
          last_paid_at: string | null
          monthly_amount: number
          next_payment_date: string | null
          note: string | null
          plan_id: string
          school_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_paid_at?: string | null
          monthly_amount?: number
          next_payment_date?: string | null
          note?: string | null
          plan_id: string
          school_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_paid_at?: string | null
          monthly_amount?: number
          next_payment_date?: string | null
          note?: string | null
          plan_id?: string
          school_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          closing_day: number
          created_at: string
          default_lang: string
          deleted_at: string | null
          email: string | null
          id: string
          legal_name: string | null
          name: string
          phone: string | null
          status: Database["public"]["Enums"]["school_status"]
          tax_id: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          closing_day?: number
          created_at?: string
          default_lang?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          legal_name?: string | null
          name: string
          phone?: string | null
          status?: Database["public"]["Enums"]["school_status"]
          tax_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          closing_day?: number
          created_at?: string
          default_lang?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          legal_name?: string | null
          name?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["school_status"]
          tax_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_prices: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          price: number
          school_id: string
          service_id: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          price: number
          school_id: string
          service_id: string
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          price?: number
          school_id?: string
          service_id?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_prices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_prices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_prices_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          billing_type: Database["public"]["Enums"]["billing_type"]
          branch_id: string
          code: string
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          name: string
          note: string | null
          school_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          billing_type: Database["public"]["Enums"]["billing_type"]
          branch_id: string
          code: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          note?: string | null
          school_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          billing_type?: Database["public"]["Enums"]["billing_type"]
          branch_id?: string
          code?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          note?: string | null
          school_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      student_parents: {
        Row: {
          created_at: string
          is_primary: boolean
          parent_id: string
          relation: string | null
          student_id: string
        }
        Insert: {
          created_at?: string
          is_primary?: boolean
          parent_id: string
          relation?: string | null
          student_id: string
        }
        Update: {
          created_at?: string
          is_primary?: boolean
          parent_id?: string
          relation?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_parents_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_parents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_parents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_balances"
            referencedColumns: ["student_id"]
          },
        ]
      }
      student_services: {
        Row: {
          created_at: string
          created_by: string | null
          ends_on: string | null
          id: string
          note: string | null
          school_id: string
          service_id: string
          starts_on: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          note?: string | null
          school_id: string
          service_id: string
          starts_on?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          note?: string | null
          school_id?: string
          service_id?: string
          starts_on?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_services_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_services_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_services_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_services_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_balances"
            referencedColumns: ["student_id"]
          },
        ]
      }
      students: {
        Row: {
          birth_date: string | null
          branch_id: string
          class_id: string | null
          class_name: string | null
          created_at: string
          deleted_at: string | null
          enrolled_on: string
          full_name: string
          grade_level: number | null
          id: string
          left_on: string | null
          note: string | null
          payment_code: string
          school_id: string
          status: Database["public"]["Enums"]["student_status"]
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          branch_id: string
          class_id?: string | null
          class_name?: string | null
          created_at?: string
          deleted_at?: string | null
          enrolled_on?: string
          full_name: string
          grade_level?: number | null
          id?: string
          left_on?: string | null
          note?: string | null
          payment_code?: string
          school_id: string
          status?: Database["public"]["Enums"]["student_status"]
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          branch_id?: string
          class_id?: string | null
          class_name?: string | null
          created_at?: string
          deleted_at?: string | null
          enrolled_on?: string
          full_name?: string
          grade_level?: number | null
          id?: string
          left_on?: string | null
          note?: string | null
          payment_code?: string
          school_id?: string
          status?: Database["public"]["Enums"]["student_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_invoices: {
        Row: {
          base_amount: number
          branches_amount: number
          branches_count: number
          branches_extra: number
          created_at: string
          due_date: string
          id: string
          issued_on: string
          note: string | null
          paid_amount: number
          period: string
          school_id: string
          setup_fee: number
          status: Database["public"]["Enums"]["subscription_invoice_status"]
          students_amount: number
          students_count: number
          students_extra_steps: number
          students_included: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          base_amount?: number
          branches_amount?: number
          branches_count?: number
          branches_extra?: number
          created_at?: string
          due_date: string
          id?: string
          issued_on?: string
          note?: string | null
          paid_amount?: number
          period: string
          school_id: string
          setup_fee?: number
          status?: Database["public"]["Enums"]["subscription_invoice_status"]
          students_amount?: number
          students_count?: number
          students_extra_steps?: number
          students_included?: number
          total_amount: number
          updated_at?: string
        }
        Update: {
          base_amount?: number
          branches_amount?: number
          branches_count?: number
          branches_extra?: number
          created_at?: string
          due_date?: string
          id?: string
          issued_on?: string
          note?: string | null
          paid_amount?: number
          period?: string
          school_id?: string
          setup_fee?: number
          status?: Database["public"]["Enums"]["subscription_invoice_status"]
          students_amount?: number
          students_count?: number
          students_extra_steps?: number
          students_included?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount: number
          created_at: string
          file_path: string | null
          id: string
          invoice_id: string | null
          method: string
          months: number
          note: string | null
          paid_on: string
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string
          status: Database["public"]["Enums"]["subscription_payment_status"]
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          file_path?: string | null
          id?: string
          invoice_id?: string | null
          method?: string
          months?: number
          note?: string | null
          paid_on: string
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["subscription_payment_status"]
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          file_path?: string | null
          id?: string
          invoice_id?: string | null
          method?: string
          months?: number
          note?: string | null
          paid_on?: string
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["subscription_payment_status"]
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "subscription_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "platform_admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          body: string
          created_at: string
          file_path: string | null
          from_platform: boolean
          id: number
          is_system: boolean
          school_id: string
          sender_id: string | null
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          file_path?: string | null
          from_platform: boolean
          id?: never
          is_system?: boolean
          school_id: string
          sender_id?: string | null
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          file_path?: string | null
          from_platform?: boolean
          id?: never
          is_system?: boolean
          school_id?: string
          sender_id?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "support_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      support_threads: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          last_message_at: string
          opened_by: string | null
          opened_by_platform: boolean
          payment_id: string | null
          platform_read_at: string | null
          priority: Database["public"]["Enums"]["support_priority"]
          school_id: string
          school_read_at: string | null
          status: Database["public"]["Enums"]["support_thread_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          opened_by?: string | null
          opened_by_platform?: boolean
          payment_id?: string | null
          platform_read_at?: string | null
          priority?: Database["public"]["Enums"]["support_priority"]
          school_id: string
          school_read_at?: string | null
          status?: Database["public"]["Enums"]["support_thread_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          opened_by?: string | null
          opened_by_platform?: boolean
          payment_id?: string | null
          platform_read_at?: string | null
          priority?: Database["public"]["Enums"]["support_priority"]
          school_id?: string
          school_read_at?: string | null
          status?: Database["public"]["Enums"]["support_thread_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_threads_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "subscription_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_threads_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_advances: {
        Row: {
          amount: number
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          paid_on: string
          period: string
          school_id: string
          teacher_id: string
        }
        Insert: {
          amount: number
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          paid_on?: string
          period: string
          school_id: string
          teacher_id: string
        }
        Update: {
          amount?: number
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          paid_on?: string
          period?: string
          school_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_advances_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_advances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_advances_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_advances_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_allowances: {
        Row: {
          code: string
          created_at: string
          ends_on: string | null
          id: string
          note: string | null
          school_id: string
          starts_on: string
          teacher_id: string
          updated_at: string
          value_override: number | null
        }
        Insert: {
          code: string
          created_at?: string
          ends_on?: string | null
          id?: string
          note?: string | null
          school_id: string
          starts_on?: string
          teacher_id: string
          updated_at?: string
          value_override?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          ends_on?: string | null
          id?: string
          note?: string | null
          school_id?: string
          starts_on?: string
          teacher_id?: string
          updated_at?: string
          value_override?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_allowances_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_allowances_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_branches: {
        Row: {
          branch_id: string
          load_share: number
          teacher_id: string
        }
        Insert: {
          branch_id: string
          load_share?: number
          teacher_id: string
        }
        Update: {
          branch_id?: string
          load_share?: number
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_branches_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          base_salary: number
          category: string | null
          created_at: string
          deleted_at: string | null
          full_name: string
          hired_on: string | null
          id: string
          is_active: boolean
          note: string | null
          phone: string | null
          rate_factor: number
          school_id: string
          updated_at: string
          user_id: string | null
          weekly_hours: number
        }
        Insert: {
          base_salary?: number
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          full_name: string
          hired_on?: string | null
          id?: string
          is_active?: boolean
          note?: string | null
          phone?: string | null
          rate_factor?: number
          school_id: string
          updated_at?: string
          user_id?: string | null
          weekly_hours?: number
        }
        Update: {
          base_salary?: number
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          full_name?: string
          hired_on?: string | null
          id?: string
          is_active?: boolean
          note?: string | null
          phone?: string | null
          rate_factor?: number
          school_id?: string
          updated_at?: string
          user_id?: string | null
          weekly_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "teachers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teachers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_sessions: {
        Row: {
          chat_id: number
          context: Json
          lang: string
          parent_id: string | null
          state: string
          updated_at: string
        }
        Insert: {
          chat_id: number
          context?: Json
          lang?: string
          parent_id?: string | null
          state?: string
          updated_at?: string
        }
        Update: {
          chat_id?: number
          context?: Json
          lang?: string
          parent_id?: string | null
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_sessions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_updates: {
        Row: {
          chat_id: number | null
          received_at: string
          update_id: number
        }
        Insert: {
          chat_id?: number | null
          received_at?: string
          update_id: number
        }
        Update: {
          chat_id?: number | null
          received_at?: string
          update_id?: number
        }
        Relationships: []
      }
      translations: {
        Row: {
          id: string
          key: string
          lang: string
          school_id: string | null
          scope: string
          text: string
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          lang: string
          school_id?: string | null
          scope: string
          text: string
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          lang?: string
          school_id?: string | null
          scope?: string
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "translations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_branches: {
        Row: {
          branch_id: string
          user_id: string
        }
        Insert: {
          branch_id: string
          user_id: string
        }
        Update: {
          branch_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_branches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_invoice_totals: {
        Row: {
          branch_id: string | null
          due_date: string | null
          has_preliminary: boolean | null
          invoice_id: string | null
          period: string | null
          preliminary_total: number | null
          school_id: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          student_id: string | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_balances"
            referencedColumns: ["student_id"]
          },
        ]
      }
      v_payroll_totals: {
        Row: {
          deductions_total: number | null
          gross_total: number | null
          net_total: number | null
          payroll_run_id: string | null
          period: string | null
          school_id: string | null
          status: Database["public"]["Enums"]["payroll_status"] | null
          teacher_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      v_student_balances: {
        Row: {
          balance: number | null
          branch_id: string | null
          charged: number | null
          class_name: string | null
          full_name: string | null
          oldest_unpaid_due: string | null
          overdue_charged: number | null
          paid: number | null
          payment_code: string | null
          school_id: string | null
          status: Database["public"]["Enums"]["student_status"] | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      approve_invoices: {
        Args: { p_branch_id: string; p_period: string }
        Returns: Json
      }
      approve_payroll: { Args: { p_run_id: string }; Returns: Json }
      assign_service_to_class: {
        Args: { p_class_id: string; p_service_id: string; p_starts_on?: string }
        Returns: Json
      }
      bot_text: {
        Args: { p_key: string; p_lang?: string; p_school_id?: string }
        Returns: string
      }
      calc_payroll: {
        Args: { p_period: string; p_teacher_id: string }
        Returns: Json
      }
      calc_payroll_batch: { Args: { p_period: string }; Returns: Json }
      cancel_payment: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: Json
      }
      cleanup_expired_files: { Args: never; Returns: Json }
      confirm_payment_proof: {
        Args: { p_amount?: number; p_paid_on?: string; p_proof_id: string }
        Returns: Json
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      detach_parent: {
        Args: { p_parent_id: string; p_student_id: string }
        Returns: Json
      }
      edit_payment: {
        Args: {
          p_amount: number
          p_note?: string
          p_paid_on: string
          p_payment_id: string
          p_reason?: string
        }
        Returns: Json
      }
      end_impersonation: { Args: { p_session_id: string }; Returns: Json }
      finalize_invoices: {
        Args: { p_branch_id: string; p_period: string }
        Returns: Json
      }
      generate_invoices: {
        Args: { p_branch_id: string; p_period: string }
        Returns: Json
      }
      import_bank_rows: {
        Args: { p_rows: Json; p_statement_id: string }
        Returns: Json
      }
      issue_subscription_invoice: {
        Args: { p_period?: string; p_school_id: string }
        Returns: Json
      }
      lock_period: {
        Args: { p_branch_id?: string; p_note?: string; p_period: string }
        Returns: Json
      }
      log_platform_action: {
        Args: {
          p_action: string
          p_detail?: Json
          p_entity?: string
          p_entity_id?: string
          p_school_id?: string
        }
        Returns: undefined
      }
      mark_class_attendance: {
        Args: { p_absent?: Json; p_class_id: string; p_day: string }
        Returns: Json
      }
      mark_support_read: { Args: { p_thread_id: string }; Returns: Json }
      match_statement_row: {
        Args: { p_row_id: string; p_student_id: string }
        Returns: Json
      }
      my_classes: {
        Args: { p_day?: string }
        Returns: {
          absent_count: number
          academic_year: string
          branch_id: string
          class_id: string
          class_name: string
          is_workday: boolean
          marked_at: string
          students: number
        }[]
      }
      notify_invoices: {
        Args: { p_branch_id: string; p_final?: boolean; p_period: string }
        Returns: Json
      }
      open_support_thread: {
        Args: {
          p_body: string
          p_file_path?: string
          p_priority?: Database["public"]["Enums"]["support_priority"]
          p_school_id?: string
          p_subject: string
        }
        Returns: Json
      }
      pending_absence_warnings: {
        Args: { p_branch_id?: string; p_days_back?: number }
        Returns: {
          branch_id: string
          branch_name: string
          class_name: string
          day: string
        }[]
      }
      platform_overview: {
        Args: never
        Returns: {
          branches_total: number
          churn_90d: number
          failed_messages: number
          mrr: number
          new_schools_30d: number
          open_threads: number
          overdue_schools: number
          pending_payments: number
          schools_active: number
          schools_archived: number
          schools_restricted: number
          schools_suspended: number
          schools_total: number
          schools_trial: number
          students_total: number
          unpaid_amount: number
          unpaid_invoices: number
          unread_threads: number
          users_total: number
        }[]
      }
      platform_revenue: {
        Args: { p_months?: number }
        Returns: {
          collected: number
          invoices: number
          issued: number
          period: string
          schools: number
        }[]
      }
      platform_school_card: { Args: { p_school_id: string }; Returns: Json }
      platform_schools: {
        Args: never
        Returns: {
          branches_count: number
          created_at: string
          last_activity: string
          last_paid_at: string
          max_branches: number
          max_students: number
          monthly_amount: number
          name: string
          next_payment_date: string
          over_limit: boolean
          overdue_days: number
          pending_payments: number
          phone: string
          plan_code: string
          plan_name: string
          school_id: string
          status: Database["public"]["Enums"]["school_status"]
          students_count: number
          students_included: number
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          tax_id: string
          teachers_count: number
          trial_ends_at: string
          unpaid_amount: number
          unread_messages: number
          users_count: number
        }[]
      }
      post_support_message: {
        Args: { p_body: string; p_file_path?: string; p_thread_id: string }
        Returns: Json
      }
      promote_classes: {
        Args: {
          p_branch_id?: string
          p_final_grade?: number
          p_from_year: string
          p_to_year: string
        }
        Returns: Json
      }
      provision_school: {
        Args: {
          p_address?: string
          p_branch_name?: string
          p_name: string
          p_phone?: string
          p_plan_code?: string
          p_trial_days?: number
        }
        Returns: Json
      }
      record_subscription_payment: {
        Args: {
          p_amount: number
          p_months?: number
          p_note?: string
          p_paid_on?: string
          p_school_id: string
        }
        Returns: Json
      }
      register_cash_payment: {
        Args: {
          p_amount: number
          p_note?: string
          p_paid_on?: string
          p_student_id: string
        }
        Returns: Json
      }
      reject_payment_proof: {
        Args: { p_proof_id: string; p_reason: string }
        Returns: Json
      }
      report_advances: {
        Args: { p_branch_id?: string }
        Returns: {
          advance: number
          branch_id: string
          class_name: string
          full_name: string
          student_id: string
        }[]
      }
      report_by_class: {
        Args: { p_branch_id?: string; p_from: string; p_to: string }
        Returns: {
          avg_per_student: number
          branch_id: string
          branch_name: string
          charged: number
          class_id: string
          class_name: string
          collected: number
          collection_rate: number
          debt: number
          grade_level: number
          remaining: number
          students: number
          teacher_name: string
        }[]
      }
      report_cash: {
        Args: { p_branch_id?: string; p_from: string; p_to: string }
        Returns: {
          branch_id: string
          branch_name: string
          cash_in: number
          cash_out: number
          day: string
          net: number
          receipts: number
        }[]
      }
      report_debts: {
        Args: { p_branch_id?: string; p_min_amount?: number }
        Returns: {
          balance: number
          branch_id: string
          charged: number
          class_name: string
          days_overdue: number
          full_name: string
          oldest_due: string
          overdue_amount: number
          paid: number
          payment_code: string
          student_id: string
        }[]
      }
      report_enrollment: {
        Args: { p_branch_id?: string; p_from: string; p_to: string }
        Returns: {
          academic_leave: number
          active_now: number
          branch_id: string
          branch_name: string
          joined: number
          left_school: number
        }[]
      }
      report_expense_detail: {
        Args: {
          p_branch_id?: string
          p_category_id?: string
          p_from: string
          p_to: string
        }
        Returns: {
          amount: number
          branch_id: string
          branch_name: string
          category_id: string
          category_name: string
          created_by: string
          id: string
          is_payroll: boolean
          note: string
          payment_method: string
          spent_on: string
        }[]
      }
      report_expenses: {
        Args: { p_branch_id?: string; p_from: string; p_to: string }
        Returns: {
          amount: number
          branch_id: string
          branch_name: string
          category_code: string
          category_id: string
          category_name: string
          entries: number
        }[]
      }
      report_financial_summary: {
        Args: { p_branch_id?: string; p_from: string; p_to: string }
        Returns: {
          advances: number
          cash_position: number
          charged: number
          collected: number
          collection_rate: number
          other_expenses: number
          paid_students: number
          payroll: number
          profit_before_expenses: number
          profit_before_payroll: number
          profit_net: number
          remaining: number
          students: number
          total_debt: number
          total_expenses: number
        }[]
      }
      report_invoice_status: {
        Args: { p_branch_id?: string; p_period: string }
        Returns: {
          branch_id: string
          branch_name: string
          has_preliminary: boolean
          invoices: number
          status: Database["public"]["Enums"]["invoice_status"]
          total: number
        }[]
      }
      report_monthly_trend: {
        Args: { p_branch_id?: string; p_months?: number }
        Returns: {
          charged: number
          collected: number
          net_profit: number
          other_expenses: number
          payroll: number
          period: string
          remaining: number
          students: number
        }[]
      }
      report_payroll: {
        Args: { p_period: string }
        Returns: {
          deductions: number
          gross_total: number
          hours: number
          net_total: number
          payroll_run_id: string
          status: Database["public"]["Enums"]["payroll_status"]
          teacher_id: string
          teacher_name: string
        }[]
      }
      report_pnl: {
        Args: { p_branch_id?: string; p_from: string; p_to: string }
        Returns: {
          branch_id: string
          branch_name: string
          charged: number
          collected: number
          expenses: number
          profit: number
        }[]
      }
      report_revenue_mix: {
        Args: { p_branch_id?: string; p_from: string; p_to: string }
        Returns: {
          amount: number
          branch_id: string
          branch_name: string
          line_kind: Database["public"]["Enums"]["invoice_line_kind"]
          quantity: number
          service_code: string
          service_name: string
        }[]
      }
      report_service_usage: {
        Args: { p_branch_id?: string; p_from: string; p_to: string }
        Returns: {
          absence_days: number
          amount: number
          billed_days: number
          billing_type: Database["public"]["Enums"]["billing_type"]
          branch_id: string
          branch_name: string
          service_id: string
          service_name: string
          subscribers: number
        }[]
      }
      review_subscription_payment: {
        Args: { p_approve: boolean; p_payment_id: string; p_reason?: string }
        Returns: Json
      }
      revise_payment_proof: {
        Args: {
          p_action: string
          p_amount?: number
          p_proof_id: string
          p_reason?: string
        }
        Returns: Json
      }
      run_billing_cycle: { Args: never; Returns: Json }
      school_price: { Args: { p_school_id: string }; Returns: Json }
      school_users: {
        Args: { p_school_id: string }
        Returns: {
          email: string
          full_name: string
          id: string
          is_active: boolean
          last_sign_in: string
          phone: string
          role: Database["public"]["Enums"]["user_role"]
        }[]
      }
      seed_school_defaults: { Args: { p_school_id: string }; Returns: Json }
      send_due_reminders: { Args: never; Returns: Json }
      set_platform_setting: {
        Args: { p_key: string; p_reason?: string; p_value: Json }
        Returns: Json
      }
      set_school_plan: {
        Args: { p_plan_code: string; p_reason?: string; p_school_id: string }
        Returns: Json
      }
      set_school_status: {
        Args: {
          p_reason: string
          p_school_id: string
          p_status: Database["public"]["Enums"]["school_status"]
        }
        Returns: Json
      }
      set_support_thread_status: {
        Args: {
          p_status: Database["public"]["Enums"]["support_thread_status"]
          p_thread_id: string
        }
        Returns: Json
      }
      start_impersonation: {
        Args: {
          p_minutes?: number
          p_mode?: Database["public"]["Enums"]["impersonation_mode"]
          p_reason?: string
          p_school_id: string
          p_target_user_id: string
        }
        Returns: Json
      }
      student_history: {
        Args: { p_limit?: number; p_student_id: string }
        Returns: {
          action: string
          at: string
          changed_keys: string[]
          impersonated: boolean
          summary: string
          table_name: string
          user_name: string
        }[]
      }
      submit_payment_proof: {
        Args: {
          p_amount?: number
          p_file_path: string
          p_parent_id: string
          p_student_id: string
          p_telegram_file_id?: string
        }
        Returns: Json
      }
      submit_subscription_payment: {
        Args: {
          p_amount: number
          p_file_path?: string
          p_method?: string
          p_months?: number
          p_note?: string
          p_paid_on: string
        }
        Returns: Json
      }
    }
    Enums: {
      billing_type: "monthly_fixed" | "daily" | "one_time"
      calendar_day_type: "workday" | "weekend" | "holiday" | "vacation"
      discount_kind: "percent" | "amount"
      impersonation_mode: "read" | "write"
      invoice_line_kind:
        | "tuition"
        | "service"
        | "discount"
        | "adjustment"
        | "carryover"
      invoice_status: "preliminary" | "final" | "approved" | "cancelled"
      lead_status: "new" | "contacted" | "visited" | "accepted" | "rejected"
      lesson_kind: "held" | "substituted" | "not_held"
      message_status: "pending" | "sent" | "failed" | "blocked"
      payment_channel: "cash" | "bank" | "proof"
      payment_status: "pending" | "confirmed" | "rejected" | "cancelled"
      payroll_status: "draft" | "approved" | "cancelled"
      school_status:
        | "trial"
        | "active"
        | "restricted"
        | "archived"
        | "suspended"
      student_status: "active" | "academic_leave" | "expelled"
      subscription_invoice_status: "unpaid" | "partial" | "paid" | "void"
      subscription_payment_status: "pending" | "confirmed" | "rejected"
      subscription_status:
        | "trial"
        | "active"
        | "grace"
        | "restricted"
        | "cancelled"
        | "suspended"
      support_priority: "low" | "normal" | "high"
      support_thread_status: "open" | "answered" | "closed"
      user_role: "director" | "accountant" | "manager" | "duty" | "teacher"
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
      billing_type: ["monthly_fixed", "daily", "one_time"],
      calendar_day_type: ["workday", "weekend", "holiday", "vacation"],
      discount_kind: ["percent", "amount"],
      impersonation_mode: ["read", "write"],
      invoice_line_kind: [
        "tuition",
        "service",
        "discount",
        "adjustment",
        "carryover",
      ],
      invoice_status: ["preliminary", "final", "approved", "cancelled"],
      lead_status: ["new", "contacted", "visited", "accepted", "rejected"],
      lesson_kind: ["held", "substituted", "not_held"],
      message_status: ["pending", "sent", "failed", "blocked"],
      payment_channel: ["cash", "bank", "proof"],
      payment_status: ["pending", "confirmed", "rejected", "cancelled"],
      payroll_status: ["draft", "approved", "cancelled"],
      school_status: ["trial", "active", "restricted", "archived", "suspended"],
      student_status: ["active", "academic_leave", "expelled"],
      subscription_invoice_status: ["unpaid", "partial", "paid", "void"],
      subscription_payment_status: ["pending", "confirmed", "rejected"],
      subscription_status: [
        "trial",
        "active",
        "grace",
        "restricted",
        "cancelled",
        "suspended",
      ],
      support_priority: ["low", "normal", "high"],
      support_thread_status: ["open", "answered", "closed"],
      user_role: ["director", "accountant", "manager", "duty", "teacher"],
    },
  },
} as const
