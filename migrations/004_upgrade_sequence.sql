-- Upgrade sequence: tracks iMessage upgrade email cadence per workspace

-- Track upgrade sequence state per workspace
CREATE TABLE IF NOT EXISTS upgrade_sequence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE REFERENCES workspaces(id),
  last_step INTEGER NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  emails_sent INTEGER NOT NULL DEFAULT 0,
  originating_sender TEXT, -- which warmup address acquired this workspace (send upgrades from this)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Log all upgrade emails sent
CREATE TABLE IF NOT EXISTS upgrade_emails_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  to_email TEXT NOT NULL,
  from_email TEXT, -- which warmup address sent this
  step INTEGER NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick workspace lookup
CREATE INDEX IF NOT EXISTS idx_upgrade_sequence_workspace ON upgrade_sequence (workspace_id);
CREATE INDEX IF NOT EXISTS idx_upgrade_emails_log_workspace ON upgrade_emails_log (workspace_id, sent_at);
