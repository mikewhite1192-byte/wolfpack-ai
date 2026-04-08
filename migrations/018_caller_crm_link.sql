-- Link caller_leads to CRM contacts
ALTER TABLE caller_leads ADD COLUMN IF NOT EXISTS crm_contact_id UUID;
CREATE INDEX IF NOT EXISTS idx_caller_leads_crm_contact ON caller_leads(crm_contact_id);
