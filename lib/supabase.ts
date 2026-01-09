import { createClient } from '@supabase/supabase-js';
import type { Database } from './types/database';

// Create Supabase client for server-side operations
// Uses service role key for full access (webhooks, automation)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️ Supabase credentials not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
}

export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceKey || 'placeholder',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Helper to check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// ============================================
// CUSTOMER OPERATIONS
// ============================================

export async function getCustomerByPhone(phone: string) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('phone_number', phone)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data;
}

export async function upsertCustomer(customer: {
  phone_number: string;
  name: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  square_footage?: number;
  bedrooms?: number;
  bathrooms?: number;
  pets?: string;
  frequency?: string;
  source?: string;
  notes?: string;
}) {
  const { data, error } = await supabase
    .from('customers')
    .upsert(customer, { onConflict: 'phone_number' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getCustomerContext(customerId: number) {
  const [customerResult, jobsResult, callsResult, messagesResult] = await Promise.all([
    supabase.from('customers').select('*').eq('id', customerId).single(),
    supabase.from('jobs').select('*').eq('customer_id', customerId).order('created_at', { ascending: false }).limit(10),
    supabase.from('calls').select('*').eq('customer_id', customerId).order('date', { ascending: false }).limit(5),
    supabase.from('messages').select('*').eq('customer_id', customerId).order('timestamp', { ascending: false }).limit(20)
  ]);

  return {
    customer: customerResult.data,
    jobs: jobsResult.data || [],
    calls: callsResult.data || [],
    messages: messagesResult.data || []
  };
}

// ============================================
// JOB OPERATIONS
// ============================================

export async function createJob(job: {
  customer_id: number;
  title: string;
  date: string;
  scheduled_at?: string;
  cleaning_type?: string;
  status?: string;
  price?: number;
  quote_amount?: number;
  hours?: number;
  notes?: string;
  special_instructions?: string;
}) {
  const { data, error } = await supabase
    .from('jobs')
    .insert(job)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateJob(jobId: number, updates: Partial<{
  status: string;
  booked: boolean;
  quoted: boolean;
  paid: boolean;
  price: number;
  cleaning_team: string[];
  invoice_url: string;
  wave_invoice_id: string;
  stripe_payment_id: string;
  stripe_payment_link: string;
  scheduled_at: string;
  notes: string;
}>) {
  const { data, error } = await supabase
    .from('jobs')
    .update(updates)
    .eq('id', jobId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getJobById(jobId: number) {
  const { data, error } = await supabase
    .from('jobs')
    .select('*, customers(*)')
    .eq('id', jobId)
    .single();

  if (error) throw error;
  return data;
}

export async function getUnassignedJobs() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*, customers(*)')
    .eq('paid', true)
    .or('cleaning_team.is.null,cleaning_team.eq.{}')
    .order('scheduled_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getJobsByDate(date: string) {
  const { data, error } = await supabase
    .from('jobs')
    .select('*, customers(*)')
    .eq('date', date)
    .order('scheduled_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

// ============================================
// CALL OPERATIONS
// ============================================

export async function createCall(call: {
  customer_id: number;
  vapi_call_id?: string;
  date: string;
  duration_seconds?: number;
  transcript?: string;
  summary?: string;
  audio_url?: string;
  outcome?: string;
  sentiment?: string;
  booking_intent?: boolean;
  extracted_data?: Record<string, unknown>;
}) {
  const { data, error } = await supabase
    .from('calls')
    .insert(call)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getCallByVapiId(vapiCallId: string) {
  const { data, error } = await supabase
    .from('calls')
    .select('*')
    .eq('vapi_call_id', vapiCallId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// ============================================
// MESSAGE OPERATIONS
// ============================================

export async function createMessage(message: {
  customer_id: number;
  call_id?: number;
  openphone_id?: string;
  role: 'client' | 'business' | 'bot';
  content: string;
  timestamp: string;
  direction?: 'inbound' | 'outbound';
  message_type?: string;
  ai_generated?: boolean;
}) {
  const { data, error } = await supabase
    .from('messages')
    .insert(message)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getMessageByOpenPhoneId(openphoneId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('openphone_id', openphoneId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getRecentMessages(customerId: number, limit = 20) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('customer_id', customerId)
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// ============================================
// CLEANER OPERATIONS
// ============================================

export async function getActiveCleaners() {
  const { data, error } = await supabase
    .from('cleaners')
    .select('*')
    .eq('active', true);

  if (error) throw error;
  return data || [];
}

export async function getCleanerByTelegramId(telegramId: string) {
  const { data, error } = await supabase
    .from('cleaners')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createCleanerAssignment(assignment: {
  cleaner_id: number;
  job_id: number;
  status?: string;
  notified_at?: string;
}) {
  const { data, error } = await supabase
    .from('cleaner_assignments')
    .insert(assignment)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCleanerAssignment(
  cleanerId: number,
  jobId: number,
  updates: {
    status: string;
    responded_at?: string;
    response_message?: string;
  }
) {
  const { data, error } = await supabase
    .from('cleaner_assignments')
    .update(updates)
    .eq('cleaner_id', cleanerId)
    .eq('job_id', jobId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getCleanerBlockedDates(cleanerId: number, startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('cleaner_blocked_dates')
    .select('*')
    .eq('cleaner_id', cleanerId)
    .gte('date', startDate)
    .lte('date', endDate);

  if (error) throw error;
  return data || [];
}

// ============================================
// QUOTE TEMPLATE OPERATIONS
// ============================================

export async function getQuoteTemplate(cleaningType: string) {
  const { data, error } = await supabase
    .from('quote_templates')
    .select('*')
    .eq('cleaning_type', cleaningType)
    .eq('active', true)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getAllQuoteTemplates() {
  const { data, error } = await supabase
    .from('quote_templates')
    .select('*')
    .eq('active', true);

  if (error) throw error;
  return data || [];
}

// ============================================
// SMS TEMPLATE OPERATIONS
// ============================================

export async function getSmsTemplate(triggerEvent: string) {
  const { data, error } = await supabase
    .from('sms_templates')
    .select('*')
    .eq('trigger_event', triggerEvent)
    .eq('active', true)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// ============================================
// AUTOMATION LOG OPERATIONS
// ============================================

export async function logAutomationEvent(log: {
  event_type: string;
  source: string;
  customer_id?: number;
  job_id?: number;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  success?: boolean;
  error_message?: string;
}) {
  const { data, error } = await supabase
    .from('automation_logs')
    .insert(log)
    .select()
    .single();

  if (error) {
    console.error('Failed to log automation event:', error);
  }
  return data;
}
