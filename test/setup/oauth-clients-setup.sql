-- Create oauth_clients table and seed test data
-- Run this in Supabase SQL Editor: https://supabase.com/docs/guides/database/sql-editor

-- Create table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_oauth_clients_client_id ON oauth_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_clients_active ON oauth_clients(is_active);

-- Seed test data
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

-- Verify
SELECT * FROM oauth_clients ORDER BY created_at;
