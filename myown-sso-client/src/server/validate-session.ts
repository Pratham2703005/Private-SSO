/**
 * Validate session and return user data
 * 
 * Called by client-side /api/me endpoint to get current user info
 * 
 * Flow:
 * 1. Extract session ID from cookie
 * 2. Call IDP session endpoint to get user data
 * 3. Return session data or empty if invalid
 * 
 * Usage in app/api/me/route.ts:
 * ```
 * import { validateSession } from 'myown-sso-client/server';
 * 
 * export const POST = validateSession({
 *   clientId: process.env.NEXT_PUBLIC_CLIENT_ID,
 *   idpServer: process.env.NEXT_PUBLIC_IDP_SERVER,
 * });
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_CONFIG, API_PATHS } from '../shared';
import type { ValidateSessionConfig, ValidateSessionResponse } from '../shared';

export function validateSession(config: ValidateSessionConfig) {
  return async (request: NextRequest): Promise<NextResponse<ValidateSessionResponse>> => {
    try {
      // Extract session ID from cookie
      const sessionId = request.cookies.get(DEFAULT_CONFIG.cookies.ssoSession)?.value;

      // No session = not authenticated
      if (!sessionId) {
        return NextResponse.json(
          {
            authenticated: false,
            error: 'No session cookie found',
          },
          { status: 200 }
        );
      }

      // Call IDP session endpoint to validate + get user data
      const sessionUrl = new URL(`${config.idpServer}${API_PATHS.idpSession}`);
      const sessionResponse = await fetch(sessionUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `${DEFAULT_CONFIG.cookies.ssoSession}=${sessionId}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          session_id: sessionId,
        }),
      });

      // Session invalid = IDP returns error
      if (!sessionResponse.ok) {
        const error = await sessionResponse.json().catch(() => ({}));
        console.warn('[validateSession] IDP session validation failed:', error);
        return NextResponse.json(
          {
            authenticated: false,
            error: error.error || 'Session validation failed',
          },
          { status: 200 }
        );
      }

      // Parse session data from IDP
      const sessionData = await sessionResponse.json();

      // Return authenticated session
      return NextResponse.json(
        {
          authenticated: true,
          sessionId,
          user: sessionData.user,
          account: sessionData.account,
          accounts: sessionData.accounts,
          activeAccountId: sessionData.activeAccountId,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error('[validateSession] Unexpected error:', error);
      return NextResponse.json(
        {
          authenticated: false,
          error: 'Session validation failed',
        },
        { status: 200 }
      );
    }
  };
}
