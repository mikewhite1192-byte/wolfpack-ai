-- Mobile app support tables. The web CRM is unaffected; these are only
-- read/written by new /api/mobile/* routes that the Wolfpack iOS app calls.
-- Single-operator scope (no user_id / RLS) matches the existing admin-gated
-- routes in app/api/upwork/*.

-- Per-job screening questions the user drafts on mobile, then copies into
-- Upwork's proposal flow. ON DELETE CASCADE so questions clean up with jobs.
CREATE TABLE IF NOT EXISTS upwork_job_questions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID NOT NULL REFERENCES upwork_jobs(id) ON DELETE CASCADE,
  question    TEXT,
  answer      TEXT,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_upwork_job_questions_job_id
  ON upwork_job_questions(job_id);

-- Reusable proposal text blocks ("Wolfpack intro", "Portfolio links", etc.)
-- that the composer surfaces as tappable chips.
CREATE TABLE IF NOT EXISTS upwork_proposal_snippets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT NOT NULL,
  content     TEXT NOT NULL,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Expo push tokens registered by the app on launch. `active` is toggled off
-- when Expo returns DeviceNotRegistered so we don't keep pushing to a dead
-- device (iOS rotates tokens and wiped apps leave stale ones behind).
CREATE TABLE IF NOT EXISTS push_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token         TEXT UNIQUE NOT NULL,
  platform      TEXT NOT NULL,       -- 'ios' | 'android'
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  last_seen_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_active
  ON push_tokens(active) WHERE active = true;
