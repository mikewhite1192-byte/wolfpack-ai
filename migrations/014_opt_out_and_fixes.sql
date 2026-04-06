-- 014: TCPA opt-out, missing AI fields, Gmail/OAuth columns
-- Safe to run multiple times — all IF NOT EXISTS

-- ═══════════════════════════════════════════════════════════
-- CONTACTS
-- ═══════════════════════════════════════════════════════════

-- TCPA opt-out tracking
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS opted_out BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_contacts_opted_out ON contacts (phone) WHERE opted_out = TRUE;

-- AI agent fields
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_next_followup TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_followup_count INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_qualification JSONB;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_score INTEGER;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS appointment_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS appointment_reminder_sent BOOLEAN DEFAULT FALSE;

-- ═══════════════════════════════════════════════════════════
-- CONVERSATIONS
-- ═══════════════════════════════════════════════════════════

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ai_stage TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT TRUE;

-- ═══════════════════════════════════════════════════════════
-- WORKSPACES — onboarding + AI config
-- ═══════════════════════════════════════════════════════════

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS ai_config JSONB;

-- ═══════════════════════════════════════════════════════════
-- WORKSPACES — Gmail/Calendar OAuth
-- ═══════════════════════════════════════════════════════════

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS gmail_access_token TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS gmail_refresh_token TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS gmail_email TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS gmail_connected BOOLEAN DEFAULT FALSE;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS owner_email TEXT;
