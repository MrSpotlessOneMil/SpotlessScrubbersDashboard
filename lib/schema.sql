-- OSIRIS Dashboard Database Schema
-- This file is for reference only - run these queries to set up your PostgreSQL database

-- Settings table
CREATE TABLE settings (
  id SERIAL PRIMARY KEY,
  spreadsheet_id VARCHAR(255),
  hourly_rate DECIMAL(10,2) DEFAULT 25.00,
  cost_per_job DECIMAL(10,2) DEFAULT 50.00,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Customers table
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Jobs table
CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  title VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  scheduled_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, completed, cancelled
  cleaning_team TEXT[], -- array of team member names
  booked BOOLEAN DEFAULT false,
  quoted BOOLEAN DEFAULT false,
  paid BOOLEAN DEFAULT false,
  price DECIMAL(10,2),
  hours DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Calls table (with audio_url for recordings)
CREATE TABLE calls (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  date TIMESTAMP NOT NULL,
  duration_seconds INTEGER,
  transcript TEXT,
  audio_url VARCHAR(500), -- S3/storage URL for recording
  outcome VARCHAR(50), -- booked, not_booked, voicemail
  created_at TIMESTAMP DEFAULT NOW()
);

-- Messages table (texts + bot messages)
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  call_id INTEGER REFERENCES calls(id),
  role VARCHAR(20) NOT NULL, -- 'client', 'business', 'bot'
  content TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text' -- 'text', 'call_transcript'
);

-- Indexes for performance
CREATE INDEX idx_jobs_customer ON jobs(customer_id);
CREATE INDEX idx_jobs_date ON jobs(date);
CREATE INDEX idx_calls_customer ON calls(customer_id);
CREATE INDEX idx_calls_date ON calls(date);
CREATE INDEX idx_messages_customer ON messages(customer_id);
CREATE INDEX idx_messages_call ON messages(call_id);
