-- Scraper configuration: what to scrape, on/off, daily count
CREATE TABLE IF NOT EXISTS scraper_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,                          -- e.g. "FL Insurance Agents", "Tampa Roofers"
  query TEXT NOT NULL,                         -- Google Maps search query
  source TEXT NOT NULL DEFAULT 'google_maps',  -- google_maps | doi_csv
  enabled BOOLEAN NOT NULL DEFAULT TRUE,       -- on/off toggle
  daily_count INTEGER NOT NULL DEFAULT 15,     -- how many to scrape per day
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scraper_config_query ON scraper_config (query);

-- Scraped businesses staging table: holds raw results before email verification
-- Scraping and email finding happen in separate cron calls to stay within timeouts
CREATE TABLE IF NOT EXISTS scraped_businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID REFERENCES scraper_config(id),
  name TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  address TEXT,
  rating NUMERIC(2,1),
  review_count INTEGER,
  category TEXT,
  -- Email finding status
  email TEXT,
  email_status TEXT NOT NULL DEFAULT 'pending',  -- pending | found | not_found | verified | invalid | added
  email_find_attempts INTEGER NOT NULL DEFAULT 0,
  -- Dedup
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scraped_biz_status ON scraped_businesses (email_status);
CREATE INDEX IF NOT EXISTS idx_scraped_biz_config ON scraped_businesses (config_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scraped_biz_dedup ON scraped_businesses (name, address);
