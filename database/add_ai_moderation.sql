-- Add AI moderation fields to listings table
ALTER TABLE listings
ADD COLUMN ai_check_result JSON DEFAULT NULL,
ADD COLUMN ai_check_date DATETIME DEFAULT NULL,
ADD COLUMN ai_flag_reason TEXT DEFAULT NULL;

-- Index for faster AI check queries
CREATE INDEX idx_listings_ai_check ON listings(ai_check_date, ai_flag_reason(100));

-- Example: Update existing listings to have a default AI status
-- UPDATE listings SET ai_check_result = '{"riskLevel":"unknown","aiSuggestion":"review"}' WHERE ai_check_result IS NULL;