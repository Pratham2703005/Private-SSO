-- Phase 0: OAuth 2.0 Schema Migration (COMPLETE)
-- Creates all tables needed for OAuth2 + OpenID Connect flow
-- Run this in Supabase SQL Editor

-- ============================================================================
-- 1. OAuth Clients Table (already exists, but ensures it's complete)
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
-- 2. Authorization Codes Table (CRITICAL FOR STAGE 3)
-- ============================================================================
CREATE TABLE IF NOT EXISTS authorization_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
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
-- 3. Grants Table (for explicit user consent)
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_grants_user_client_active 
  ON grants(user_id, client_id) 
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_grants_user_id ON grants(user_id);
CREATE INDEX IF NOT EXISTS idx_grants_client_id ON grants(client_id);
CREATE INDEX IF NOT EXISTS idx_grants_revoked ON grants(revoked_at);

-- ============================================================================
-- 5. Verify oauth_clients has test data
-- ============================================================================
INSERT INTO oauth_clients (client_id, client_secret_hash, client_name, allowed_redirect_uris, is_active)
VALUES 
  ('client-a', 'test_secret_hash_a', 'Client App A', ARRAY['http://localhost:3001/api/auth/callback', 'http://localhost:3001/login'], true),
  ('client-b', 'test_secret_hash_b', 'Client App B', ARRAY['http://localhost:3002/api/auth/callback', 'http://localhost:3002/login'], true),
  ('client-inactive', 'test_secret_hash_inactive', 'Inactive Test Client', ARRAY['http://localhost:3001/api/auth/callback'], false)
ON CONFLICT (client_id) DO UPDATE SET 
  client_secret_hash = EXCLUDED.client_secret_hash,
  client_name = EXCLUDED.client_name,
  allowed_redirect_uris = EXCLUDED.allowed_redirect_uris,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check if all tables exist and have correct structure
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('oauth_clients', 'authorization_codes', 'grants', 'refresh_tokens')
ORDER BY table_name;

-- Verify oauth_clients has test data
SELECT client_id, client_name, is_active FROM oauth_clients ORDER BY client_id;

-- Show table row counts
SELECT 'oauth_clients' as table_name, COUNT(*) as row_count FROM oauth_clients
UNION ALL
SELECT 'authorization_codes', COUNT(*) FROM authorization_codes
UNION ALL
SELECT 'grants', COUNT(*) FROM grants
ORDER BY table_name;

