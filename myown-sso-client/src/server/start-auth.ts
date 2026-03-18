'use server';

/**
 * Start OAuth2 flow with PKCE
 * 
 * Flow:
 * 1. Generate random state (CSRF protection)
 * 2. Sign state with secret (verify signature on callback)
 * 3. Generate PKCE verifier + code_challenge
 * 4. Store in signed cookies
 * 5. Redirect to IDP authorize endpoint
 * 
 * Usage in app/api/auth/start/route.ts:
 * ```
 * import { startAuth } from 'myown-sso-client/server';
 * 
 * export const GET = startAuth({
 *   clientId: process.env.NEXT_PUBLIC_CLIENT_ID,
 *   idpServer: process.env.NEXT_PUBLIC_IDP_SERVER,
 *   redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI,
 *   oauthSecret: process.env.OAUTH_SECRET,
 * });
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, randomBytes, createHash } from 'crypto';
import type { StartAuthConfig } from '../shared';

const DEFAULT_CONFIG = {
  scope: 'openid profile email',
  responseType: 'code',
  codeChallengeMethod: 'S256',
  cookies: {
    pkceVerifier: 'pkce_verifier',
    oauthState: 'oauth_state', // Store state in cookie like client-c does
  },
  timeouts: {
    pkce: 300,
    state: 600, // 10 minutes for state cookie
  },
};

const API_PATHS = {
  idpAuthorize: '/api/auth/authorize',
};

function base64UrlEncode(buffer: Buffer | Uint8Array): string {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function generateState(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

function signState(state: string, secret: string): string {
  const signature = createHmac('sha256', secret)
    .update(state)
    .digest('hex');
  return `${state}.${signature}`;
}

function generatePKCE(byteLength: number = 96): { verifier: string; challenge: string } {
  // RFC 7636: code_verifier must be 43-128 chars from [A-Za-z0-9-._~].
  // 96 random bytes -> base64url length 128 chars (no padding), valid max length.
  const bytes = randomBytes(byteLength);
  const verifier = base64UrlEncode(bytes);
  const hash = createHash('sha256').update(verifier).digest();
  const challenge = base64UrlEncode(hash);
  return { verifier, challenge };
}

export function startAuth(config: StartAuthConfig) {
  return async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const email = searchParams.get('email') || '';
      const prompt = searchParams.get('prompt') || '';

      // Generate CSRF state
      const state = generateState();
      const signedState = signState(state, config.oauthSecret); // Returns state.signature

      // Generate PKCE challenge
      const { verifier, challenge } = generatePKCE();

      // ✅ Send PLAIN state to IDP (like client-c does)
      // We'll validate the returned state against the cookie
      const authorizeUrl = new URL(`${config.idpServer}${API_PATHS.idpAuthorize}`);
      authorizeUrl.searchParams.append('client_id', config.clientId);
      authorizeUrl.searchParams.append('response_type', DEFAULT_CONFIG.responseType);
      authorizeUrl.searchParams.append('redirect_uri', config.redirectUri);
      authorizeUrl.searchParams.append('scope', DEFAULT_CONFIG.scope);
      authorizeUrl.searchParams.append('state', state); // ✅ Send plain state, not signed
      authorizeUrl.searchParams.append('code_challenge', challenge);
      authorizeUrl.searchParams.append('code_challenge_method', DEFAULT_CONFIG.codeChallengeMethod);

      if (email) {
        authorizeUrl.searchParams.append('login_hint', email);
      }

      if (prompt) {
        authorizeUrl.searchParams.append('prompt', prompt);
      }

      // Set cookies and return URL as JSON (for fetch API compatibility)
      const response = NextResponse.json(
        { url: authorizeUrl.toString(), ok: true },
        { status: 200 }
      );

      // ✅ Store state in HttpOnly cookie (like client-c does)
      // Format: state.signature (validated on callback)
      const stateExpiry = new Date(Date.now() + DEFAULT_CONFIG.timeouts.state * 1000);
      response.cookies.set({
        name: DEFAULT_CONFIG.cookies.oauthState,
        value: signedState, // Store signed state for validation
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: getSecureFlag(),
        expires: stateExpiry,
      });

      // Store PKCE verifier (httpOnly cookie)
      const pkceExpiry = new Date(Date.now() + DEFAULT_CONFIG.timeouts.pkce * 1000);
      response.cookies.set({
        name: DEFAULT_CONFIG.cookies.pkceVerifier,
        value: verifier,
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: getSecureFlag(),
        expires: pkceExpiry,
      });

      return response;
    } catch (error) {
      console.error('[startAuth] Error:', error);
      return NextResponse.json(
        { error: 'Failed to start authentication' },
        { status: 500 }
      );
    }
  };
}

function getSecureFlag(): boolean {
  const env = process.env.NODE_ENV || 'development';
  return env === 'production';
}
