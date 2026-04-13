/**
 * Handle logout - clear session cookie and revoke tokens on IDP
 *
 * Supports two scopes:
 * - "app": Revoke tokens for THIS client only (user stays logged into IDP)
 * - "global": Revoke ALL tokens + clear IDP session (full logout everywhere)
 *
 * Usage in app/api/auth/logout/route.ts:
 * ```
 * import { handleLogout } from 'pratham-sso/server';
 *
 * export const POST = handleLogout({
 *   clientId: process.env.NEXT_PUBLIC_CLIENT_ID!,
 *   idpServer: process.env.NEXT_PUBLIC_IDP_SERVER!,
 * });
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_CONFIG, API_PATHS } from '../shared';
import type { HandleLogoutConfig } from '../shared';

export function handleLogout(config: HandleLogoutConfig) {
  return async (request: NextRequest) => {
    try {
      const body = await request.json().catch(() => ({}));
      const { scope = 'app' } = body as { scope?: string };

      // Validate scope
      if (!['app', 'global'].includes(scope)) {
        return NextResponse.json(
          { success: false, error: "Invalid scope. Must be 'app' or 'global'" },
          { status: 400 }
        );
      }

      // Get session cookie
      const sessionId = request.cookies.get(DEFAULT_CONFIG.cookies.ssoSession)?.value;

      if (!sessionId) {
        // No session cookie — already logged out, just return success
        return NextResponse.json({ success: true, message: 'Already logged out' });
      }

      // Get CSRF token from cookie (for IDP double-submit validation)
      const csrfToken = request.cookies.get(DEFAULT_CONFIG.cookies.csrf)?.value || '';

      // Call IDP logout endpoint
      const idpLogoutUrl = `${config.idpServer}${API_PATHS.idpLogout}`;
      try {
        await fetch(idpLogoutUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `${DEFAULT_CONFIG.cookies.ssoSession}=${sessionId}; ${DEFAULT_CONFIG.cookies.csrf}=${csrfToken}`,
            'x-csrf-token': csrfToken,
          },
          body: JSON.stringify({
            scope,
            clientId: config.clientId,
            _csrf: csrfToken,
          }),
        });
      } catch (err) {
        // IDP call failed — still clear local cookie
        console.error('[handleLogout] IDP logout call failed:', err);
      }

      // Build response
      const response = NextResponse.json({
        success: true,
        message: scope === 'global' ? 'Logged out globally' : 'Logged out from this app',
        scope,
      });

      // Clear the session cookie
      response.cookies.set({
        name: DEFAULT_CONFIG.cookies.ssoSession,
        value: '',
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 0,
      });

      // Clear the CSRF cookie
      response.cookies.set({
        name: DEFAULT_CONFIG.cookies.csrf,
        value: '',
        httpOnly: false,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 0,
      });

      return response;
    } catch (error) {
      console.error('[handleLogout] Unexpected error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}
