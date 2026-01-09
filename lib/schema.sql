-- The Clean Machine Dashboard Database Schema (Extended for Automation)
-- Run these queries in Supabase SQL Editor to set up your database

-- ============================================
-- CORE TABLES
-- ============================================

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  spreadsheet_id VARCHAR(255),
  hourly_rate DECIMAL(10,2) DEFAULT 25.00,
  cost_per_job DECIMAL(10,2) DEFAULT 50.00,
  business_name VARCHAR(255) DEFAULT 'Spotless Scrubbers',
  business_phone VARCHAR(20),
  business_email VARCHAR(255),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Customers table (extended)
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(10),
  square_footage INTEGER,
  bedrooms INTEGER,
  bathrooms DECIMAL(3,1),
  pets TEXT,
  frequency VARCHAR(50), -- one-time, weekly, bi-weekly, monthly
  preferred_day VARCHAR(20),
  preferred_time VARCHAR(20),
  source VARCHAR(100), -- call, text, referral, website
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Jobs table (extended)
CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  scheduled_at TIMESTAMP,
  end_time TIMESTAMP,
  status VARCHAR(50) DEFAULT 'lead', -- lead, quoted, booked, confirmed, in_progress, completed, cancelled
  cleaning_team TEXT[], -- array of cleaner names
  cleaning_type VARCHAR(50), -- standard, deep, move-in, move-out, post-construction
  booked BOOLEAN DEFAULT false,
  quoted BOOLEAN DEFAULT false,
  paid BOOLEAN DEFAULT false,
  price DECIMAL(10,2),
  quote_amount DECIMAL(10,2),
  hours DECIMAL(5,2),
  invoice_url TEXT,
  wave_invoice_id VARCHAR(100),
  stripe_payment_id VARCHAR(100),
  stripe_payment_link VARCHAR(500),
  payment_method VARCHAR(50), -- stripe, cash, check, venmo
  notes TEXT,
  special_instructions TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Calls table (extended for Vapi)
CREATE TABLE IF NOT EXISTS calls (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  vapi_call_id VARCHAR(100) UNIQUE,
  date TIMESTAMP NOT NULL,
  duration_seconds INTEGER,
  transcript TEXT,
  summary TEXT,
  audio_url VARCHAR(500),
  outcome VARCHAR(50), -- booked, follow_up, not_interested, voicemail, missed
  sentiment VARCHAR(50), -- positive, neutral, negative
  booking_intent BOOLEAN DEFAULT false,
  extracted_data JSONB, -- AI-extracted info from call
  created_at TIMESTAMP DEFAULT NOW()
);

-- Messages table (extended for OpenPhone)
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  call_id INTEGER REFERENCES calls(id) ON DELETE SET NULL,
  openphone_id VARCHAR(100) UNIQUE,
  role VARCHAR(20) NOT NULL, -- 'client', 'business', 'bot'
  content TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  direction VARCHAR(20), -- inbound, outbound
  message_type VARCHAR(20) DEFAULT 'text', -- text, call_transcript, system
  ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- AUTOMATION TABLES
-- ============================================

-- Cleaners table
CREATE TABLE IF NOT EXISTS cleaners (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  telegram_id VARCHAR(100),
  telegram_username VARCHAR(100),
  active BOOLEAN DEFAULT true,
  skills TEXT[], -- deep_clean, standard, move_out, post_construction
  hourly_rate DECIMAL(10,2),
  max_hours_per_day INTEGER DEFAULT 8,
  preferred_areas TEXT[], -- zip codes or areas they prefer
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Cleaner availability/assignments
CREATE TABLE IF NOT EXISTS cleaner_assignments (
  id SERIAL PRIMARY KEY,
  cleaner_id INTEGER REFERENCES cleaners(id) ON DELETE CASCADE,
  job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, declined, confirmed
  notified_at TIMESTAMP,
  responded_at TIMESTAMP,
  response_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(cleaner_id, job_id)
);

-- Cleaner time off / blocked dates
CREATE TABLE IF NOT EXISTS cleaner_blocked_dates (
  id SERIAL PRIMARY KEY,
  cleaner_id INTEGER REFERENCES cleaners(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  reason VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(cleaner_id, date)
);

-- Automation event logs
CREATE TABLE IF NOT EXISTS automation_logs (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL, -- vapi_call, sms_inbound, sms_outbound, payment, booking, cleaner_dispatch
  source VARCHAR(50), -- vapi, openphone, stripe, telegram, system
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  payload JSONB,
  result JSONB,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Quote templates
CREATE TABLE IF NOT EXISTS quote_templates (
  id SERIAL PRIMARY KEY,
  cleaning_type VARCHAR(50) NOT NULL,
  base_price DECIMAL(10,2) NOT NULL,
  price_per_sqft DECIMAL(10,4),
  price_per_bedroom DECIMAL(10,2),
  price_per_bathroom DECIMAL(10,2),
  min_price DECIMAL(10,2),
  max_price DECIMAL(10,2),
  estimated_hours DECIMAL(5,2),
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- SMS templates
CREATE TABLE IF NOT EXISTS sms_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  trigger_event VARCHAR(50), -- booking_confirmed, payment_received, reminder, follow_up
  content TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone_number);
CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_date ON jobs(date);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_calls_customer ON calls(customer_id);
CREATE INDEX IF NOT EXISTS idx_calls_date ON calls(date);
CREATE INDEX IF NOT EXISTS idx_calls_vapi_id ON calls(vapi_call_id);
CREATE INDEX IF NOT EXISTS idx_messages_customer ON messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_messages_openphone_id ON messages(openphone_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_cleaners_telegram ON cleaners(telegram_id);
CREATE INDEX IF NOT EXISTS idx_cleaner_assignments_job ON cleaner_assignments(job_id);
CREATE INDEX IF NOT EXISTS idx_cleaner_assignments_status ON cleaner_assignments(status);
CREATE INDEX IF NOT EXISTS idx_automation_logs_type ON automation_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created ON automation_logs(created_at);

-- ============================================
-- ROW LEVEL SECURITY (for Supabase)
-- ============================================

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaners ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaner_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for API routes)
CREATE POLICY "Service role full access" ON customers FOR ALL USING (true);
CREATE POLICY "Service role full access" ON jobs FOR ALL USING (true);
CREATE POLICY "Service role full access" ON calls FOR ALL USING (true);
CREATE POLICY "Service role full access" ON messages FOR ALL USING (true);
CREATE POLICY "Service role full access" ON cleaners FOR ALL USING (true);
CREATE POLICY "Service role full access" ON cleaner_assignments FOR ALL USING (true);
CREATE POLICY "Service role full access" ON automation_logs FOR ALL USING (true);

-- ============================================
-- INITIAL DATA
-- ============================================

-- Default settings
INSERT INTO settings (id, hourly_rate, cost_per_job, business_name)
VALUES (1, 25.00, 50.00, 'Spotless Scrubbers')
ON CONFLICT (id) DO NOTHING;

-- Default quote templates
INSERT INTO quote_templates (cleaning_type, base_price, price_per_sqft, price_per_bedroom, price_per_bathroom, min_price, estimated_hours, description)
VALUES
  ('standard', 100.00, 0.05, 15.00, 20.00, 100.00, 3, 'Regular maintenance cleaning'),
  ('deep', 200.00, 0.08, 25.00, 35.00, 200.00, 5, 'Deep cleaning with detailed attention'),
  ('move-in', 250.00, 0.10, 30.00, 40.00, 250.00, 6, 'Move-in ready cleaning'),
  ('move-out', 250.00, 0.10, 30.00, 40.00, 250.00, 6, 'Move-out cleaning for deposits'),
  ('post-construction', 350.00, 0.15, 40.00, 50.00, 350.00, 8, 'Post-construction debris and dust removal')
ON CONFLICT DO NOTHING;

-- Default SMS templates
INSERT INTO sms_templates (name, trigger_event, content)
VALUES
  ('Booking Confirmed', 'booking_confirmed', 'Hi {{name}}! Your cleaning is confirmed for {{date}} at {{time}}. Your cleaner {{cleaner}} will arrive on time. Reply with any questions!'),
  ('Payment Received', 'payment_received', 'Thank you {{name}}! We received your payment of ${{amount}}. See you on {{date}}! 🧹'),
  ('Reminder 24h', 'reminder_24h', 'Hi {{name}}! Just a reminder - your cleaning is tomorrow at {{time}}. Please ensure access is available. See you soon!'),
  ('Follow Up', 'follow_up', 'Hi {{name}}, this is Spotless Scrubbers following up on your cleaning inquiry. Would you like to schedule your appointment? Reply or call us anytime!'),
  ('Job Complete', 'job_complete', 'Hi {{name}}! Your cleaning is complete. We hope everything looks spotless! Would you mind leaving us a review? {{review_link}}')
ON CONFLICT DO NOTHING;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cleaners_updated_at ON cleaners;
CREATE TRIGGER update_cleaners_updated_at
  BEFORE UPDATE ON cleaners
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- JOB CHANGE NOTIFICATION FUNCTION
-- ============================================
-- This function logs when important job fields change
-- You can extend this to call your webhook endpoint via pg_net or Supabase Edge Functions

CREATE OR REPLACE FUNCTION log_job_changes()
RETURNS TRIGGER AS $$
DECLARE
  changed_fields TEXT[];
  webhook_payload JSONB;
BEGIN
  -- Track which fields changed
  changed_fields := ARRAY[]::TEXT[];

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    changed_fields := array_append(changed_fields, 'status');
  END IF;

  IF OLD.cleaning_team IS DISTINCT FROM NEW.cleaning_team THEN
    changed_fields := array_append(changed_fields, 'cleaning_team');
  END IF;

  IF OLD.scheduled_at IS DISTINCT FROM NEW.scheduled_at THEN
    changed_fields := array_append(changed_fields, 'scheduled_at');
  END IF;

  IF OLD.paid IS DISTINCT FROM NEW.paid THEN
    changed_fields := array_append(changed_fields, 'paid');
  END IF;

  IF OLD.price IS DISTINCT FROM NEW.price THEN
    changed_fields := array_append(changed_fields, 'price');
  END IF;

  -- Only log if something important changed
  IF array_length(changed_fields, 1) > 0 THEN
    -- Log to automation_logs table
    INSERT INTO automation_logs (
      event_type,
      source,
      customer_id,
      job_id,
      payload,
      success
    ) VALUES (
      'job_changed',
      'database_trigger',
      NEW.customer_id,
      NEW.id,
      jsonb_build_object(
        'changedFields', changed_fields,
        'previousValues', jsonb_build_object(
          'status', OLD.status,
          'cleaning_team', OLD.cleaning_team,
          'scheduled_at', OLD.scheduled_at,
          'paid', OLD.paid,
          'price', OLD.price
        ),
        'newValues', jsonb_build_object(
          'status', NEW.status,
          'cleaning_team', NEW.cleaning_team,
          'scheduled_at', NEW.scheduled_at,
          'paid', NEW.paid,
          'price', NEW.price
        )
      ),
      true
    );

    -- NOTE: To call your webhook endpoint automatically, you would use:
    -- Supabase Edge Functions or pg_net extension
    -- Example with pg_net (if installed):
    -- PERFORM net.http_post(
    --   url := 'https://your-app.vercel.app/api/webhooks/job-change',
    --   headers := '{"Content-Type": "application/json"}'::jsonb,
    --   body := jsonb_build_object(
    --     'jobId', NEW.id,
    --     'changeType', 'update',
    --     'changedFields', changed_fields
    --   )
    -- );
  END IF;

  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for job changes
DROP TRIGGER IF EXISTS notify_job_changes ON jobs;
CREATE TRIGGER notify_job_changes
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION log_job_changes();
