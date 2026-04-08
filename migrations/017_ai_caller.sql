-- AI Cold Caller: leads queue, DNC list, and session tracking

CREATE TABLE IF NOT EXISTS caller_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  business_name VARCHAR(255),
  contractor_type VARCHAR(50),  -- roofer, hvac, plumber, electrician
  city VARCHAR(100),
  state VARCHAR(2),
  timezone VARCHAR(50) DEFAULT 'America/New_York',
  no_website BOOLEAN DEFAULT true,
  review_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',  -- pending, calling, completed, dnc
  outcome VARCHAR(30),  -- demo_booked, not_interested, voicemail, hung_up, no_answer, callback, error
  call_duration_s INTEGER,
  transcript TEXT,
  demo_time TIMESTAMPTZ,
  called_at TIMESTAMPTZ,
  followup_sent BOOLEAN DEFAULT false,
  followup_sent_at TIMESTAMPTZ,
  retell_call_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_caller_leads_status ON caller_leads(status);
CREATE INDEX IF NOT EXISTS idx_caller_leads_phone ON caller_leads(phone);

CREATE TABLE IF NOT EXISTS caller_dnc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  reason VARCHAR(50),  -- opt_out, do_not_call, invalid
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS caller_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(20) DEFAULT 'stopped',  -- running, paused, stopped
  calls_made INTEGER DEFAULT 0,
  pickups INTEGER DEFAULT 0,
  voicemails INTEGER DEFAULT 0,
  not_interested INTEGER DEFAULT 0,
  demos_booked INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
