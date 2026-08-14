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
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          parent_id: string | null
          parent_type: Database["public"]["Enums"]["parent_kind"] | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          parent_id?: string | null
          parent_type?: Database["public"]["Enums"]["parent_kind"] | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          parent_id?: string | null
          parent_type?: Database["public"]["Enums"]["parent_kind"] | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_user_connections: {
        Row: {
          connection_key_ciphertext: string
          connector_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_key_ciphertext: string
          connector_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_key_ciphertext?: string
          connector_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          annual_revenue: number | null
          auc: number | null
          city: string | null
          client_type: string | null
          co_owner_id: string | null
          company_name: string
          country: string | null
          created_at: string
          end_owner_id: string | null
          expected_close_date: string | null
          id: string
          industry: string | null
          lead_source: string | null
          originating_lead_id: string | null
          owner_id: string
          priority: Database["public"]["Enums"]["priority_level"]
          referral_by: string | null
          remarks: string | null
          service_type: string | null
          services: string[]
          status: Database["public"]["Enums"]["client_status"]
          sub_category: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          annual_revenue?: number | null
          auc?: number | null
          city?: string | null
          client_type?: string | null
          co_owner_id?: string | null
          company_name: string
          country?: string | null
          created_at?: string
          end_owner_id?: string | null
          expected_close_date?: string | null
          id?: string
          industry?: string | null
          lead_source?: string | null
          originating_lead_id?: string | null
          owner_id: string
          priority?: Database["public"]["Enums"]["priority_level"]
          referral_by?: string | null
          remarks?: string | null
          service_type?: string | null
          services?: string[]
          status?: Database["public"]["Enums"]["client_status"]
          sub_category?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          annual_revenue?: number | null
          auc?: number | null
          city?: string | null
          client_type?: string | null
          co_owner_id?: string | null
          company_name?: string
          country?: string | null
          created_at?: string
          end_owner_id?: string | null
          expected_close_date?: string | null
          id?: string
          industry?: string | null
          lead_source?: string | null
          originating_lead_id?: string | null
          owner_id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          referral_by?: string | null
          remarks?: string | null
          service_type?: string | null
          services?: string[]
          status?: Database["public"]["Enums"]["client_status"]
          sub_category?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_co_owner_id_fkey"
            columns: ["co_owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_end_owner_id_fkey"
            columns: ["end_owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_originating_lead_fk"
            columns: ["originating_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_originating_lead_fk"
            columns: ["originating_lead_id"]
            isOneToOne: false
            referencedRelation: "lost_leads_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          department: string | null
          designation: string | null
          email: string | null
          id: string
          is_primary: boolean
          linkedin_url: string | null
          name: string
          notes: string | null
          parent_id: string
          parent_type: Database["public"]["Enums"]["parent_kind"]
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          designation?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean
          linkedin_url?: string | null
          name: string
          notes?: string | null
          parent_id: string
          parent_type: Database["public"]["Enums"]["parent_kind"]
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          designation?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean
          linkedin_url?: string | null
          name?: string
          notes?: string | null
          parent_id?: string
          parent_type?: Database["public"]["Enums"]["parent_kind"]
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          owner_id: string
          parent_id: string
          parent_type: Database["public"]["Enums"]["parent_kind"]
          size_bytes: number | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          owner_id: string
          parent_id: string
          parent_type: Database["public"]["Enums"]["parent_kind"]
          size_bytes?: number | null
          storage_path: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          owner_id?: string
          parent_id?: string
          parent_type?: Database["public"]["Enums"]["parent_kind"]
          size_bytes?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      followups: {
        Row: {
          completed_at: string | null
          completion_notes: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          due_date: string
          id: string
          is_deleted: boolean
          owner_id: string
          parent_id: string
          parent_type: Database["public"]["Enums"]["parent_kind"]
          priority: Database["public"]["Enums"]["priority_level"]
          reminder_sent_at: string | null
          status: Database["public"]["Enums"]["followup_status"]
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          due_date: string
          id?: string
          is_deleted?: boolean
          owner_id: string
          parent_id: string
          parent_type: Database["public"]["Enums"]["parent_kind"]
          priority?: Database["public"]["Enums"]["priority_level"]
          reminder_sent_at?: string | null
          status?: Database["public"]["Enums"]["followup_status"]
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          due_date?: string
          id?: string
          is_deleted?: boolean
          owner_id?: string
          parent_id?: string
          parent_type?: Database["public"]["Enums"]["parent_kind"]
          priority?: Database["public"]["Enums"]["priority_level"]
          reminder_sent_at?: string | null
          status?: Database["public"]["Enums"]["followup_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followups_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followups_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_status_events: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["lead_status"] | null
          id: string
          lead_id: string
          reason_code: Database["public"]["Enums"]["lead_lost_reason"] | null
          reason_note: string | null
          to_status: Database["public"]["Enums"]["lead_status"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["lead_status"] | null
          id?: string
          lead_id: string
          reason_code?: Database["public"]["Enums"]["lead_lost_reason"] | null
          reason_note?: string | null
          to_status: Database["public"]["Enums"]["lead_status"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["lead_status"] | null
          id?: string
          lead_id?: string
          reason_code?: Database["public"]["Enums"]["lead_lost_reason"] | null
          reason_note?: string | null
          to_status?: Database["public"]["Enums"]["lead_status"]
        }
        Relationships: [
          {
            foreignKeyName: "lead_status_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_status_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_status_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lost_leads_v"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          auc: number | null
          city: string | null
          client_type: string | null
          co_owner_id: string | null
          company_name: string
          converted_client_id: string | null
          country: string | null
          created_at: string
          end_owner_id: string | null
          estimated_annual_revenue: number | null
          estimated_deal_value: number | null
          expected_close_date: string | null
          id: string
          industry: string | null
          lead_source: string | null
          lost_at: string | null
          lost_by_user_id: string | null
          lost_reason: string | null
          lost_reason_code:
            | Database["public"]["Enums"]["lead_lost_reason"]
            | null
          lost_reason_note: string | null
          notes: string | null
          owner_id: string
          pipeline_stage: Database["public"]["Enums"]["pipeline_stage"]
          priority: Database["public"]["Enums"]["priority_level"]
          probability: number | null
          referral_by: string | null
          services: string[]
          shared_with_team: boolean
          state: string | null
          status: Database["public"]["Enums"]["lead_status"]
          sub_category: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          auc?: number | null
          city?: string | null
          client_type?: string | null
          co_owner_id?: string | null
          company_name: string
          converted_client_id?: string | null
          country?: string | null
          created_at?: string
          end_owner_id?: string | null
          estimated_annual_revenue?: number | null
          estimated_deal_value?: number | null
          expected_close_date?: string | null
          id?: string
          industry?: string | null
          lead_source?: string | null
          lost_at?: string | null
          lost_by_user_id?: string | null
          lost_reason?: string | null
          lost_reason_code?:
            | Database["public"]["Enums"]["lead_lost_reason"]
            | null
          lost_reason_note?: string | null
          notes?: string | null
          owner_id: string
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          priority?: Database["public"]["Enums"]["priority_level"]
          probability?: number | null
          referral_by?: string | null
          services?: string[]
          shared_with_team?: boolean
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          sub_category?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          auc?: number | null
          city?: string | null
          client_type?: string | null
          co_owner_id?: string | null
          company_name?: string
          converted_client_id?: string | null
          country?: string | null
          created_at?: string
          end_owner_id?: string | null
          estimated_annual_revenue?: number | null
          estimated_deal_value?: number | null
          expected_close_date?: string | null
          id?: string
          industry?: string | null
          lead_source?: string | null
          lost_at?: string | null
          lost_by_user_id?: string | null
          lost_reason?: string | null
          lost_reason_code?:
            | Database["public"]["Enums"]["lead_lost_reason"]
            | null
          lost_reason_note?: string | null
          notes?: string | null
          owner_id?: string
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          priority?: Database["public"]["Enums"]["priority_level"]
          probability?: number | null
          referral_by?: string | null
          services?: string[]
          shared_with_team?: boolean
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          sub_category?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_co_owner_id_fkey"
            columns: ["co_owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_client_id_fkey"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_end_owner_id_fkey"
            columns: ["end_owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_lost_by_user_id_fkey"
            columns: ["lost_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          action_items: string | null
          agenda: string | null
          attendees: Json | null
          created_at: string
          discussion_summary: string | null
          duration_minutes: number | null
          id: string
          meeting_date: string
          meeting_type: string
          next_followup_date: string | null
          outlook_change_key: string | null
          outlook_event_id: string | null
          outlook_ical_uid: string | null
          outlook_last_synced_at: string | null
          outlook_sync_error: string | null
          owner_id: string
          parent_id: string
          parent_type: Database["public"]["Enums"]["parent_kind"]
          reminder_sent_at: string | null
          status: Database["public"]["Enums"]["meeting_status"]
          updated_at: string
        }
        Insert: {
          action_items?: string | null
          agenda?: string | null
          attendees?: Json | null
          created_at?: string
          discussion_summary?: string | null
          duration_minutes?: number | null
          id?: string
          meeting_date: string
          meeting_type?: string
          next_followup_date?: string | null
          outlook_change_key?: string | null
          outlook_event_id?: string | null
          outlook_ical_uid?: string | null
          outlook_last_synced_at?: string | null
          outlook_sync_error?: string | null
          owner_id: string
          parent_id: string
          parent_type: Database["public"]["Enums"]["parent_kind"]
          reminder_sent_at?: string | null
          status?: Database["public"]["Enums"]["meeting_status"]
          updated_at?: string
        }
        Update: {
          action_items?: string | null
          agenda?: string | null
          attendees?: Json | null
          created_at?: string
          discussion_summary?: string | null
          duration_minutes?: number | null
          id?: string
          meeting_date?: string
          meeting_type?: string
          next_followup_date?: string | null
          outlook_change_key?: string | null
          outlook_event_id?: string | null
          outlook_ical_uid?: string | null
          outlook_last_synced_at?: string | null
          outlook_sync_error?: string | null
          owner_id?: string
          parent_id?: string
          parent_type?: Database["public"]["Enums"]["parent_kind"]
          reminder_sent_at?: string | null
          status?: Database["public"]["Enums"]["meeting_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_deleted: boolean
          owner_id: string
          parent_id: string
          parent_type: Database["public"]["Enums"]["parent_kind"]
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_deleted?: boolean
          owner_id: string
          parent_id: string
          parent_type: Database["public"]["Enums"]["parent_kind"]
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_deleted?: boolean
          owner_id?: string
          parent_id?: string
          parent_type?: Database["public"]["Enums"]["parent_kind"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_terminal: boolean
          name: string
        }
        Insert: {
          created_at?: string
          display_order: number
          id?: string
          is_terminal?: boolean
          name: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_terminal?: boolean
          name?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          due_date: string | null
          id: string
          is_deleted: boolean
          owner_id: string
          parent_id: string | null
          parent_type: Database["public"]["Enums"]["parent_kind"] | null
          priority: Database["public"]["Enums"]["priority_level"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_deleted?: boolean
          owner_id: string
          parent_id?: string | null
          parent_type?: Database["public"]["Enums"]["parent_kind"] | null
          priority?: Database["public"]["Enums"]["priority_level"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_deleted?: boolean
          owner_id?: string
          parent_id?: string | null
          parent_type?: Database["public"]["Enums"]["parent_kind"] | null
          priority?: Database["public"]["Enums"]["priority_level"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
      users: {
        Row: {
          auth_user_id: string | null
          created_at: string
          department: string
          designation: string
          email: string
          full_name: string
          id: string
          inactivity_email_sent_at: string | null
          last_active_at: string | null
          last_login_at: string | null
          phone: string | null
          reports_to_user_id: string | null
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          department?: string
          designation: string
          email: string
          full_name: string
          id?: string
          inactivity_email_sent_at?: string | null
          last_active_at?: string | null
          last_login_at?: string | null
          phone?: string | null
          reports_to_user_id?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          department?: string
          designation?: string
          email?: string
          full_name?: string
          id?: string
          inactivity_email_sent_at?: string | null
          last_active_at?: string | null
          last_login_at?: string | null
          phone?: string | null
          reports_to_user_id?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_reports_to_user_id_fkey"
            columns: ["reports_to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      lost_leads_v: {
        Row: {
          auc: number | null
          city: string | null
          client_type: string | null
          co_owner_id: string | null
          company_name: string | null
          converted_client_id: string | null
          country: string | null
          created_at: string | null
          end_owner_id: string | null
          estimated_annual_revenue: number | null
          estimated_deal_value: number | null
          expected_close_date: string | null
          id: string | null
          industry: string | null
          lead_source: string | null
          lost_at: string | null
          lost_by_name: string | null
          lost_by_user_id: string | null
          lost_reason: string | null
          lost_reason_code:
            | Database["public"]["Enums"]["lead_lost_reason"]
            | null
          lost_reason_note: string | null
          notes: string | null
          owner_id: string | null
          owner_name: string | null
          pipeline_stage: Database["public"]["Enums"]["pipeline_stage"] | null
          priority: Database["public"]["Enums"]["priority_level"] | null
          probability: number | null
          referral_by: string | null
          services: string[] | null
          shared_with_team: boolean | null
          state: string | null
          status: Database["public"]["Enums"]["lead_status"] | null
          sub_category: string | null
          updated_at: string | null
          website: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_co_owner_id_fkey"
            columns: ["co_owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_client_id_fkey"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_end_owner_id_fkey"
            columns: ["end_owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_lost_by_user_id_fkey"
            columns: ["lost_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_access_owner: { Args: { target_owner_id: string }; Returns: boolean }
      can_access_parent: {
        Args: {
          p_id: string
          p_type: Database["public"]["Enums"]["parent_kind"]
        }
        Returns: boolean
      }
      can_view_user: { Args: { target_user_id: string }; Returns: boolean }
      current_app_user_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hierarchy_end_owner: { Args: { _user_id: string }; Returns: string }
      is_descendant_of: {
        Args: { manager_user_id: string; target_user_id: string }
        Returns: boolean
      }
      is_top_of_tree: { Args: never; Returns: boolean }
      list_end_ownership_targets: {
        Args: never
        Returns: {
          designation: string
          full_name: string
          id: string
        }[]
      }
      record_user_login: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "system_admin"
      client_status: "active" | "inactive" | "onboarded"
      followup_status: "pending" | "completed"
      lead_lost_reason:
        | "requires_bank_custodian"
        | "lack_of_follow_ups"
        | "inadequate_commercial_quotations"
        | "other"
        | "not_recorded"
      lead_status: "active" | "won" | "lost" | "archived"
      meeting_status: "scheduled" | "completed" | "cancelled"
      parent_kind: "lead" | "client"
      pipeline_stage:
        | "Prospect"
        | "Contacted"
        | "Meeting Scheduled"
        | "Meeting Completed"
        | "Proposal Sent"
        | "Negotiation"
        | "Mandate Signed"
        | "Onboarding"
        | "Won"
        | "Lost"
      priority_level: "low" | "medium" | "high"
      task_status: "open" | "in_progress" | "completed" | "cancelled"
      user_status: "active" | "inactive"
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
      app_role: ["system_admin"],
      client_status: ["active", "inactive", "onboarded"],
      followup_status: ["pending", "completed"],
      lead_lost_reason: [
        "requires_bank_custodian",
        "lack_of_follow_ups",
        "inadequate_commercial_quotations",
        "other",
        "not_recorded",
      ],
      lead_status: ["active", "won", "lost", "archived"],
      meeting_status: ["scheduled", "completed", "cancelled"],
      parent_kind: ["lead", "client"],
      pipeline_stage: [
        "Prospect",
        "Contacted",
        "Meeting Scheduled",
        "Meeting Completed",
        "Proposal Sent",
        "Negotiation",
        "Mandate Signed",
        "Onboarding",
        "Won",
        "Lost",
      ],
      priority_level: ["low", "medium", "high"],
      task_status: ["open", "in_progress", "completed", "cancelled"],
      user_status: ["active", "inactive"],
    },
  },
} as const
