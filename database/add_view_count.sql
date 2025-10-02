-- Add view_count column to listings table for tracking how many times a listing has been viewed

ALTER TABLE listings
ADD COLUMN view_count INT UNSIGNED DEFAULT 0 NOT NULL AFTER updated_at;

-- Add index for faster sorting by view count (popular listings)
CREATE INDEX idx_listings_view_count ON listings(view_count DESC);

-- Optionally initialize existing listings with 0 views
UPDATE listings SET view_count = 0 WHERE view_count IS NULL;