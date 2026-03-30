-- Track scrape progress so each run picks up where the last left off
CREATE TABLE IF NOT EXISTS outreach_scrape_state (
  source TEXT PRIMARY KEY,
  scrape_offset INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
