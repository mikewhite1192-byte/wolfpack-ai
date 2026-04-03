-- Email Assistant: AI-powered cold email reply handling, booking, and post-call follow-ups

-- Track AI email conversation state per outreach contact
CREATE TABLE IF NOT EXISTS email_assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outreach_contact_id UUID NOT NULL REFERENCES outreach_contacts(id),
  campaign_inbox_id UUID REFERENCES campaign_inbox(id), -- the reply that started this

  -- Contact data (denormalized for quick access in prompts)
  contact_email TEXT NOT NULL,
  contact_name TEXT,
  business_name TEXT,
  city TEXT,
  contractor_type TEXT,
  review_count INTEGER,

  -- Conversation state
  stage TEXT NOT NULL DEFAULT 'new',
    -- new, reply_1, reply_2, reply_3,
    -- price_objection, busy_objection, not_interested, send_info,
    -- agreed_to_call, booked,
    -- no_show, no_show_follow_1, no_show_follow_2, no_show_follow_3,
    -- no_close, no_close_follow_1, no_close_follow_2, no_close_follow_3, no_close_follow_4,
    -- closed_won, closed_lost, re_engagement,
    -- unsubscribed, dead

  -- Booking data
  booking_id UUID,
  calendar_event_id TEXT, -- Google Calendar event ID
  booked_at TIMESTAMPTZ,
  call_time TIMESTAMPTZ,
  call_type TEXT DEFAULT 'google_meet', -- google_meet or phone
  meet_link TEXT,

  -- Post-call tracking
  call_outcome TEXT, -- completed, no_show, cancelled
  close_outcome TEXT, -- closed_won, closed_lost, follow_up_booked
  close_reason TEXT, -- why they didn't close (from CRM notes)
  follow_up_call_time TIMESTAMPTZ, -- second call if booked
  follow_up_event_id TEXT,

  -- CRM outcome
  crm_outcome TEXT DEFAULT 'active',
    -- active, interested, booked, no_show, no_close, closed_won, closed_lost, lost, unsubscribed

  -- Follow-up scheduling
  nudge_count INTEGER NOT NULL DEFAULT 0,
  next_action_at TIMESTAMPTZ,
  next_action_type TEXT,
    -- ai_reply, reminder_30min, no_show_text_1, no_show_text_2, no_show_email_3,
    -- no_close_text_1, no_close_text_2, no_close_text_3, no_close_text_4,
    -- follow_up_reminder_owner, follow_up_reminder_contact,
    -- closed_won_text, closed_won_onboard,
    -- re_engagement_90d

  -- Sender tracking (reply from the same address that sent the cold email)
  sender_email TEXT, -- which warmup address is handling this thread
  last_message_id TEXT, -- for email threading

  -- Metadata
  thread_summary TEXT, -- AI-generated summary for iMessage notifications
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ea_conv_outreach ON email_assistant_conversations (outreach_contact_id);
CREATE INDEX IF NOT EXISTS idx_ea_conv_stage ON email_assistant_conversations (stage);
CREATE INDEX IF NOT EXISTS idx_ea_conv_next_action ON email_assistant_conversations (next_action_at) WHERE next_action_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ea_conv_crm_outcome ON email_assistant_conversations (crm_outcome);
CREATE INDEX IF NOT EXISTS idx_ea_conv_call_time ON email_assistant_conversations (call_time) WHERE call_time IS NOT NULL;

-- Log every AI email sent and received for this conversation
CREATE TABLE IF NOT EXISTS email_assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES email_assistant_conversations(id),
  direction TEXT NOT NULL, -- inbound, outbound
  channel TEXT NOT NULL DEFAULT 'email', -- email, sms, imessage
  body TEXT NOT NULL,
  subject TEXT,
  message_id TEXT, -- email Message-ID for threading
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ea_msg_conv ON email_assistant_messages (conversation_id, sent_at);

-- Add ai_assistant_processed flag to campaign_inbox so we don't process replies twice
ALTER TABLE campaign_inbox ADD COLUMN IF NOT EXISTS ai_processed BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_campaign_inbox_ai ON campaign_inbox (ai_processed) WHERE ai_processed = FALSE AND email_category = 'cold_reply';

-- Track long-term client check-ins (1 month, 6 months, 1 year)
CREATE TABLE IF NOT EXISTS client_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES email_assistant_conversations(id),
  outreach_contact_id UUID NOT NULL,
  contact_name TEXT,
  business_name TEXT,
  contact_phone TEXT,
  checkin_type TEXT NOT NULL, -- '1_month', '6_month', '1_year'
  due_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, replied
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_checkins_due ON client_checkins (due_at) WHERE status = 'pending';

-- Client Onboarding pipeline (post-sale)
-- Note: workspace_id must be filled in at runtime since we don't know it at migration time
-- The handleClosedWon function creates this pipeline on first use if it doesn't exist
