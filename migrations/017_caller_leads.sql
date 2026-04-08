-- AI Cold Caller leads table
CREATE TABLE IF NOT EXISTS caller_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  business_name TEXT,
  contact_name TEXT,
  contractor_type TEXT,
  city TEXT,
  state TEXT,
  email TEXT,
  review_count INTEGER DEFAULT 0,

  -- Call state
  status TEXT NOT NULL DEFAULT 'queued',
  -- queued, calling, voicemail, demo_booked, not_interested, callback_requested, hung_up, no_answer
  retell_call_id TEXT,
  direction TEXT DEFAULT 'outbound', -- outbound, inbound
  duration_seconds INTEGER,
  transcript TEXT,
  outcome_summary TEXT,
  call_attempts INTEGER DEFAULT 0,

  -- Demo booking
  demo_time TIMESTAMPTZ,
  demo_calendar_event_id TEXT,

  -- Follow-up
  followup_sent BOOLEAN DEFAULT FALSE,
  callback_at TIMESTAMPTZ,

  -- Source tracking
  source TEXT, -- 'nipr_scrape', 'manual', 'inbound_callback'
  outreach_contact_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caller_leads_phone ON caller_leads(phone);
CREATE INDEX IF NOT EXISTS idx_caller_leads_status ON caller_leads(status);
CREATE INDEX IF NOT EXISTS idx_caller_leads_retell_call_id ON caller_leads(retell_call_id);
