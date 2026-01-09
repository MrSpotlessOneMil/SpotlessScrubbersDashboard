// Auto-generated types for Supabase database
// These match the schema defined in lib/schema.sql

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      settings: {
        Row: {
          id: number;
          spreadsheet_id: string | null;
          hourly_rate: number;
          cost_per_job: number;
          business_name: string;
          business_phone: string | null;
          business_email: string | null;
          updated_at: string;
        };
        Insert: {
          id?: number;
          spreadsheet_id?: string | null;
          hourly_rate?: number;
          cost_per_job?: number;
          business_name?: string;
          business_phone?: string | null;
          business_email?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: number;
          spreadsheet_id?: string | null;
          hourly_rate?: number;
          cost_per_job?: number;
          business_name?: string;
          business_phone?: string | null;
          business_email?: string | null;
          updated_at?: string;
        };
      };
      customers: {
        Row: {
          id: number;
          phone_number: string;
          name: string;
          email: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          zip_code: string | null;
          square_footage: number | null;
          bedrooms: number | null;
          bathrooms: number | null;
          pets: string | null;
          frequency: string | null;
          preferred_day: string | null;
          preferred_time: string | null;
          source: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          phone_number: string;
          name: string;
          email?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          square_footage?: number | null;
          bedrooms?: number | null;
          bathrooms?: number | null;
          pets?: string | null;
          frequency?: string | null;
          preferred_day?: string | null;
          preferred_time?: string | null;
          source?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          phone_number?: string;
          name?: string;
          email?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          square_footage?: number | null;
          bedrooms?: number | null;
          bathrooms?: number | null;
          pets?: string | null;
          frequency?: string | null;
          preferred_day?: string | null;
          preferred_time?: string | null;
          source?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      jobs: {
        Row: {
          id: number;
          customer_id: number;
          title: string;
          date: string;
          scheduled_at: string | null;
          end_time: string | null;
          status: string;
          cleaning_team: string[] | null;
          cleaning_type: string | null;
          booked: boolean;
          quoted: boolean;
          paid: boolean;
          price: number | null;
          quote_amount: number | null;
          hours: number | null;
          invoice_url: string | null;
          wave_invoice_id: string | null;
          stripe_payment_id: string | null;
          stripe_payment_link: string | null;
          payment_method: string | null;
          notes: string | null;
          special_instructions: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          customer_id: number;
          title: string;
          date: string;
          scheduled_at?: string | null;
          end_time?: string | null;
          status?: string;
          cleaning_team?: string[] | null;
          cleaning_type?: string | null;
          booked?: boolean;
          quoted?: boolean;
          paid?: boolean;
          price?: number | null;
          quote_amount?: number | null;
          hours?: number | null;
          invoice_url?: string | null;
          wave_invoice_id?: string | null;
          stripe_payment_id?: string | null;
          stripe_payment_link?: string | null;
          payment_method?: string | null;
          notes?: string | null;
          special_instructions?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          customer_id?: number;
          title?: string;
          date?: string;
          scheduled_at?: string | null;
          end_time?: string | null;
          status?: string;
          cleaning_team?: string[] | null;
          cleaning_type?: string | null;
          booked?: boolean;
          quoted?: boolean;
          paid?: boolean;
          price?: number | null;
          quote_amount?: number | null;
          hours?: number | null;
          invoice_url?: string | null;
          wave_invoice_id?: string | null;
          stripe_payment_id?: string | null;
          stripe_payment_link?: string | null;
          payment_method?: string | null;
          notes?: string | null;
          special_instructions?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      calls: {
        Row: {
          id: number;
          customer_id: number;
          vapi_call_id: string | null;
          date: string;
          duration_seconds: number | null;
          transcript: string | null;
          summary: string | null;
          audio_url: string | null;
          outcome: string | null;
          sentiment: string | null;
          booking_intent: boolean;
          extracted_data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          customer_id: number;
          vapi_call_id?: string | null;
          date: string;
          duration_seconds?: number | null;
          transcript?: string | null;
          summary?: string | null;
          audio_url?: string | null;
          outcome?: string | null;
          sentiment?: string | null;
          booking_intent?: boolean;
          extracted_data?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          customer_id?: number;
          vapi_call_id?: string | null;
          date?: string;
          duration_seconds?: number | null;
          transcript?: string | null;
          summary?: string | null;
          audio_url?: string | null;
          outcome?: string | null;
          sentiment?: string | null;
          booking_intent?: boolean;
          extracted_data?: Json | null;
          created_at?: string;
        };
      };
      messages: {
        Row: {
          id: number;
          customer_id: number;
          call_id: number | null;
          openphone_id: string | null;
          role: string;
          content: string;
          timestamp: string;
          direction: string | null;
          message_type: string;
          ai_generated: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          customer_id: number;
          call_id?: number | null;
          openphone_id?: string | null;
          role: string;
          content: string;
          timestamp: string;
          direction?: string | null;
          message_type?: string;
          ai_generated?: boolean;
          created_at?: string;
        };
        Update: {
          id?: number;
          customer_id?: number;
          call_id?: number | null;
          openphone_id?: string | null;
          role?: string;
          content?: string;
          timestamp?: string;
          direction?: string | null;
          message_type?: string;
          ai_generated?: boolean;
          created_at?: string;
        };
      };
      cleaners: {
        Row: {
          id: number;
          name: string;
          phone: string | null;
          email: string | null;
          telegram_id: string | null;
          telegram_username: string | null;
          active: boolean;
          skills: string[] | null;
          hourly_rate: number | null;
          max_hours_per_day: number;
          preferred_areas: string[] | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          phone?: string | null;
          email?: string | null;
          telegram_id?: string | null;
          telegram_username?: string | null;
          active?: boolean;
          skills?: string[] | null;
          hourly_rate?: number | null;
          max_hours_per_day?: number;
          preferred_areas?: string[] | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          phone?: string | null;
          email?: string | null;
          telegram_id?: string | null;
          telegram_username?: string | null;
          active?: boolean;
          skills?: string[] | null;
          hourly_rate?: number | null;
          max_hours_per_day?: number;
          preferred_areas?: string[] | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      cleaner_assignments: {
        Row: {
          id: number;
          cleaner_id: number;
          job_id: number;
          status: string;
          notified_at: string | null;
          responded_at: string | null;
          response_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          cleaner_id: number;
          job_id: number;
          status?: string;
          notified_at?: string | null;
          responded_at?: string | null;
          response_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          cleaner_id?: number;
          job_id?: number;
          status?: string;
          notified_at?: string | null;
          responded_at?: string | null;
          response_message?: string | null;
          created_at?: string;
        };
      };
      cleaner_blocked_dates: {
        Row: {
          id: number;
          cleaner_id: number;
          date: string;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          cleaner_id: number;
          date: string;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          cleaner_id?: number;
          date?: string;
          reason?: string | null;
          created_at?: string;
        };
      };
      automation_logs: {
        Row: {
          id: number;
          event_type: string;
          source: string | null;
          customer_id: number | null;
          job_id: number | null;
          payload: Json | null;
          result: Json | null;
          success: boolean;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          event_type: string;
          source?: string | null;
          customer_id?: number | null;
          job_id?: number | null;
          payload?: Json | null;
          result?: Json | null;
          success?: boolean;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          event_type?: string;
          source?: string | null;
          customer_id?: number | null;
          job_id?: number | null;
          payload?: Json | null;
          result?: Json | null;
          success?: boolean;
          error_message?: string | null;
          created_at?: string;
        };
      };
      quote_templates: {
        Row: {
          id: number;
          cleaning_type: string;
          base_price: number;
          price_per_sqft: number | null;
          price_per_bedroom: number | null;
          price_per_bathroom: number | null;
          min_price: number | null;
          max_price: number | null;
          estimated_hours: number | null;
          description: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          cleaning_type: string;
          base_price: number;
          price_per_sqft?: number | null;
          price_per_bedroom?: number | null;
          price_per_bathroom?: number | null;
          min_price?: number | null;
          max_price?: number | null;
          estimated_hours?: number | null;
          description?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: number;
          cleaning_type?: string;
          base_price?: number;
          price_per_sqft?: number | null;
          price_per_bedroom?: number | null;
          price_per_bathroom?: number | null;
          min_price?: number | null;
          max_price?: number | null;
          estimated_hours?: number | null;
          description?: string | null;
          active?: boolean;
          created_at?: string;
        };
      };
      sms_templates: {
        Row: {
          id: number;
          name: string;
          trigger_event: string | null;
          content: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          trigger_event?: string | null;
          content: string;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          trigger_event?: string | null;
          content?: string;
          active?: boolean;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Convenience type aliases
export type Customer = Database['public']['Tables']['customers']['Row'];
export type CustomerInsert = Database['public']['Tables']['customers']['Insert'];
export type CustomerUpdate = Database['public']['Tables']['customers']['Update'];

export type Job = Database['public']['Tables']['jobs']['Row'];
export type JobInsert = Database['public']['Tables']['jobs']['Insert'];
export type JobUpdate = Database['public']['Tables']['jobs']['Update'];

export type Call = Database['public']['Tables']['calls']['Row'];
export type CallInsert = Database['public']['Tables']['calls']['Insert'];
export type CallUpdate = Database['public']['Tables']['calls']['Update'];

export type Message = Database['public']['Tables']['messages']['Row'];
export type MessageInsert = Database['public']['Tables']['messages']['Insert'];
export type MessageUpdate = Database['public']['Tables']['messages']['Update'];

export type Cleaner = Database['public']['Tables']['cleaners']['Row'];
export type CleanerInsert = Database['public']['Tables']['cleaners']['Insert'];
export type CleanerUpdate = Database['public']['Tables']['cleaners']['Update'];

export type CleanerAssignment = Database['public']['Tables']['cleaner_assignments']['Row'];
export type CleanerAssignmentInsert = Database['public']['Tables']['cleaner_assignments']['Insert'];

export type QuoteTemplate = Database['public']['Tables']['quote_templates']['Row'];
export type SmsTemplate = Database['public']['Tables']['sms_templates']['Row'];
export type AutomationLog = Database['public']['Tables']['automation_logs']['Row'];
