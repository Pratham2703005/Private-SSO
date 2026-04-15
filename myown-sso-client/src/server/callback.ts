/**
 * Handle OAuth2 callback
 * 
 * Flow:
 * 1. Extract code + state from query params
 * 2. Verify state signature (CSRF protection)
 * 3. Get PKCE verifier from cookie
 * 4. Exchange code for tokens at IDP token endpoint
 * 5. Store session cookie
 * 6. Redirect to redirect_uri
 * 
 * Usage in app/api/auth/callback/route.ts:
 * ```
 * import { handleCallback } from 'myown-sso-client/server';
 * 
 * export const GET = handleCallback({
 *   clientId: process.env.NEXT_PUBLIC_CLIENT_ID,
 *   idpServer: process.env.NEXT_PUBLIC_IDP_SERVER,
 *   redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI,
 *   oauthSecret: process.env.OAUTH_SECRET,
 * });
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { DEFAULT_CONFIG, API_PATHS } from '../shared';
import type { HandleCallbackConfig, TokenResponse } from '../shared';

export function handleCallback(config: HandleCallbackConfig) {
  return async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const requestUrl = new URL(request.url);
      const origin = requestUrl.origin;
      
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Handle OAuth errors from IDP
      if (error) {
        const errorMsg = `Authentication failed: ${error} - ${errorDescription || ''}`;
        console.error('[handleCallback]', errorMsg);
        return NextResponse.redirect(
          new URL(
            `/auth/error?error=${encodeURIComponent(error)}&description=${encodeURIComponent(errorDescription || '')}`,
            origin
          ),
          { status: 302 }
        );
      }

      // Validate required parameters
      if (!code || !state) {
        console.error('[handleCallback] Missing code or state');
        return NextResponse.redirect(
          new URL('/auth/error?error=invalid_request&description=Missing code or state', origin),
          { status: 302 }
        );
      }

      // Validate state against stored cookie (like client-c does)
      // Cookie contains: state.signature, query param contains: state
      const storedSignedState = request.cookies.get(DEFAULT_CONFIG.cookies.oauthState)?.value;
      if (!storedSignedState) {
        console.error('[handleCallback] Missing oauth_state cookie');
        return NextResponse.redirect(
          new URL('/auth/error?error=invalid_request&description=State validation cookie not found', origin),
          { status: 302 }
        );
      }

      // Validate state cookie format (state.signature)
      const [storedState, storedSignature] = storedSignedState.split('.');
      if (!storedState || !storedSignature) {
        console.error('[handleCallback] Invalid oauth_state cookie format');
        return NextResponse.redirect(
          new URL('/auth/error?error=invalid_request&description=Invalid state cookie format', origin),
          { status: 302 }
        );
      }

      // Verify the returned state matches what we stored
      if (state !== storedState) {
        console.error('[handleCallback] State mismatch', { returned: state, stored: storedState });
        return NextResponse.redirect(
          new URL('/auth/error?error=invalid_state&description=State parameter does not match', origin),
          { status: 302 }
        );
      }

      // Verify the state signature
      const expectedSignature = createHmac('sha256', config.oauthSecret)
        .update(storedState)
        .digest('hex');
      if (storedSignature !== expectedSignature) {
        console.error('[handleCallback] State signature mismatch');
        return NextResponse.redirect(
          new URL('/auth/error?error=invalid_state&description=State signature validation failed', origin),
          { status: 302 }
        );
      }

      // Get PKCE verifier from cookie
      const pkceVerifier = request.cookies.get(DEFAULT_CONFIG.cookies.pkceVerifier)?.value;
      if (!pkceVerifier) {
        console.error('[handleCallback] Missing PKCE verifier');
        return NextResponse.redirect(
          new URL('/auth/error?error=invalid_request&description=PKCE verifier not found', origin),
          { status: 302 }
        );
      }

      // Exchange code for tokens at IDP
      const tokenUrl = new URL(`${config.idpServer}${API_PATHS.idpToken}`);
      const tokenResponse = await fetch(tokenUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
          client_id: config.clientId,
          redirect_uri: config.redirectUri,
          code_verifier: pkceVerifier,
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.json();
        console.error('[handleCallback] Token exchange failed:', error);
        return NextResponse.redirect(
          new URL(
            `/auth/error?error=${encodeURIComponent(error.error || 'server_error')}`,
            origin
          ),
          { status: 302 }
        );
      }

      const tokenData: TokenResponse = await tokenResponse.json();

      // ⭐ CRITICAL: Validate session_id exists (security check)
      if (!tokenData.session_id) {
        console.error('[handleCallback] Missing session_id in token response');
        return NextResponse.redirect(
          new URL('/auth/error?error=invalid_response&description=Missing session_id in token response', origin),
          { status: 302 }
        );
      }

      // Create response - redirect to home (use absolute URL)
      const response = NextResponse.redirect(new URL('/', origin), { status: 302 });

      // ⭐ CRITICAL: Set session cookie with proper SSO configuration
      const sessionExpiry = new Date(
        Date.now() + (DEFAULT_CONFIG.timeouts.session * 1000)
      );
      response.cookies.set({
        name: DEFAULT_CONFIG.cookies.ssoSession,
        value: tokenData.session_id, // ✅ Validated above
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // SSO-ready: 'none' for widget cross-site
        secure: getSecureFlag(),
        path: '/',
        maxAge: DEFAULT_CONFIG.timeouts.session, // seconds
      });

      // Skip-the-first-/api/me bootstrap cookie
      // Short-lived (60s), JS-readable so the SSOProvider can hydrate initial session
      // state on mount without a roundtrip. No secrets — just the same user/account data
      // that /api/me returns. SameSite=Lax is fine: cookie is set during top-level
      // callback navigation and consumed on the same origin's next page load.
      if (tokenData.session_bootstrap) {
        try {
          response.cookies.set({
            name: DEFAULT_CONFIG.cookies.sessionBootstrap,
            value: encodeURIComponent(JSON.stringify(tokenData.session_bootstrap)),
            httpOnly: false,
            sameSite: 'lax',
            secure: getSecureFlag(),
            path: '/',
            maxAge: 60,
          });
        } catch (err) {
          // Non-fatal: widget just falls back to /api/me
          console.warn('[handleCallback] Failed to set bootstrap cookie:', err);
        }
      }

      // Clear PKCE verifier cookie
      response.cookies.delete(DEFAULT_CONFIG.cookies.pkceVerifier);

      return response;
    } catch (error) {
      const requestUrl = new URL(request.url);
      const origin = requestUrl.origin;
      console.error('[handleCallback] Unexpected error:', error);
      return NextResponse.redirect(
        new URL('/auth/error?error=server_error&description=An unexpected error occurred', origin),
        { status: 302 }
      );
    }
  };
}

function getSecureFlag(): boolean {
  const env = process.env.NODE_ENV || 'development';
  return env === 'production';
}
