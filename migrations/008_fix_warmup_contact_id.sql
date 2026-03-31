-- Fix: warmup emails don't have a contact_id (they're between our own addresses)
-- The NOT NULL constraint was preventing warmup email logging
ALTER TABLE outreach_emails ALTER COLUMN contact_id DROP NOT NULL;
