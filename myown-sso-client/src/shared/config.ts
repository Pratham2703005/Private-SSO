/**
 * Shared configuration constants
 * Single source of truth for all cookie names, timeouts, and defaults
 */

export const DEFAULT_CONFIG = {
  // Cookie names
  cookies: {
    session: 'app_session_c',
    oauthState: 'oauth_state',
    pkceVerifier: 'pkce_verifier',
    csrf: '__csrf',
    ssoSession: '__sso_session',
  },

  // Timeouts (in seconds)
  timeouts: {
    oauth: 600, // 10 minutes
    pkce: 300, // 5 minutes
    session: 86400, // 1 day
    sessionRefreshInterval: 60000, // 1 minute (ms)
  },

  // OAuth defaults
  scope: 'openid profile email',
  responseType: 'code',
  codeChallengeMethod: 'S256',

  // Feature flags
  enableAutoRefresh: true,
} as const;

export const COOKIE_DEFAULTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
} as const;

export const API_PATHS = {
  authStart: '/api/auth/start',
  authCallback: '/api/auth/callback',
  me: '/api/me',
  idpAuthorize: '/api/auth/authorize',
  idpToken: '/api/auth/token',
  idpSession: '/api/auth/session',
} as const;

// Helper to get secure flag based on environment
export function getSecureFlag(): boolean {
  if (typeof window === 'undefined') {
    // Server-side
    return process.env.NODE_ENV === 'production';
  }
  // Client-side - determine from protocol
  return window.location.protocol === 'https:';
}
