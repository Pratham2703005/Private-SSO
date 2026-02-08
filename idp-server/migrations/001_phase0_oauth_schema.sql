-- Phase 0: OAuth 2.0 Schema Migration
-- Creates tables for: oauth_clients, authorization_codes, grants, refresh_tokens
-- Expands: sessions table with additional OAuth tracking fields

-- ============================================================================
-- 1. OAuth Clients Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS oauth_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT UNIQUE NOT NULL,
  client_secret_hash TEXT NOT NULL,
  client_name TEXT,
  allowed_redirect_uris TEXT[] NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_clients_client_id ON oauth_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_clients_active ON oauth_clients(is_active);

-- ============================================================================
-- 2. Authorization Codes Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS authorization_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT, -- Optional: PKCE not required for backward compatibility
  code_challenge_method TEXT DEFAULT 'S256',
  state TEXT,
  scopes TEXT[] NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  is_redeemed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_codes_code ON authorization_codes(code);
CREATE INDEX IF NOT EXISTS idx_auth_codes_user_id ON authorization_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_codes_client_id ON authorization_codes(client_id);
CREATE INDEX IF NOT EXISTS idx_auth_codes_expires ON authorization_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_codes_redeemed ON authorization_codes(is_redeemed);

-- ============================================================================
-- 3. Grants Table (Explicit User Consent)
-- ============================================================================
CREATE TABLE IF NOT EXISTS grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE RESTRICT,
  scopes TEXT[] NOT NULL,
  granted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMP,
  created_by TEXT DEFAULT 'user_consent',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Unique constraint: Only one active grant per (user, client) pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_grants_user_client_active 
  ON grants(user_id, client_id) 
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_grants_user_id ON grants(user_id);
CREATE INDEX IF NOT EXISTS idx_grants_client_id ON grants(client_id);
CREATE INDEX IF NOT EXISTS idx_grants_revoked ON grants(revoked_at);

-- ============================================================================
-- 4. Refresh Tokens Table (with Rotation Family Tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE RESTRICT,
  token_hash TEXT UNIQUE NOT NULL,
  rotation_family_id UUID,
  generation INT DEFAULT 0,
  is_rotated BOOLEAN DEFAULT false,
  is_compromised BOOLEAN DEFAULT false,
  rotated_at TIMESTAMP,
  rotated_by_refresh_id UUID REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_client_id ON refresh_tokens(client_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(rotation_family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_compromised ON refresh_tokens(is_compromised);

-- ============================================================================
-- 5. Expand Sessions Table
-- ============================================================================
-- Add OAuth-related fields to existing sessions table
ALTER TABLE IF EXISTS sessions
  ADD COLUMN IF NOT EXISTS client_id TEXT REFERENCES oauth_clients(client_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS grant_id UUID REFERENCES grants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS ip_address INET;

CREATE INDEX IF NOT EXISTS idx_sessions_client_id ON sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_sessions_grant_id ON sessions(grant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);

-- ============================================================================
-- Summary of Changes
-- ============================================================================
-- New Tables:
--   - oauth_clients: Stores registered client applications
--   - authorization_codes: Temporary codes for OAuth flow
--   - grants: Explicit user consent tracking (prevents over-issuing tokens)
--   - refresh_tokens: Long-lived tokens with rotation family tracking (breach detection)
--
-- Enhanced Tables:
--   - sessions: Added client tracking, grant reference, activity timestamp, user agent, IP
--
-- Security Features:
--   - Refresh token rotation with family_id (detect compromise if old token reused)
--   - Authorization code single-use (is_redeemed flag)
--   - Grant revocation support (revoked_at timestamp)
--   - Comprehensive indexing for performance
--
-- Constraints:
--   - All tables cascade on user deletion (privacy)
--   - oauth_clients and grants restrict on delete (referential integrity)
--   - Unique constraint on active grants per (user, client)
