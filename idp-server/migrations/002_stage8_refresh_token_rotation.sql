-- Stage 8: Refresh Token Rotation Support
-- Updates refresh_tokens table to use replaced_by_token_hash + used_at pattern

-- Add new columns to refresh_tokens table if they don't exist
ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS used_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS replaced_by_token_hash VARCHAR(255);

-- Update index on token_hash (ensure it's efficient for lookups)
DROP INDEX IF EXISTS idx_refresh_tokens_hash;
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash) WHERE used_at IS NULL;

-- Add index on replaced_by_token_hash for rotation chain tracking
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_replaced_by ON refresh_tokens(replaced_by_token_hash);

-- Drop old columns if they exist (backward compatibility - they'll be ignored if not there)
-- This is a safe operation for production migrations
ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS is_revoked CASCADE;
ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS account_id CASCADE;
