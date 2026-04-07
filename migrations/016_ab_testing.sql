-- A/B split testing for campaign templates
-- Each step can have up to 3 variants (A, B, C)

-- Add variant column to campaign_templates
ALTER TABLE campaign_templates ADD COLUMN IF NOT EXISTS variant TEXT NOT NULL DEFAULT 'A';

-- Drop old unique constraint and add new one with variant
ALTER TABLE campaign_templates DROP CONSTRAINT IF EXISTS campaign_templates_campaign_id_step_key;
ALTER TABLE campaign_templates ADD CONSTRAINT campaign_templates_campaign_id_step_variant_key UNIQUE (campaign_id, step, variant);

-- Add variant column to outreach_emails (tracks which variant was sent)
ALTER TABLE outreach_emails ADD COLUMN IF NOT EXISTS variant TEXT DEFAULT 'A';

-- Add variant column to outreach_contacts (sticky assignment across all steps)
ALTER TABLE outreach_contacts ADD COLUMN IF NOT EXISTS variant TEXT;
