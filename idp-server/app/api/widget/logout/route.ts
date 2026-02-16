/**
 * POST /api/widget/logout
 *
 * Handles logout from widget popup
 * Supports three modes:
 * - "app": Returns logoutUrl for client to redirect to (keeps IDP session)
 * - "current": Signs out only the active account (revokes its logon, switches to next)
 * - "global": Destroys entire IDP session (all accounts everywhere)
 *
 * Request body:
 * { mode: "app" | "current" | "global" }
 *
 * Response (app mode):
 * { logoutUrl: "https://client-a.com/api/auth/logout-app" }
 *
 * Response (current mode):
 * { success: true, nextAccountId?: string }
 *
 * Response (global mode):
 * 204 No Content (with cookies cleared)
 *
 * Security:
 * - Validates __sso_session cookie
 * - For app logout, queries Referer or Origin header to determine client origin
 * - For current logout, revokes logon + tokens for active account only
 * - For global logout, revokes all tokens and clears IDP session
 * - Does NOT return sensitive data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMasterCookie, clearMasterCookie } from '@/lib/utils';
import { getSession, revokeAllUserTokens, revokeSession, markLogonRevoked, revokeAccountTokensPrecise, switchActiveAccount, getActiveSessionLogons, supabase } from '@/lib/db';
import { WIDGET_ALLOWED_CLIENTS } from '@/config/widget-clients';

interface LogoutRequest {
  mode: 'app' | 'current' | 'global';
}

interface LogoutResponse {
  logoutUrl?: string;
  success?: boolean;
  error?: string;
}

// Map of client IDs to their logout endpoint paths
// Built from configured clients
// const CLIENT_LOGOUT_ENDPOINTS: Record<string, string> = {
//   'client-a': 'http://localhost:3001/api/auth/logout-app',
//   'client-b': 'http://localhost:3002/api/auth/logout-app',
// };
export const CLIENT_LOGOUT_ENDPOINTS: Record<string, string> =
  WIDGET_ALLOWED_CLIENTS.reduce((acc, client) => {
    acc[client.clientId] = `${client.origin}/api/auth/logout-app`;
    return acc;
  }, {} as Record<string, string>);

export async function POST(request: NextRequest) {
  try {
    // Get IDP session from cookie
    const sessionId = getMasterCookie(request);

    if (!sessionId) {
      console.log('[Widget] /logout: No IDP session found');
      return NextResponse.json(
        { success: false, error: 'Not logged in' },
        { status: 401 }
      );
    }

    // Validate session exists
    const session = await getSession(sessionId);

    if (!session || !session.user_id) {
      console.log('[Widget] /logout: Session invalid or expired');
      return NextResponse.json(
        { success: false, error: 'Session invalid or expired' },
        { status: 401 }
      );
    }

    // Parse request body
    let body: LogoutRequest;
    try {
      body = await request.json();
    } catch (e) {
      console.log('[Widget] /logout: Invalid JSON');
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { mode } = body;

    // Validate mode
    if (mode !== 'app' && mode !== 'current' && mode !== 'global') {
      console.log('[Widget] /logout: Invalid logout mode:', mode);
      return NextResponse.json(
        { success: false, error: 'Invalid logout mode' },
        { status: 400 }
      );
    }

    // Handle current-account logout (revoke only active account's logon)
    if (mode === 'current') {
      console.log('[Widget] /logout: Current account logout requested');

      const activeAccountId = session.active_account_id;
      if (!activeAccountId) {
        return NextResponse.json(
          { success: false, error: 'No active account' },
          { status: 400 }
        );
      }

      // Revoke this account's logon in the session
      await markLogonRevoked(sessionId, activeAccountId);

      // Revoke this account's refresh tokens for this session
      await revokeAccountTokensPrecise(session.user_id, activeAccountId, sessionId);

      // Find next account to switch to
      const remainingLogons = await getActiveSessionLogons(sessionId);

      if (remainingLogons.length > 0) {
        // Switch to next available account
        const nextAccountId = remainingLogons[0].account_id;
        await switchActiveAccount(sessionId, nextAccountId);
        console.log('[Widget] /logout (current): Switched to next account:', nextAccountId.substring(0, 8) + '...');
        return NextResponse.json({ success: true, nextAccountId }, { status: 200 });
      } else {
        // No more active logons — clear active_account_id but keep session for jar visibility
        // The session still exists so jar accounts can reference it
        console.log('[Widget] /logout (current): No more active accounts, clearing active_account_id');
        
        // We don't destroy the session — just clear the active account
        // This way jar accounts still work
        await supabase
          .from('sessions')
          .update({ active_account_id: null })
          .eq('id', sessionId);

        return NextResponse.json({ success: true, nextAccountId: null }, { status: 200 });
      }
    }

    // Handle app-only logout (client will handle the actual logout)
    if (mode === 'app') {
      console.log('[Widget] /logout: App logout requested');

      // Try to determine client origin from request headers
      // In production, you might validate this against registered clients
      const origin = request.headers.get('origin');
      const referer = request.headers.get('referer');

      console.log('[Widget] /logout: Request origin:', origin);
      console.log('[Widget] /logout: Request referer:', referer);

      // Default to client-a for now (in production, derive from origin)
      // For iframe requests, origin will be the client domain
      let logoutUrl = CLIENT_LOGOUT_ENDPOINTS['client-a'];

      if (origin && origin.includes('localhost:3002')) {
        logoutUrl = CLIENT_LOGOUT_ENDPOINTS['client-b'];
      } else if (origin && origin.includes('localhost:3001')) {
        logoutUrl = CLIENT_LOGOUT_ENDPOINTS['client-a'];
      }

      const response: LogoutResponse = {
        logoutUrl,
      };

      console.log(
        `[Widget] /logout (app): Returning logout URL: ${logoutUrl}`
      );

      return NextResponse.json(response, { status: 200 });
    }

    // Handle global logout (destroy IDP session)
    if (mode === 'global') {
      console.log('[Widget] /logout: Global logout requested');

      // Revoke all tokens for this user
      await revokeAllUserTokens(session.user_id);

      // Revoke the session itself
      await revokeSession(sessionId);

      // Clear IDP cookies
      const logoutResponse = new NextResponse(null, { status: 204 });
      const withClearedCookies = clearMasterCookie(logoutResponse);

      console.log('[Widget] /logout (global): IDP session destroyed and cookies cleared');

      return withClearedCookies;
    }
  } catch (error) {
    console.error('[Widget] /logout error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
