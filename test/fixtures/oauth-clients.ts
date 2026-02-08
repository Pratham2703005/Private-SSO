// Reference: Pre-seeded OAuth clients in Supabase
// These should already exist in the oauth_clients table

export const OAUTH_CLIENTS = {
  VALID_CLIENT_A: {
    clientId: 'client-a',
    allowedRedirectUris: [
      'http://localhost:3001/api/auth/callback',
      'http://localhost:3001/login'
    ],
    isActive: true
  },
  VALID_CLIENT_B: {
    clientId: 'client-b',
    allowedRedirectUris: [
      'http://localhost:3002/api/auth/callback',
      'http://localhost:3002/login'
    ],
    isActive: true
  },
  INVALID_CLIENT: {
    clientId: 'unknown-client',
    allowedRedirectUris: ['http://localhost:9999/callback'],
    isActive: true
  },
  INACTIVE_CLIENT: {
    clientId: 'client-inactive',
    allowedRedirectUris: ['http://localhost:3001/api/auth/callback'],
    isActive: false
  }
};

export const VALID_REDIRECT_URIS = {
  CLIENT_A: 'http://localhost:3001/api/auth/callback',
  CLIENT_B: 'http://localhost:3002/api/auth/callback'
};

export const INVALID_REDIRECT_URIS = {
  WRONG_PORT: 'http://localhost:9999/api/auth/callback',
  WRONG_PATH: 'http://localhost:3001/api/wrong-callback',
  EXTERNAL: 'http://attacker.com/callback'
};
