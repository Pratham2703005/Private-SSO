-- Stage 11: Account Switching Support
-- Enables users to be logged into multiple accounts simultaneously
-- Tracks which account is currently active in the session

-- ============================================================================
-- 1. Extend Sessions Table with Active Account Tracking
-- ============================================================================
ALTER TABLE IF EXISTS sessions
  ADD COLUMN IF NOT EXISTS active_account_id UUID REFERENCES user_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_active_account_id ON sessions(active_account_id);

-- ============================================================================
-- 2. Session Logons Table
-- ============================================================================
-- Tracks all accounts that are logged in for a given session
-- Allows multiple accounts to be logged in simultaneously within one IDP session
CREATE TABLE IF NOT EXISTS session_logons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  logged_in_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMP,
  revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMP,
  
  -- Prevent duplicate logons of same account in same session
  UNIQUE(session_id, account_id),
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- 3. Indexes for Performance
-- ============================================================================
-- Fast lookup of all accounts in a session
CREATE INDEX IF NOT EXISTS idx_session_logons_session_id ON session_logons(session_id);

-- Fast lookup of active accounts (for accounts list + next-active selection)
CREATE INDEX IF NOT EXISTS idx_session_logons_session_revoked ON session_logons(session_id, revoked);

-- Track when accounts were last active
CREATE INDEX IF NOT EXISTS idx_session_logons_last_active ON session_logons(session_id, last_active_at DESC);

-- ============================================================================
-- 4. Extend Refresh Tokens Table for Per-Account Tracking
-- ============================================================================
-- Add session_id tracking to enable per-session revocation
ALTER TABLE IF EXISTS refresh_tokens
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES user_accounts(id) ON DELETE SET NULL;

-- Index for revocation by session + account (used in account logout)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session_account ON refresh_tokens(session_id, account_id) 
  WHERE revoked = FALSE;

-- ============================================================================
-- Summary of Changes
-- ============================================================================
-- New Tables:
--   - session_logons: Tracks multiple logged-in accounts within one IDP session
--
-- Enhanced Tables:
--   - sessions: Added active_account_id to track which account is currently active
--   - refresh_tokens: Added session_id to enable precise per-session revocation
--
-- Purpose:
--   Stage 11 enables Google-style account switching:
--   - User logs into Account A (creates session, adds to session_logons)
--   - User logs into Account B (reuses session, adds to session_logons)
--   - User can switch between A and B within same IDP session
--   - Can logout A without affecting B's tokens or IDP session
--   - Logout last account triggers auto-cleanup of IDP session
--
-- Constraints:
--   - UNIQUE(session_id, account_id): Prevents duplicate logons
--   - CASCADE on delete: Maintains referential integrity
--   - Partial indexes on revoked: Optimizes active account lookups
