-- Add city, review_count, niche, address to outreach_contacts for template variables
ALTER TABLE outreach_contacts ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE outreach_contacts ADD COLUMN IF NOT EXISTS review_count INTEGER;
ALTER TABLE outreach_contacts ADD COLUMN IF NOT EXISTS niche TEXT;
ALTER TABLE outreach_contacts ADD COLUMN IF NOT EXISTS address TEXT;
