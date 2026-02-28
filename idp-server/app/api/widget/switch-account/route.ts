/**
 * POST /api/widget/switch-account
 *
 * Switches active account in IDP session (context-only, no tokens)
 * Called from iframe when user clicks another account in switcher popup
 *
 * Request body:
 * { index: number }
 *
 * Response:
 * { success: true, newActiveIndex: number, activeId: string }
 *
 * Important: NO tokens returned. Client must trigger silent OIDC (/authorize?prompt=none)
 * to get fresh tokens for new account.
 *
 * Security:
 * - Validates __sso_session cookie
 * - Validates index is in session's account list
 * - Updates session.active_account_id
 * - Updates session_logons.last_active_at
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMasterCookie } from '@/lib/utils';
import { getSession, switchActiveAccount } from '@/lib/db';
import { getAccountByIndex, getActiveAccountCount } from '@/lib/account-indexing';

interface SwitchAccountRequest {
  index: number;
}

interface SwitchAccountResponse {
  success: boolean;
  newActiveIndex?: number;
  activeId?: string;
  accountId?: string; // Account ID for client to use in re-auth
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Get IDP session from cookie
    const sessionId = getMasterCookie(request);

    if (!sessionId) {
      console.log('[Widget] /switch-account: No IDP session found');
      return NextResponse.json(
        { success: false, error: 'Not logged in' },
        { status: 401 }
      );
    }

    // Validate session exists
    const session = await getSession(sessionId);

    if (!session || !session.user_id) {
      console.log('[Widget] /switch-account: Session invalid or expired');
      return NextResponse.json(
        { success: false, error: 'Session invalid or expired' },
        { status: 401 }
      );
    }

    // Parse request body
    let body: SwitchAccountRequest;
    try {
      body = await request.json();
    } catch (e) {
      console.log('[Widget] /switch-account: Invalid JSON');
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { index } = body;

    // Validate index is number
    if (typeof index !== 'number' || index < 0) {
      console.log('[Widget] /switch-account: Invalid index:', index);
      return NextResponse.json(
        { success: false, error: 'Invalid index' },
        { status: 400 }
      );
    }

    // Check account count
    const accountCount = await getActiveAccountCount(sessionId);

    if (index >= accountCount) {
      console.log(
        `[Widget] /switch-account: Index ${index} out of range (total: ${accountCount})`
      );
      return NextResponse.json(
        { success: false, error: 'Index out of range' },
        { status: 403 }
      );
    }

    // Get account at index
    const account = await getAccountByIndex(sessionId, index);

    if (!account) {
      console.log(`[Widget] /switch-account: Account not found at index ${index}`);
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 403 }
      );
    }

    // Switch active account in session
    await switchActiveAccount(sessionId, account.id);

    const response: SwitchAccountResponse = {
      success: true,
      newActiveIndex: index,
      activeId: account.id,
      accountId: account.id,
    };

    // After successful switch:
    // - IDP session (__sso_session) now has new active_account_id
    // - Client will receive ACCOUNT_SWITCHED message via postMessage
    // - Client's widget-manager will detect this and trigger OAuth re-auth
    // - Client constructs authorize URL from its own config (clientId, redirectUri)
    // - This ensures tight coupling is avoided (IDP doesn't hardcode client URLs)
    // - Enables multi-client support (client-a, client-b, client-c all use same IDP)

    console.log(
      `[Widget] /switch-account: Switched to index ${index} (${account.email})`
    );

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[Widget] /switch-account error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
