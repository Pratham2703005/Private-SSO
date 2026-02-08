// idp-server/lib/oauth-types.ts
// Type definitions for Phase 0+ OAuth tables

/**
 * OAuth Client - Represents a registered application
 */
export interface OAuthClient {
  id: string;
  client_id: string;
  client_secret_hash: string;
  client_name?: string;
  allowed_redirect_uris: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Authorization Code - Temporary single-use code for auth flow
 * Lifetime: 10 minutes
 * Can only be exchanged once via /api/auth/token endpoint
 */
export interface AuthorizationCode {
  id: string;
  code: string;
  client_id: string;
  user_id: string;
  redirect_uri: string;
  code_challenge: string; // PKCE: sha256(code_verifier)
  code_challenge_method: "S256" | "plain";
  state?: string;
  scopes: string[]; // e.g., ["profile", "email"]
  expires_at: string;
  is_redeemed: boolean;
  created_at: string;
}

/**
 * Grant - Represents explicit user consent to a client accessing certain scopes
 * This is critical: no token is issued without an active grant
 */
export interface Grant {
  id: string;
  user_id: string;
  client_id: string;
  scopes: string[]; // e.g., ["profile", "email"]
  granted_at: string;
  revoked_at: string | null; // null = active, timestamp = revoked
  created_by: "user_consent" | "admin" | string;
  created_at: string;
  updated_at: string;
}

/**
 * Refresh Token - Long-lived token stored as hash (never plaintext)
 * Implements token rotation with family tracking
 *
 * Rotation flow:
 * 1. Client has token_A (generation 0)
 * 2. Client uses token_A to refresh
 * 3. Server marks token_A as rotated, issues token_B (generation 1, same family)
 * 4. If someone tries to use old token_A after token_B exists:
 *    - Detect breach: old token shouldn't be used after newer one
 *    - Invalidate entire family (all tokens in rotation_family_id)
 *    - Force re-authentication
 */
export interface RefreshToken {
  id: string;
  user_id: string;
  client_id: string;
  token_hash: string; // Hash of actual token (never store plaintext)
  rotation_family_id?: string; // Groups rotated tokens together
  generation: number; // 0 = original, 1 = first refresh, etc.
  is_rotated: boolean; // true = token was used to get a new one
  is_compromised: boolean; // true = family invalidated due to replay attack
  rotated_at?: string;
  rotated_by_refresh_id?: string; // Reference to the token that was used to refresh
  expires_at: string;
  created_at: string;
}

/**
 * Session (expanded) - Represents user session across clients
 * Now includes OAuth-specific tracking
 */
export interface Session {
  id: string;
  user_id: string;
  client_id?: string; // Which OAuth client this session is for
  grant_id?: string; // Which grant this session uses
  refresh_token_hash?: string; // Deprecated: for backward compat
  last_activity: string;
  user_agent?: string; // For additional security (optional IP/UA locking)
  ip_address?: string;
  expires_at: string;
  created_at: string;
}

// Request/Response Types

/**
 * Authorization Request - What client sends to /api/auth/authorize
 */
export interface AuthorizeRequest {
  client_id: string;
  redirect_uri: string;
  response_type: "code"; // Always "code" (not "token")
  scope?: string; // Space-separated scopes, e.g., "profile email"
  state?: string; // CSRF protection
  code_challenge?: string; // PKCE
  code_challenge_method?: "S256" | "plain";
  grant_type?: string; // Not in request, for clarity
}

/**
 * Token Request - What client sends to /api/auth/token
 */
export interface TokenRequest {
  grant_type: "authorization_code" | "refresh_token";
  // For authorization_code grant:
  code?: string;
  code_verifier?: string; // PKCE
  // For both:
  client_id: string;
  client_secret?: string;
  redirect_uri?: string;
}

/**
 * Token Response - What server returns from /api/auth/token
 */
export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number; // In seconds, e.g., 900 for 15 minutes
  refresh_token: string;
  scope: string; // Space-separated granted scopes
}

/**
 * Authorize Response - What server returns when redirecting to callback
 */
export interface AuthorizeResponse {
  code: string;
  state?: string;
  scope?: string;
}

/**
 * Bootstrap Response - What server returns from /api/auth/bootstrap (internal)
 */
export interface BootstrapResponse {
  code: string;
  state?: null; // No state needed for server-to-server
  scope: string;
}

/**
 * Error Response - Standard OAuth error format
 */
export interface OAuthErrorResponse {
  error: string; // e.g., "invalid_grant", "access_denied", "unauthorized_client"
  error_description?: string;
  error_uri?: string;
  state?: string; // Returned if client sent it
}

/**
 * Payload Types for Tokens
 */

export interface AccessTokenPayload {
  sub: string; // user_id
  client_id: string;
  email: string;
  name?: string;
  scope: string; // Space-separated
  aud: string; // Audience (client_id)
  iat: number;
  exp: number;
  jti?: string; // JWT ID
}

export interface RefreshTokenPayload {
  sub: string; // user_id
  client_id: string;
  iat: number;
  exp: number;
  jti: string; // JWT ID for token tracking
}
