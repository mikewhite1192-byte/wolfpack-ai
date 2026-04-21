-- Mobile app support tables. The web CRM is unaffected; these are only
-- read/written by /api/mobile/* routes that the Wolfpack iOS app calls.

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
