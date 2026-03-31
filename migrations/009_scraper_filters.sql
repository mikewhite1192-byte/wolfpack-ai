-- Add filter columns to scraper_config
ALTER TABLE scraper_config ADD COLUMN IF NOT EXISTS max_reviews INTEGER;
ALTER TABLE scraper_config ADD COLUMN IF NOT EXISTS min_rating NUMERIC(2,1);
ALTER TABLE scraper_config ADD COLUMN IF NOT EXISTS max_rating NUMERIC(2,1);
ALTER TABLE scraper_config ADD COLUMN IF NOT EXISTS category_filter TEXT;
