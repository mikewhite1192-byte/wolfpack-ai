-- Scoring + enriched parse fields for Upwork job ingestion.
-- verdict drives SMS gating: 'auto_skip' → never text, 'warm' → standard SMS,
-- 'hot' → 🔥 highlighted SMS. Auto-skipped rows still store so you can audit
-- the dashboard and catch false-skips.

ALTER TABLE upwork_jobs ADD COLUMN IF NOT EXISTS verdict TEXT;
ALTER TABLE upwork_jobs ADD COLUMN IF NOT EXISTS verdict_reasons TEXT[];
ALTER TABLE upwork_jobs ADD COLUMN IF NOT EXISTS proposal_count INT;
ALTER TABLE upwork_jobs ADD COLUMN IF NOT EXISTS client_lifetime_spend NUMERIC;
ALTER TABLE upwork_jobs ADD COLUMN IF NOT EXISTS hourly_min NUMERIC;
ALTER TABLE upwork_jobs ADD COLUMN IF NOT EXISTS hourly_max NUMERIC;
ALTER TABLE upwork_jobs ADD COLUMN IF NOT EXISTS fixed_budget NUMERIC;

CREATE INDEX IF NOT EXISTS idx_upwork_jobs_verdict ON upwork_jobs(verdict);
