-- Google Business Profile integration

-- Store GBP connection per client (separate from workspace Gmail OAuth)
CREATE TABLE IF NOT EXISTS gbp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  -- OAuth tokens (GBP uses separate OAuth from Gmail)
  access_token TEXT,
  refresh_token TEXT,
  connected_email TEXT,
  connected BOOLEAN NOT NULL DEFAULT FALSE,
  -- GBP account/location IDs
  account_id TEXT, -- accounts/12345
  location_id TEXT, -- locations/67890
  location_name TEXT, -- "Mike's Plumbing"
  -- Settings
  auto_post_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  auto_review_reply_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  monthly_report_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  report_phone TEXT, -- phone to text monthly reports to
  -- Metadata
  last_post_at TIMESTAMPTZ,
  last_review_check_at TIMESTAMPTZ,
  last_report_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gbp_conn_workspace ON gbp_connections (workspace_id);
CREATE INDEX IF NOT EXISTS idx_gbp_conn_location ON gbp_connections (location_id);

-- Track GBP posts we've created
CREATE TABLE IF NOT EXISTS gbp_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES gbp_connections(id),
  google_post_id TEXT, -- ID from Google
  post_type TEXT NOT NULL DEFAULT 'STANDARD', -- STANDARD, EVENT, OFFER
  summary TEXT NOT NULL,
  cta_type TEXT, -- BOOK, ORDER, LEARN_MORE, CALL, etc
  cta_url TEXT,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'published', -- published, failed, draft
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gbp_posts_conn ON gbp_posts (connection_id, posted_at DESC);

-- Track reviews we've pulled and replied to
CREATE TABLE IF NOT EXISTS gbp_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES gbp_connections(id),
  google_review_id TEXT NOT NULL,
  reviewer_name TEXT,
  star_rating INTEGER,
  comment TEXT,
  review_time TIMESTAMPTZ,
  -- Reply tracking
  reply_text TEXT,
  reply_status TEXT NOT NULL DEFAULT 'pending', -- pending, replied, skipped
  replied_at TIMESTAMPTZ,
  -- AI analysis
  sentiment TEXT, -- positive, neutral, negative
  ai_suggested_reply TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gbp_reviews_dedup ON gbp_reviews (connection_id, google_review_id);
CREATE INDEX IF NOT EXISTS idx_gbp_reviews_pending ON gbp_reviews (reply_status) WHERE reply_status = 'pending';

-- Track monthly performance snapshots
CREATE TABLE IF NOT EXISTS gbp_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES gbp_connections(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  -- Metrics
  search_impressions INTEGER DEFAULT 0,
  maps_impressions INTEGER DEFAULT 0,
  website_clicks INTEGER DEFAULT 0,
  phone_calls INTEGER DEFAULT 0,
  direction_requests INTEGER DEFAULT 0,
  -- Top search terms
  top_search_terms JSONB, -- [{term, impressions}, ...]
  -- Snapshot
  total_reviews INTEGER,
  average_rating NUMERIC(2,1),
  report_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gbp_insights_conn ON gbp_insights (connection_id, period_start DESC);
