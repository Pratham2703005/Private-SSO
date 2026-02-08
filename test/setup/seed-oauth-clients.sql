-- Seed OAuth clients for Stage 2 testing
-- Run this SQL directly in Supabase SQL Editor

-- Insert client-a
INSERT INTO oauth_clients (client_id, client_secret_hash, client_name, allowed_redirect_uris, is_active)
VALUES (
  'client-a',
  'test_secret_hash_a',
  'Client App A',
  ARRAY['http://localhost:3001/api/auth/callback', 'http://localhost:3001/login'],
  true
)
ON CONFLICT (client_id) DO NOTHING;

-- Insert client-b
INSERT INTO oauth_clients (client_id, client_secret_hash, client_name, allowed_redirect_uris, is_active)
VALUES (
  'client-b',
  'test_secret_hash_b',
  'Client App B',
  ARRAY['http://localhost:3002/api/auth/callback', 'http://localhost:3002/login'],
  true
)
ON CONFLICT (client_id) DO NOTHING;

-- Insert client-inactive (for Test 3)
INSERT INTO oauth_clients (client_id, client_secret_hash, client_name, allowed_redirect_uris, is_active)
VALUES (
  'client-inactive',
  'test_secret_hash_inactive',
  'Inactive Test Client',
  ARRAY['http://localhost:3001/api/auth/callback'],
  false
)
ON CONFLICT (client_id) DO NOTHING;

-- Verify insertion
SELECT client_id, client_name, is_active, allowed_redirect_uris FROM oauth_clients 
WHERE client_id IN ('client-a', 'client-b', 'client-inactive');
