-- Stage 10: Revocation Support for Global Logout
-- Adds revoked flag to refresh_tokens table
-- Used to distinguish between:
-- - used_at: token was rotated (replaced by new token)
-- - revoked: token was admin-revoked (global logout)

ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS revoked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP;

-- Index for efficient lookups of valid tokens (not used and not revoked)
DROP INDEX IF EXISTS idx_refresh_tokens_hash;
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash) 
  WHERE used_at IS NULL AND revoked = FALSE;

-- Index for revoking all tokens by user
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_revoked ON refresh_tokens(user_id, revoked);
