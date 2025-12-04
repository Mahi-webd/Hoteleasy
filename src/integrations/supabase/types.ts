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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      automated_tasks: {
        Row: {
          action_config: Json | null
          category: string | null
          created_at: string
          description: string | null
          email_on_failure: boolean | null
          email_recipients: string[] | null
          failure_count: number | null
          id: string
          is_active: boolean
          last_error: string | null
          last_run_at: string | null
          name: string
          next_run_at: string | null
          priority: string | null
          run_count: number
          success_count: number | null
          task_type: string
          trigger_config: Json | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          action_config?: Json | null
          category?: string | null
          created_at?: string
          description?: string | null
          email_on_failure?: boolean | null
          email_recipients?: string[] | null
          failure_count?: number | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          priority?: string | null
          run_count?: number
          success_count?: number | null
          task_type: string
          trigger_config?: Json | null
          trigger_type: string
          updated_at?: string
        }
        Update: {
          action_config?: Json | null
          category?: string | null
          created_at?: string
          description?: string | null
          email_on_failure?: boolean | null
          email_recipients?: string[] | null
          failure_count?: number | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          priority?: string | null
          run_count?: number
          success_count?: number | null
          task_type?: string
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      automation_history: {
        Row: {
          completed_at: string | null
          duration_ms: number | null
          error_details: Json | null
          error_message: string | null
          id: string
          items_failed: number | null
          items_processed: number | null
          items_succeeded: number | null
          result_summary: string | null
          started_at: string
          status: string
          task_id: string
        }
        Insert: {
          completed_at?: string | null
          duration_ms?: number | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          items_failed?: number | null
          items_processed?: number | null
          items_succeeded?: number | null
          result_summary?: string | null
          started_at?: string
          status: string
          task_id: string
        }
        Update: {
          completed_at?: string | null
          duration_ms?: number | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          items_failed?: number | null
          items_processed?: number | null
          items_succeeded?: number | null
          result_summary?: string | null
          started_at?: string
          status?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "automated_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_categories: {
        Row: {
          category_type: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
        }
        Insert: {
          category_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
        }
        Update: {
          category_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          actual_amount: number
          alert_threshold_percent: number | null
          approved_at: string | null
          approved_by: string | null
          budgeted_amount: number
          category_id: string | null
          created_at: string
          department_id: string | null
          description: string | null
          end_date: string | null
          fiscal_month: number | null
          fiscal_year: number
          id: string
          name: string | null
          notes: string | null
          start_date: string | null
          status: string | null
          updated_at: string
          variance: number | null
        }
        Insert: {
          actual_amount?: number
          alert_threshold_percent?: number | null
          approved_at?: string | null
          approved_by?: string | null
          budgeted_amount?: number
          category_id?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          end_date?: string | null
          fiscal_month?: number | null
          fiscal_year: number
          id?: string
          name?: string | null
          notes?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string
          variance?: number | null
        }
        Update: {
          actual_amount?: number
          alert_threshold_percent?: number | null
          approved_at?: string | null
          approved_by?: string | null
          budgeted_amount?: number
          category_id?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          end_date?: string | null
          fiscal_month?: number | null
          fiscal_year?: number
          id?: string
          name?: string | null
          notes?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budgets_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          ai_generated: boolean | null
          attachments: Json | null
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          message_type: string | null
          read_at: string | null
          sender_id: string | null
          sender_type: string
          session_id: string
        }
        Insert: {
          ai_generated?: boolean | null
          attachments?: Json | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          message_type?: string | null
          read_at?: string | null
          sender_id?: string | null
          sender_type: string
          session_id: string
        }
        Update: {
          ai_generated?: boolean | null
          attachments?: Json | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          message_type?: string | null
          read_at?: string | null
          sender_id?: string | null
          sender_type?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          ai_enabled: boolean | null
          ai_resolution_rate: number | null
          assigned_to: string | null
          channel: string
          created_at: string
          ended_at: string | null
          guest_id: string | null
          id: string
          last_message: string | null
          last_message_at: string | null
          room_id: string | null
          satisfaction_rating: number | null
          started_at: string
          status: string
          unread_count: number | null
        }
        Insert: {
          ai_enabled?: boolean | null
          ai_resolution_rate?: number | null
          assigned_to?: string | null
          channel?: string
          created_at?: string
          ended_at?: string | null
          guest_id?: string | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          room_id?: string | null
          satisfaction_rating?: number | null
          started_at?: string
          status?: string
          unread_count?: number | null
        }
        Update: {
          ai_enabled?: boolean | null
          ai_resolution_rate?: number | null
          assigned_to?: string | null
          channel?: string
          created_at?: string
          ended_at?: string | null
          guest_id?: string | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          room_id?: string | null
          satisfaction_rating?: number | null
          started_at?: string
          status?: string
          unread_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      concierge_requests: {
        Row: {
          actual_cost: number | null
          assigned_to: string | null
          completed_at: string | null
          confirmation_number: string | null
          created_at: string
          description: string | null
          dropoff_time: string | null
          estimated_cost: number | null
          feedback: string | null
          guest_id: string | null
          id: string
          notes: string | null
          number_of_guests: number | null
          pickup_time: string | null
          priority: string
          rating: number | null
          request_type: string
          reservation_id: string | null
          room_id: string | null
          scheduled_time: string | null
          special_requirements: string | null
          status: string
          title: string
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          actual_cost?: number | null
          assigned_to?: string | null
          completed_at?: string | null
          confirmation_number?: string | null
          created_at?: string
          description?: string | null
          dropoff_time?: string | null
          estimated_cost?: number | null
          feedback?: string | null
          guest_id?: string | null
          id?: string
          notes?: string | null
          number_of_guests?: number | null
          pickup_time?: string | null
          priority?: string
          rating?: number | null
          request_type: string
          reservation_id?: string | null
          room_id?: string | null
          scheduled_time?: string | null
          special_requirements?: string | null
          status?: string
          title: string
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          actual_cost?: number | null
          assigned_to?: string | null
          completed_at?: string | null
          confirmation_number?: string | null
          created_at?: string
          description?: string | null
          dropoff_time?: string | null
          estimated_cost?: number | null
          feedback?: string | null
          guest_id?: string | null
          id?: string
          notes?: string | null
          number_of_guests?: number | null
          pickup_time?: string | null
          priority?: string
          rating?: number | null
          request_type?: string
          reservation_id?: string | null
          room_id?: string | null
          scheduled_time?: string | null
          special_requirements?: string | null
          status?: string
          title?: string
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "concierge_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concierge_requests_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concierge_requests_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concierge_requests_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      concierge_services: {
        Row: {
          advance_booking_hours: number | null
          category: string
          created_at: string
          description: string | null
          display_order: number | null
          duration_minutes: number | null
          icon: string | null
          id: string
          is_available: boolean | null
          name: string
          price: number | null
          price_type: string | null
          requires_advance_booking: boolean | null
          updated_at: string
        }
        Insert: {
          advance_booking_hours?: number | null
          category: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          duration_minutes?: number | null
          icon?: string | null
          id?: string
          is_available?: boolean | null
          name: string
          price?: number | null
          price_type?: string | null
          requires_advance_booking?: boolean | null
          updated_at?: string
        }
        Update: {
          advance_booking_hours?: number | null
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          duration_minutes?: number | null
          icon?: string | null
          id?: string
          is_available?: boolean | null
          name?: string
          price?: number | null
          price_type?: string | null
          requires_advance_booking?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          manager_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          manager_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          manager_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          category_id: string | null
          created_at: string
          department_id: string | null
          description: string | null
          expense_date: string
          id: string
          receipt_url: string | null
          status: string
          submitted_by: string | null
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          receipt_url?: string | null
          status?: string
          submitted_by?: string | null
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          receipt_url?: string | null
          status?: string
          submitted_by?: string | null
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_surveys: {
        Row: {
          average_rating: number | null
          created_at: string
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          published_at: string | null
          questions: Json | null
          response_count: number | null
          status: string
          survey_type: string
          title: string
          updated_at: string
        }
        Insert: {
          average_rating?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          published_at?: string | null
          questions?: Json | null
          response_count?: number | null
          status?: string
          survey_type: string
          title: string
          updated_at?: string
        }
        Update: {
          average_rating?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          published_at?: string | null
          questions?: Json | null
          response_count?: number | null
          status?: string
          survey_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_surveys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      floors: {
        Row: {
          created_at: string
          description: string | null
          floor_number: number
          id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          floor_number: number
          id?: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          floor_number?: number
          id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      guest_feedback: {
        Row: {
          amenities_rating: number | null
          category: string | null
          cleanliness_rating: number | null
          comment: string | null
          created_at: string
          feedback_type: string
          food_rating: number | null
          guest_id: string | null
          id: string
          is_public: boolean
          language: string | null
          location_rating: number | null
          rating: number | null
          reservation_id: string | null
          responded_at: string | null
          responded_by: string | null
          response: string | null
          service_rating: number | null
          source: string | null
          status: string
          title: string | null
          updated_at: string
          value_rating: number | null
          would_recommend: boolean | null
        }
        Insert: {
          amenities_rating?: number | null
          category?: string | null
          cleanliness_rating?: number | null
          comment?: string | null
          created_at?: string
          feedback_type?: string
          food_rating?: number | null
          guest_id?: string | null
          id?: string
          is_public?: boolean
          language?: string | null
          location_rating?: number | null
          rating?: number | null
          reservation_id?: string | null
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          service_rating?: number | null
          source?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          value_rating?: number | null
          would_recommend?: boolean | null
        }
        Update: {
          amenities_rating?: number | null
          category?: string | null
          cleanliness_rating?: number | null
          comment?: string | null
          created_at?: string
          feedback_type?: string
          food_rating?: number | null
          guest_id?: string | null
          id?: string
          is_public?: boolean
          language?: string | null
          location_rating?: number | null
          rating?: number | null
          reservation_id?: string | null
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          service_rating?: number | null
          source?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          value_rating?: number | null
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_feedback_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_feedback_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_feedback_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          first_name: string
          id: string
          id_number: string | null
          last_name: string
          last_stay: string | null
          nationality: string | null
          notes: string | null
          phone: string | null
          preferences: string | null
          status: string
          total_spent: number
          total_stays: number
          updated_at: string
          vip: boolean
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name: string
          id?: string
          id_number?: string | null
          last_name: string
          last_stay?: string | null
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          preferences?: string | null
          status?: string
          total_spent?: number
          total_stays?: number
          updated_at?: string
          vip?: boolean
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name?: string
          id?: string
          id_number?: string | null
          last_name?: string
          last_stay?: string | null
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          preferences?: string | null
          status?: string
          total_spent?: number
          total_stays?: number
          updated_at?: string
          vip?: boolean
        }
        Relationships: []
      }
      housekeeping_tasks: {
        Row: {
          assigned_to: string | null
          checklist: Json | null
          checklist_amenities: boolean | null
          checklist_bathroom: boolean | null
          checklist_bedroom: boolean | null
          checklist_linens: boolean | null
          checklist_minibar: boolean | null
          checklist_vacuum: boolean | null
          checklist_windows: boolean | null
          completed_at: string | null
          created_at: string
          id: string
          inspected_by: string | null
          inspection_notes: string | null
          inspection_rating: number | null
          last_cleaned: string | null
          next_service: string | null
          notes: string | null
          priority: string
          room_id: string
          scheduled_date: string
          started_at: string | null
          status: string
          task_type: string
          time_spent_minutes: number | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          checklist?: Json | null
          checklist_amenities?: boolean | null
          checklist_bathroom?: boolean | null
          checklist_bedroom?: boolean | null
          checklist_linens?: boolean | null
          checklist_minibar?: boolean | null
          checklist_vacuum?: boolean | null
          checklist_windows?: boolean | null
          completed_at?: string | null
          created_at?: string
          id?: string
          inspected_by?: string | null
          inspection_notes?: string | null
          inspection_rating?: number | null
          last_cleaned?: string | null
          next_service?: string | null
          notes?: string | null
          priority?: string
          room_id: string
          scheduled_date?: string
          started_at?: string | null
          status?: string
          task_type?: string
          time_spent_minutes?: number | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          checklist?: Json | null
          checklist_amenities?: boolean | null
          checklist_bathroom?: boolean | null
          checklist_bedroom?: boolean | null
          checklist_linens?: boolean | null
          checklist_minibar?: boolean | null
          checklist_vacuum?: boolean | null
          checklist_windows?: boolean | null
          completed_at?: string | null
          created_at?: string
          id?: string
          inspected_by?: string | null
          inspection_notes?: string | null
          inspection_rating?: number | null
          last_cleaned?: string | null
          next_service?: string | null
          notes?: string | null
          priority?: string
          room_id?: string
          scheduled_date?: string
          started_at?: string | null
          status?: string
          task_type?: string
          time_spent_minutes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "housekeeping_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeping_tasks_inspected_by_fkey"
            columns: ["inspected_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeping_tasks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "inventory_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          average_monthly_usage: number | null
          barcode: string | null
          brand: string | null
          category_id: string | null
          created_at: string
          description: string | null
          expiry_date: string | null
          id: string
          image_url: string | null
          is_active: boolean
          last_restock_date: string | null
          last_restock_quantity: number | null
          location: string | null
          maximum_quantity: number | null
          minimum_quantity: number
          name: string
          quantity_on_hand: number
          reorder_point: number
          sku: string
          storage_conditions: string | null
          supplier_contact: string | null
          supplier_name: string | null
          unit: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          average_monthly_usage?: number | null
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          last_restock_date?: string | null
          last_restock_quantity?: number | null
          location?: string | null
          maximum_quantity?: number | null
          minimum_quantity?: number
          name: string
          quantity_on_hand?: number
          reorder_point?: number
          sku: string
          storage_conditions?: string | null
          supplier_contact?: string | null
          supplier_name?: string | null
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          average_monthly_usage?: number | null
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          last_restock_date?: string | null
          last_restock_quantity?: number | null
          location?: string | null
          maximum_quantity?: number | null
          minimum_quantity?: number
          name?: string
          quantity_on_hand?: number
          reorder_point?: number
          sku?: string
          storage_conditions?: string | null
          supplier_contact?: string | null
          supplier_name?: string | null
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "inventory_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          created_at: string
          id: string
          item_id: string
          notes: string | null
          performed_by: string | null
          quantity: number
          reference_id: string | null
          reference_type: string | null
          total_cost: number | null
          transaction_type: string
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          notes?: string | null
          performed_by?: string | null
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          total_cost?: number | null
          transaction_type: string
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          notes?: string | null
          performed_by?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          total_cost?: number | null
          transaction_type?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          discount_percent: number | null
          id: string
          invoice_id: string
          item_type: string
          quantity: number
          reference_id: string | null
          tax_percent: number | null
          total_amount: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          discount_percent?: number | null
          id?: string
          invoice_id: string
          item_type?: string
          quantity?: number
          reference_id?: string | null
          tax_percent?: number | null
          total_amount: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          discount_percent?: number | null
          id?: string
          invoice_id?: string
          item_type?: string
          quantity?: number
          reference_id?: string | null
          tax_percent?: number | null
          total_amount?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          balance_due: number
          billing_address: string | null
          company_name: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          discount_amount: number
          due_date: string | null
          exchange_rate: number | null
          guest_id: string | null
          id: string
          invoice_date: string
          invoice_number: number
          notes: string | null
          paid_amount: number
          payment_terms: string | null
          po_number: string | null
          reminder_sent_at: string | null
          reservation_id: string | null
          sent_at: string | null
          status: string
          subtotal: number
          tax_amount: number
          tax_id: string | null
          total_amount: number
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          balance_due?: number
          billing_address?: string | null
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          discount_amount?: number
          due_date?: string | null
          exchange_rate?: number | null
          guest_id?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: number
          notes?: string | null
          paid_amount?: number
          payment_terms?: string | null
          po_number?: string | null
          reminder_sent_at?: string | null
          reservation_id?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_id?: string | null
          total_amount?: number
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          balance_due?: number
          billing_address?: string | null
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          discount_amount?: number
          due_date?: string | null
          exchange_rate?: number | null
          guest_id?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: number
          notes?: string | null
          paid_amount?: number
          payment_terms?: string | null
          po_number?: string | null
          reminder_sent_at?: string | null
          reservation_id?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_id?: string | null
          total_amount?: number
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          actual_cost: number | null
          assigned_to: string | null
          category: string
          completed_at: string | null
          created_at: string
          description: string | null
          estimated_cost: number | null
          id: string
          images: Json | null
          labor_cost: number | null
          notes: string | null
          parts_cost: number | null
          parts_needed: string[] | null
          priority: string
          rating: number | null
          rating_notes: string | null
          reported_by: string | null
          request_number: number
          resolution_notes: string | null
          room_id: string | null
          scheduled_date: string | null
          started_at: string | null
          status: string
          title: string
          updated_at: string
          vendor_contact: string | null
          vendor_name: string | null
          warranty_claim: boolean | null
          work_order_number: number
        }
        Insert: {
          actual_cost?: number | null
          assigned_to?: string | null
          category?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          estimated_cost?: number | null
          id?: string
          images?: Json | null
          labor_cost?: number | null
          notes?: string | null
          parts_cost?: number | null
          parts_needed?: string[] | null
          priority?: string
          rating?: number | null
          rating_notes?: string | null
          reported_by?: string | null
          request_number?: number
          resolution_notes?: string | null
          room_id?: string | null
          scheduled_date?: string | null
          started_at?: string | null
          status?: string
          title: string
          updated_at?: string
          vendor_contact?: string | null
          vendor_name?: string | null
          warranty_claim?: boolean | null
          work_order_number?: number
        }
        Update: {
          actual_cost?: number | null
          assigned_to?: string | null
          category?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          estimated_cost?: number | null
          id?: string
          images?: Json | null
          labor_cost?: number | null
          notes?: string | null
          parts_cost?: number | null
          parts_needed?: string[] | null
          priority?: string
          rating?: number | null
          rating_notes?: string | null
          reported_by?: string | null
          request_number?: number
          resolution_notes?: string | null
          room_id?: string | null
          scheduled_date?: string | null
          started_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          vendor_contact?: string | null
          vendor_name?: string | null
          warranty_claim?: boolean | null
          work_order_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          notification_type: string
          read_at: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          notification_type?: string
          read_at?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          action_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          notification_type?: string
          read_at?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          bank_reference: string | null
          card_last_four: string | null
          card_type: string | null
          created_at: string
          guest_id: string | null
          id: string
          invoice_id: string | null
          mpesa_receipt_number: string | null
          notes: string | null
          payment_date: string
          payment_method: string
          payment_number: number
          processed_by: string | null
          reference_number: string | null
          refund_amount: number | null
          refund_date: string | null
          refund_reason: string | null
          refund_status: string | null
          room_charge_reference: string | null
          status: string
          transaction_id: string | null
        }
        Insert: {
          amount: number
          bank_reference?: string | null
          card_last_four?: string | null
          card_type?: string | null
          created_at?: string
          guest_id?: string | null
          id?: string
          invoice_id?: string | null
          mpesa_receipt_number?: string | null
          notes?: string | null
          payment_date?: string
          payment_method: string
          payment_number?: number
          processed_by?: string | null
          reference_number?: string | null
          refund_amount?: number | null
          refund_date?: string | null
          refund_reason?: string | null
          refund_status?: string | null
          room_charge_reference?: string | null
          status?: string
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          bank_reference?: string | null
          card_last_four?: string | null
          card_type?: string | null
          created_at?: string
          guest_id?: string | null
          id?: string
          invoice_id?: string | null
          mpesa_receipt_number?: string | null
          notes?: string | null
          payment_date?: string
          payment_method?: string
          payment_number?: number
          processed_by?: string | null
          reference_number?: string | null
          refund_amount?: number | null
          refund_date?: string | null
          refund_reason?: string | null
          refund_status?: string | null
          room_charge_reference?: string | null
          status?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_order_items: {
        Row: {
          created_at: string
          id: string
          menu_item_id: string
          notes: string | null
          order_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          menu_item_id: string
          notes?: string | null
          order_id: string
          quantity?: number
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          menu_item_id?: string
          notes?: string | null
          order_id?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pos_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_orders: {
        Row: {
          created_at: string
          customer_name: string | null
          id: string
          notes: string | null
          order_number: number
          status: string
          subtotal: number
          table_id: string | null
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          id?: string
          notes?: string | null
          order_number: number
          status?: string
          subtotal?: number
          table_id?: string | null
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          id?: string
          notes?: string | null
          order_number?: number
          status?: string
          subtotal?: number
          table_id?: string | null
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          created_at: string
          description: string | null
          discount_percent: number | null
          id: string
          item_id: string | null
          po_id: string
          quantity: number
          received_quantity: number | null
          tax_rate: number | null
          total_amount: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          id?: string
          item_id?: string | null
          po_id: string
          quantity: number
          received_quantity?: number | null
          tax_rate?: number | null
          total_amount: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          id?: string
          item_id?: string | null
          po_id?: string
          quantity?: number
          received_quantity?: number | null
          tax_rate?: number | null
          total_amount?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          actual_delivery: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          expected_delivery: string | null
          id: string
          notes: string | null
          order_date: string
          payment_status: string | null
          po_number: number
          shipping_cost: number | null
          status: string
          subtotal: number | null
          supplier_id: string | null
          tax_amount: number | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          actual_delivery?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          payment_status?: string | null
          po_number?: number
          shipping_cost?: number | null
          status?: string
          subtotal?: number | null
          supplier_id?: string | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          actual_delivery?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          payment_status?: string | null
          po_number?: number
          shipping_cost?: number | null
          status?: string
          subtotal?: number | null
          supplier_id?: string | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          adults: number
          check_in_date: string
          check_out_date: string
          children: number
          created_at: string
          guest_id: string
          id: string
          notes: string | null
          room_id: string
          special_requests: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          adults?: number
          check_in_date: string
          check_out_date: string
          children?: number
          created_at?: string
          guest_id: string
          id?: string
          notes?: string | null
          room_id: string
          special_requests?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          adults?: number
          check_in_date?: string
          check_out_date?: string
          children?: number
          created_at?: string
          guest_id?: string
          id?: string
          notes?: string | null
          room_id?: string
          special_requests?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_tables: {
        Row: {
          area: string
          capacity: number
          created_at: string
          id: string
          status: string
          table_number: number
          updated_at: string
        }
        Insert: {
          area?: string
          capacity: number
          created_at?: string
          id?: string
          status?: string
          table_number: number
          updated_at?: string
        }
        Update: {
          area?: string
          capacity?: number
          created_at?: string
          id?: string
          status?: string
          table_number?: number
          updated_at?: string
        }
        Relationships: []
      }
      room_types: {
        Row: {
          amenities: string[] | null
          base_rate: number
          created_at: string
          description: string | null
          id: string
          max_occupancy: number
          name: string
          updated_at: string
        }
        Insert: {
          amenities?: string[] | null
          base_rate?: number
          created_at?: string
          description?: string | null
          id?: string
          max_occupancy?: number
          name: string
          updated_at?: string
        }
        Update: {
          amenities?: string[] | null
          base_rate?: number
          created_at?: string
          description?: string | null
          id?: string
          max_occupancy?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          created_at: string
          daily_rate: number
          floor_id: string
          id: string
          is_smoking: boolean
          max_occupancy: number
          notes: string | null
          room_number: string
          room_type_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_rate?: number
          floor_id: string
          id?: string
          is_smoking?: boolean
          max_occupancy?: number
          notes?: string | null
          room_number: string
          room_type_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_rate?: number
          floor_id?: string
          id?: string
          is_smoking?: boolean
          max_occupancy?: number
          notes?: string | null
          room_number?: string
          room_type_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          address: string | null
          assigned_rooms: string[] | null
          bank_account: string | null
          bank_name: string | null
          completed_today: number | null
          created_at: string
          date_of_birth: string | null
          department_id: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employee_code: string
          employment_type: string
          first_name: string
          gender: string | null
          hire_date: string
          id: string
          last_name: string
          marital_status: string | null
          national_id: string | null
          notes: string | null
          phone: string | null
          photo_url: string | null
          position: string
          rating: number | null
          salary: number | null
          specialties: string[] | null
          status: string
          tax_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          assigned_rooms?: string[] | null
          bank_account?: string | null
          bank_name?: string | null
          completed_today?: number | null
          created_at?: string
          date_of_birth?: string | null
          department_id?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_code: string
          employment_type?: string
          first_name: string
          gender?: string | null
          hire_date?: string
          id?: string
          last_name: string
          marital_status?: string | null
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          position: string
          rating?: number | null
          salary?: number | null
          specialties?: string[] | null
          status?: string
          tax_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          assigned_rooms?: string[] | null
          bank_account?: string | null
          bank_name?: string | null
          completed_today?: number | null
          created_at?: string
          date_of_birth?: string | null
          department_id?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_code?: string
          employment_type?: string
          first_name?: string
          gender?: string | null
          hire_date?: string
          id?: string
          last_name?: string
          marital_status?: string | null
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          position?: string
          rating?: number | null
          salary?: number | null
          specialties?: string[] | null
          status?: string
          tax_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_attendance: {
        Row: {
          approved_by: string | null
          attendance_date: string
          break_end: string | null
          break_start: string | null
          check_in_time: string | null
          check_out_time: string | null
          created_at: string
          early_leave_minutes: number | null
          hours_worked: number | null
          id: string
          late_minutes: number | null
          notes: string | null
          overtime_hours: number | null
          schedule_id: string | null
          staff_id: string
          status: string
        }
        Insert: {
          approved_by?: string | null
          attendance_date?: string
          break_end?: string | null
          break_start?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          early_leave_minutes?: number | null
          hours_worked?: number | null
          id?: string
          late_minutes?: number | null
          notes?: string | null
          overtime_hours?: number | null
          schedule_id?: string | null
          staff_id: string
          status?: string
        }
        Update: {
          approved_by?: string | null
          attendance_date?: string
          break_end?: string | null
          break_start?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          early_leave_minutes?: number | null
          hours_worked?: number | null
          id?: string
          late_minutes?: number | null
          notes?: string | null
          overtime_hours?: number | null
          schedule_id?: string | null
          staff_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_attendance_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_attendance_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "staff_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_attendance_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_schedules: {
        Row: {
          break_minutes: number | null
          created_at: string
          end_time: string
          id: string
          notes: string | null
          shift_date: string
          shift_type: string
          staff_id: string
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          break_minutes?: number | null
          created_at?: string
          end_time: string
          id?: string
          notes?: string | null
          shift_date: string
          shift_type?: string
          staff_id: string
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          break_minutes?: number | null
          created_at?: string
          end_time?: string
          id?: string
          notes?: string | null
          shift_date?: string
          shift_type?: string
          staff_id?: string
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_schedules_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          categories: string[] | null
          city: string | null
          contact_person: string | null
          country: string | null
          created_at: string
          credit_limit: number | null
          current_balance: number | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          rating: number | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          categories?: string[] | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          credit_limit?: number | null
          current_balance?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          rating?: number | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          categories?: string[] | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          credit_limit?: number | null
          current_balance?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          rating?: number | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      time_off_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          end_date: string
          id: string
          reason: string | null
          rejection_reason: string | null
          request_type: string
          staff_id: string
          start_date: string
          status: string
          total_days: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          end_date: string
          id?: string
          reason?: string | null
          rejection_reason?: string | null
          request_type: string
          staff_id: string
          start_date: string
          status?: string
          total_days?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          end_date?: string
          id?: string
          reason?: string | null
          rejection_reason?: string | null
          request_type?: string
          staff_id?: string
          start_date?: string
          status?: string
          total_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_off_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_order_number: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      user_role:
        | "admin"
        | "manager"
        | "front_desk"
        | "housekeeping"
        | "maintenance"
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
      user_role: [
        "admin",
        "manager",
        "front_desk",
        "housekeeping",
        "maintenance",
      ],
    },
  },
} as const
