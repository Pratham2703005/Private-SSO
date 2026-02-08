import crypto from 'crypto';

export interface PKCEPair {
  verifier: string;
  challenge: string;
}

/**
 * Generate a PKCE (Proof Key for Public Clients) pair
 * Returns both code_verifier and code_challenge
 */
export function generatePKCE(): PKCEPair {
  // Generate random 32-byte verifier, base64url encoded
  const verifier = crypto
    .randomBytes(32)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  // Create challenge from verifier using SHA256
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return { verifier, challenge };
}

/**
 * Generate a random authorization code (for testing)
 * Real implementation should use secure random bytes
 */
export function generateAuthorizationCode(): string {
  return crypto.randomBytes(32).toString('hex');
}
