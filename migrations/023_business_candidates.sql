-- Business-candidate review: when the user was running an LLC without a
-- business bank account, business expenses were paid on personal cards.
-- This adds the columns needed to flag likely-business personal transactions,
-- review them, and link the resulting biz_transactions row back to its origin.

ALTER TABLE personal_transactions
  ADD COLUMN IF NOT EXISTS business_candidate BOOLEAN,
  ADD COLUMN IF NOT EXISTS business_candidate_confidence SMALLINT,  -- 0-100
  ADD COLUMN IF NOT EXISTS business_candidate_reason TEXT,
  ADD COLUMN IF NOT EXISTS suggested_biz_category TEXT,
  ADD COLUMN IF NOT EXISTS suggested_deduction_pct SMALLINT,         -- 0-100
  ADD COLUMN IF NOT EXISTS suggested_irs_reference TEXT,
  ADD COLUMN IF NOT EXISTS subscription_name TEXT,                   -- detected merchant-normalized name
  ADD COLUMN IF NOT EXISTS business_review_status TEXT
    DEFAULT 'unclassified'
    CHECK (business_review_status IN (
      'unclassified',           -- not yet run through classifier
      'pending_review',         -- classified as candidate, awaiting user decision
      'confirmed_business',     -- user moved to biz_transactions
      'kept_personal',          -- user said no, this is personal
      'dismissed'               -- user said irrelevant
    )),
  ADD COLUMN IF NOT EXISTS classified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_personal_txn_business_review
  ON personal_transactions(business_review_status, business_candidate_confidence DESC);
CREATE INDEX IF NOT EXISTS idx_personal_txn_subscription
  ON personal_transactions(subscription_name) WHERE subscription_name IS NOT NULL;

-- Link biz_transactions rows created from a personal reclassification back to
-- their origin. Nullable: most biz rows come from the biz statement importer.
ALTER TABLE biz_transactions
  ADD COLUMN IF NOT EXISTS reclassified_from_personal_id UUID
    REFERENCES personal_transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_biz_txn_reclassified
  ON biz_transactions(reclassified_from_personal_id)
  WHERE reclassified_from_personal_id IS NOT NULL;

-- Same treatment for mercury_transactions so personal-Mercury rows can be
-- reclassified to business-Mercury. We just record the origin id; if the
-- user later wants us to mirror the row into the business workspace, that
-- happens at application layer (copy row, set workspace='business').
ALTER TABLE mercury_transactions
  ADD COLUMN IF NOT EXISTS business_candidate BOOLEAN,
  ADD COLUMN IF NOT EXISTS business_candidate_confidence SMALLINT,
  ADD COLUMN IF NOT EXISTS business_candidate_reason TEXT,
  ADD COLUMN IF NOT EXISTS suggested_biz_category TEXT,
  ADD COLUMN IF NOT EXISTS suggested_deduction_pct SMALLINT,
  ADD COLUMN IF NOT EXISTS suggested_irs_reference TEXT,
  ADD COLUMN IF NOT EXISTS subscription_name TEXT,
  ADD COLUMN IF NOT EXISTS business_review_status TEXT
    DEFAULT 'unclassified'
    CHECK (business_review_status IN (
      'unclassified','pending_review','confirmed_business','kept_personal','dismissed'
    )),
  ADD COLUMN IF NOT EXISTS classified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_mercury_txn_business_review
  ON mercury_transactions(business_review_status, business_candidate_confidence DESC)
  WHERE workspace = 'personal';
