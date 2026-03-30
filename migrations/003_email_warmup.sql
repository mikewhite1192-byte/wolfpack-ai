-- Email warmup system: addresses, ramp tracking, and same-thread support

-- Warmup email addresses
CREATE TABLE IF NOT EXISTS warmup_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT 'Mike',
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_user TEXT NOT NULL,
  smtp_pass TEXT NOT NULL,
  warmup_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  warmup_completed BOOLEAN NOT NULL DEFAULT FALSE,
  cold_outreach_started_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  cold_sender BOOLEAN NOT NULL DEFAULT TRUE, -- true = sends cold outreach after warmup, false = warmup-only (reputation building)
  imap_host TEXT, -- defaults to smtp_host with smtp->imap replacement
  imap_port INTEGER DEFAULT 993,
  last_polled_at TIMESTAMPTZ, -- last time we checked this inbox for replies
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add columns to outreach_contacts for sender assignment
ALTER TABLE outreach_contacts ADD COLUMN IF NOT EXISTS assigned_sender TEXT;

-- Add columns to outreach_emails for multi-sender and threading
ALTER TABLE outreach_emails ADD COLUMN IF NOT EXISTS from_email TEXT;
ALTER TABLE outreach_emails ADD COLUMN IF NOT EXISTS email_type TEXT DEFAULT 'cold'; -- 'cold' or 'warmup'
ALTER TABLE outreach_emails ADD COLUMN IF NOT EXISTS message_id_header TEXT; -- For same-thread follow-ups

-- Index for per-sender daily counting
CREATE INDEX IF NOT EXISTS idx_outreach_emails_sender_date ON outreach_emails (from_email, sent_at) WHERE from_email IS NOT NULL;

-- Index for thread lookups
CREATE INDEX IF NOT EXISTS idx_outreach_emails_thread ON outreach_emails (contact_id, step) WHERE message_id_header IS NOT NULL;

-- Campaign inbox: unified inbox for all replies to cold outreach
CREATE TABLE IF NOT EXISTS campaign_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_address TEXT NOT NULL, -- which of our warmup addresses received this
  subject TEXT,
  body TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  is_starred BOOLEAN NOT NULL DEFAULT FALSE,
  message_id TEXT, -- email Message-ID header
  in_reply_to TEXT, -- for threading
  contact_id UUID, -- matched CRM contact
  outreach_contact_id UUID, -- matched outreach contact
  email_category TEXT DEFAULT 'other', -- 'cold_reply', 'warmup', 'other'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_inbox_received ON campaign_inbox (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_inbox_unread ON campaign_inbox (is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_campaign_inbox_to ON campaign_inbox (to_address);
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_inbox_dedup ON campaign_inbox (message_id, to_address) WHERE message_id IS NOT NULL;

-- Update sequence step limit from 3 to 4 (any contacts stuck at step 3 completed stay completed)
-- No data migration needed — the code now uses MAX_STEPS = 4
