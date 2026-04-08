CREATE TABLE IF NOT EXISTS upwork_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upwork_id TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  budget TEXT,
  job_type TEXT, -- fixed, hourly
  skills TEXT[], -- array of required skills
  client_country TEXT,
  client_rating NUMERIC,
  client_hire_rate NUMERIC,
  client_payment_verified BOOLEAN DEFAULT false,
  job_url TEXT NOT NULL,
  posted_at TIMESTAMPTZ,
  ai_score INTEGER, -- 1-10 fit score
  ai_reasoning TEXT, -- why this score
  ai_proposal TEXT, -- drafted proposal
  status TEXT DEFAULT 'new', -- new, applied, interviewing, won, lost, skipped
  applied_at TIMESTAMPTZ,
  won_at TIMESTAMPTZ,
  contract_value NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_upwork_jobs_status ON upwork_jobs(status);
CREATE INDEX IF NOT EXISTS idx_upwork_jobs_score ON upwork_jobs(ai_score);
CREATE INDEX IF NOT EXISTS idx_upwork_jobs_upwork_id ON upwork_jobs(upwork_id);
