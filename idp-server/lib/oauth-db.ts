// idp-server/lib/oauth-db.ts
// Database functions for OAuth operations

import { supabase } from "./db";
import type {
  OAuthClient,
  AuthorizationCode,
  Grant,
  RefreshToken,
} from "./oauth-types";
import crypto from "crypto";

// ============================================================================
// OAuth Client Functions
// ============================================================================

export async function createOAuthClient(
  clientId: string,
  clientSecretHash: string,
  clientName: string,
  allowedRedirectUris: string[]
): Promise<OAuthClient> {
  const { data, error } = await supabase
    .from("oauth_clients")
    .insert({
      client_id: clientId,
      client_secret_hash: clientSecretHash,
      client_name: clientName,
      allowed_redirect_uris: allowedRedirectUris,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getOAuthClient(clientId: string): Promise<OAuthClient | null> {
  const { data, error } = await supabase
    .from("oauth_clients")
    .select("*")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .single();

  if (error) return null;
  return data;
}

export async function listOAuthClients(): Promise<OAuthClient[]> {
  const { data, error } = await supabase
    .from("oauth_clients")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) return [];
  return data;
}

export async function deactivateOAuthClient(clientId: string): Promise<boolean> {
  const { error } = await supabase
    .from("oauth_clients")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("client_id", clientId);

  return !error;
}

// ============================================================================
// Authorization Code Functions
// ============================================================================

/**
 * Create authorization code
 * Code expires in 10 minutes
 * Must be exchanged exactly once
 */
export async function createAuthorizationCode(
  clientId: string,
  userId: string,
  redirectUri: string,
  codeChallenge: string,
  scopes: string[],
  state?: string,
  codeChallengeMethod: "S256" | "plain" = "S256"
): Promise<AuthorizationCode> {
  const code = generateSecureCode(32);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const { data, error } = await supabase
    .from("authorization_codes")
    .insert({
      code,
      client_id: clientId,
      user_id: userId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      state,
      scopes,
      expires_at: expiresAt.toISOString(),
      is_redeemed: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get authorization code (only if not expired and not redeemed)
 */
export async function getAuthorizationCode(
  code: string
): Promise<AuthorizationCode | null> {
  const { data, error } = await supabase
    .from("authorization_codes")
    .select("*")
    .eq("code", code)
    .eq("is_redeemed", false)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error) return null;
  return data;
}

/**
 * Mark authorization code as redeemed (can only be used once)
 */
export async function redeemAuthorizationCode(codeId: string): Promise<boolean> {
  const { error } = await supabase
    .from("authorization_codes")
    .update({ is_redeemed: true })
    .eq("id", codeId);

  return !error;
}

/**
 * Clean up expired authorization codes (optional housekeeping)
 */
export async function cleanupExpiredAuthorizationCodes(): Promise<number> {
  const { data, error } = await supabase
    .from("authorization_codes")
    .delete()
    .lt("expires_at", new Date().toISOString());

  if (error) return 0;
  return data?.length || 0;
}

// ============================================================================
// Grant Functions (User Consent)
// ============================================================================

/**
 * Check if user has granted consent for a client
 * This is critical: must exist before issuing any token
 */
export async function getActiveGrant(
  userId: string,
  clientId: string
): Promise<Grant | null> {
  const { data, error } = await supabase
    .from("grants")
    .select("*")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .is("revoked_at", null)
    .single();

  if (error) return null;
  return data;
}

/**
 * Create a grant (user consents to a client accessing specific scopes)
 * This should be called after user approves consent screen
 */
export async function createGrant(
  userId: string,
  clientId: string,
  scopes: string[],
  createdBy: "user_consent" | "admin" = "user_consent"
): Promise<Grant> {
  // Check if grant already exists (shouldn't, but enforce uniqueness)
  const existing = await getActiveGrant(userId, clientId);
  if (existing) {
    return existing;
  }

  const { data, error } = await supabase
    .from("grants")
    .insert({
      user_id: userId,
      client_id: clientId,
      scopes,
      granted_at: new Date().toISOString(),
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Revoke a grant (user withdraws consent)
 */
export async function revokeGrant(grantId: string): Promise<boolean> {
  const { error } = await supabase
    .from("grants")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", grantId);

  return !error;
}

/**
 * Revoke all grants for a user with a specific client
 */
export async function revokeUserClientGrant(
  userId: string,
  clientId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("grants")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .is("revoked_at", null);

  return !error;
}

/**
 * List all grants for a user
 */
export async function getUserGrants(userId: string): Promise<Grant[]> {
  const { data, error } = await supabase
    .from("grants")
    .select("*")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("granted_at", { ascending: false });

  if (error) return [];
  return data;
}

// ============================================================================
// Refresh Token Functions
// ============================================================================

/**
 * Create a refresh token
 * Optionally part of a rotation family for breach detection
 */
export async function createRefreshToken(
  userId: string,
  clientId: string,
  tokenHash: string,
  expiresAt: Date,
  rotationFamilyId?: string,
  generation: number = 0
): Promise<RefreshToken> {
  const { data, error } = await supabase
    .from("refresh_tokens")
    .insert({
      user_id: userId,
      client_id: clientId,
      token_hash: tokenHash,
      rotation_family_id: rotationFamilyId,
      generation,
      is_rotated: false,
      is_compromised: false,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get refresh token record by hash (for validation)
 */
export async function getRefreshToken(
  tokenHash: string
): Promise<RefreshToken | null> {
  const { data, error } = await supabase
    .from("refresh_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .eq("is_rotated", false)
    .eq("is_compromised", false)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error) return null;
  return data;
}

/**
 * Mark refresh token as rotated (was used to get a new one)
 */
export async function rotateRefreshToken(
  tokenId: string,
  newTokenId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("refresh_tokens")
    .update({
      is_rotated: true,
      rotated_at: new Date().toISOString(),
      rotated_by_refresh_id: newTokenId,
    })
    .eq("id", tokenId);

  return !error;
}

/**
 * Detect breach: if old token used after new one, invalidate entire family
 * This prevents replay attacks on refresh tokens
 */
export async function invalidateTokenFamily(familyId: string): Promise<number> {
  const { data, error } = await supabase
    .from("refresh_tokens")
    .update({
      is_compromised: true,
    })
    .eq("rotation_family_id", familyId);

  if (error) return 0;
  return data?.length || 0;
}

/**
 * Revoke all refresh tokens for a user (force re-authentication)
 */
export async function revokeUserRefreshTokens(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("refresh_tokens")
    .update({
      is_rotated: true,
      rotated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("is_rotated", false);

  if (error) return 0;
  return data?.length || 0;
}

/**
 * Clean up expired refresh tokens (optional housekeeping)
 */
export async function cleanupExpiredRefreshTokens(): Promise<number> {
  const { data, error } = await supabase
    .from("refresh_tokens")
    .delete()
    .lt("expires_at", new Date().toISOString());

  if (error) return 0;
  return data?.length || 0;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a cryptographically secure random code/token
 * Default: 32 bytes = 256 bits
 */
export function generateSecureCode(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Hash a token for storage (never store plaintext tokens)
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Verify a token against its hash
 */
export function verifyTokenHash(token: string, hash: string): boolean {
  return hashToken(token) === hash;
}

/**
 * Generate PKCE code_challenge from code_verifier
 * Uses SHA-256 and base64url encoding
 */
export function generatePKCEChallenge(codeVerifier: string): string {
  return crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest()
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Verify PKCE: ensure code_challenge matches code_verifier
 */
export function verifyPKCEChallenge(
  codeVerifier: string,
  codeChallenge: string
): boolean {
  return generatePKCEChallenge(codeVerifier) === codeChallenge;
}
