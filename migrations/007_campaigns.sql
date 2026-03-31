-- Campaigns: each campaign targets a specific niche with its own senders and templates
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  niche TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Campaign sender assignments: which email addresses send for this campaign
-- Each sender can only belong to ONE campaign to keep reputation isolated
CREATE TABLE IF NOT EXISTS campaign_senders (
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  warmup_address_id UUID NOT NULL REFERENCES warmup_addresses(id),
  PRIMARY KEY (campaign_id, warmup_address_id),
  UNIQUE (warmup_address_id)
);

-- Campaign-specific 4-touch email templates
CREATE TABLE IF NOT EXISTS campaign_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  step INTEGER NOT NULL CHECK (step BETWEEN 1 AND 4),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  UNIQUE (campaign_id, step)
);

-- Link contacts to campaigns
ALTER TABLE outreach_contacts ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id);
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_campaign ON outreach_contacts (campaign_id);

-- Link scraper configs to campaigns so scraped leads flow into the right campaign
ALTER TABLE scraper_config ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id);
