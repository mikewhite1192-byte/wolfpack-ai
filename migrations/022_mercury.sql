-- Mercury Banking integration (business + personal workspaces)
-- Mirrors Mercury's accounts + transactions into Neon so the Finance tab
-- can query locally and the MCP/AI brief can reason over categorized data.
-- Scope for Phase 1: read-only sync. No send-money/invoice writes.

CREATE TABLE IF NOT EXISTS mercury_accounts (
  id UUID PRIMARY KEY,                      -- Mercury's account UUID (unique across both workspaces)
  workspace TEXT NOT NULL CHECK (workspace IN ('business','personal')),
  organization_id UUID NOT NULL,            -- Mercury's org UUID (from /organization)
  account_number TEXT NOT NULL,
  routing_number TEXT NOT NULL,
  name TEXT NOT NULL,
  legal_business_name TEXT,                 -- "The Wolf Pack Co LLC" (business) or "Michael White" (personal)
  status TEXT NOT NULL,                     -- active, archived, deleted, pending
  type TEXT NOT NULL,                       -- "mercury", "external", etc.
  kind TEXT NOT NULL,                       -- checking, savings, creditCard, treasury
  available_balance NUMERIC(14,2),
  current_balance NUMERIC(14,2),
  dashboard_link TEXT,
  nickname TEXT,                            -- user-set label shown in UI (our field, not Mercury's)
  created_at TIMESTAMPTZ NOT NULL,          -- Mercury's createdAt
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_mercury_accounts_workspace ON mercury_accounts(workspace);
CREATE INDEX IF NOT EXISTS idx_mercury_accounts_kind ON mercury_accounts(kind);
CREATE INDEX IF NOT EXISTS idx_mercury_accounts_status ON mercury_accounts(status);

CREATE TABLE IF NOT EXISTS mercury_transactions (
  id UUID PRIMARY KEY,                      -- Mercury's transaction UUID
  workspace TEXT NOT NULL CHECK (workspace IN ('business','personal')),
  account_id UUID NOT NULL REFERENCES mercury_accounts(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,            -- signed: negative = debit
  status TEXT NOT NULL,                     -- pending, sent, cancelled, failed, reversed, blocked
  kind TEXT NOT NULL,                       -- debitCardTransaction, externalTransfer, etc.
  bank_description TEXT,
  counterparty_id UUID,
  counterparty_name TEXT,
  counterparty_nickname TEXT,
  mercury_category TEXT,                    -- Mercury's own tag (e.g. "Retail")
  merchant_category_code TEXT,              -- MCC for card txns
  merchant_id TEXT,
  note TEXT,                                -- user-editable note from Mercury
  external_memo TEXT,
  check_number TEXT,
  tracking_number TEXT,
  fee_id UUID,
  request_id UUID,
  reason_for_failure TEXT,
  dashboard_link TEXT,

  -- timestamps from Mercury
  created_at TIMESTAMPTZ NOT NULL,
  posted_at TIMESTAMPTZ,                    -- null for pending
  estimated_delivery_date TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,

  -- raw Mercury payload for anything not modeled above (attachments, glAllocations, details, etc.)
  raw JSONB NOT NULL,

  -- our enrichment layer (user-editable, survives re-syncs)
  our_category TEXT,                        -- normalized category (overrides mercury_category when set)
  our_subcategory TEXT,
  is_deductible BOOLEAN,                    -- business-only; personal rows leave null
  deduction_pct SMALLINT,                   -- 0-100
  irs_reference TEXT,                       -- e.g. "Schedule C Line 8"
  our_notes TEXT,
  reviewed BOOLEAN NOT NULL DEFAULT false,

  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mercury_txn_workspace_date ON mercury_transactions(workspace, posted_at DESC NULLS FIRST, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mercury_txn_account_date ON mercury_transactions(account_id, posted_at DESC NULLS FIRST, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mercury_txn_status ON mercury_transactions(status);
CREATE INDEX IF NOT EXISTS idx_mercury_txn_counterparty ON mercury_transactions(counterparty_name);
CREATE INDEX IF NOT EXISTS idx_mercury_txn_category ON mercury_transactions(our_category, mercury_category);
CREATE INDEX IF NOT EXISTS idx_mercury_txn_reviewed ON mercury_transactions(reviewed) WHERE reviewed = false;

-- Sync run log: one row per sync job. Lets us see last-sync-time, detect stuck
-- jobs, show a "last synced 3m ago" UI, and alert on failures.
CREATE TABLE IF NOT EXISTS mercury_sync_runs (
  id BIGSERIAL PRIMARY KEY,
  trigger TEXT NOT NULL,                    -- 'initial', 'cron', 'manual'
  workspace TEXT,                           -- null = both workspaces
  account_id UUID REFERENCES mercury_accounts(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',   -- running, success, error
  accounts_synced INT NOT NULL DEFAULT 0,
  transactions_inserted INT NOT NULL DEFAULT 0,
  transactions_updated INT NOT NULL DEFAULT 0,
  error_message TEXT,
  duration_ms INT
);

CREATE INDEX IF NOT EXISTS idx_mercury_sync_runs_started ON mercury_sync_runs(started_at DESC);

-- Categorization rules: substring/regex matching on counterparty/bankDescription
-- to auto-set our_category at sync time.
CREATE TABLE IF NOT EXISTS mercury_category_rules (
  id BIGSERIAL PRIMARY KEY,
  workspace TEXT,                           -- null = applies to both
  pattern TEXT NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'contains', -- 'contains' | 'regex' | 'exact'
  match_field TEXT NOT NULL DEFAULT 'counterparty_name', -- 'counterparty_name' | 'bank_description' | 'mercury_category'
  our_category TEXT NOT NULL,
  our_subcategory TEXT,
  is_deductible BOOLEAN,
  deduction_pct SMALLINT,
  irs_reference TEXT,
  priority INT NOT NULL DEFAULT 100,        -- lower runs first
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mercury_rules_priority ON mercury_category_rules(priority) WHERE enabled = true;

-- Unified view: Mercury business rows + legacy biz_transactions (pre-Mercury PDF imports).
-- Reports and the AI brief query this so they don't need to know the source.
-- Note on columns: legacy biz_transactions has only `description` (no merchant).
-- For Mercury we prefer counterparty_name, falling back to bank_description.
CREATE OR REPLACE VIEW business_transactions_unified AS
  SELECT
    'mercury'::text AS source,
    mt.id::text AS id,
    mt.account_id::text AS account_ref,
    ma.name AS account_name,
    COALESCE(mt.posted_at::date, mt.created_at::date) AS date,
    mt.amount,
    COALESCE(mt.counterparty_name, mt.bank_description) AS description,
    COALESCE(mt.our_category, mt.mercury_category) AS category,
    mt.our_subcategory AS subcategory,
    mt.is_deductible,
    mt.deduction_pct,
    mt.irs_reference,
    mt.our_notes AS notes,
    mt.status,
    mt.reviewed
  FROM mercury_transactions mt
  JOIN mercury_accounts ma ON ma.id = mt.account_id
  WHERE mt.workspace = 'business'
  UNION ALL
  SELECT
    'statement'::text AS source,
    bt.id::text AS id,
    bt.statement_id::text AS account_ref,
    'Statement Import'::text AS account_name,
    bt.date::date AS date,
    bt.amount,
    bt.description,
    bt.category,
    bt.subcategory,
    bt.is_deductible,
    bt.deduction_pct,
    bt.irs_reference,
    bt.notes,
    'posted'::text AS status,
    true AS reviewed
  FROM biz_transactions bt;

-- Unified view for personal: Mercury personal + legacy personal_transactions.
-- personal_transactions has is_recurring (our subscription flag) but no is_deductible.
CREATE OR REPLACE VIEW personal_transactions_unified AS
  SELECT
    'mercury'::text AS source,
    mt.id::text AS id,
    mt.account_id::text AS account_ref,
    ma.name AS account_name,
    COALESCE(mt.posted_at::date, mt.created_at::date) AS date,
    mt.amount,
    COALESCE(mt.counterparty_name, mt.bank_description) AS description,
    COALESCE(mt.our_category, mt.mercury_category) AS category,
    mt.our_subcategory AS subcategory,
    NULL::boolean AS is_recurring,
    mt.our_notes AS notes,
    mt.status,
    mt.reviewed
  FROM mercury_transactions mt
  JOIN mercury_accounts ma ON ma.id = mt.account_id
  WHERE mt.workspace = 'personal'
  UNION ALL
  SELECT
    'statement'::text AS source,
    pt.id::text AS id,
    pt.account_id::text AS account_ref,
    pa.name AS account_name,
    pt.date::date AS date,
    pt.amount,
    pt.description,
    pt.category,
    pt.subcategory,
    pt.is_recurring,
    pt.notes,
    'posted'::text AS status,
    true AS reviewed
  FROM personal_transactions pt
  JOIN personal_accounts pa ON pa.id = pt.account_id;
