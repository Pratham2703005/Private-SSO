/**
 * GET /api/widget/accounts
 *
 * Returns all accounts in current IDP session with indices
 * Called by iframe-based account switcher widget
 *
 * Response includes:
 * - accounts: array of accounts with index, id, email, name, avatar, isPrimary
 * - activeIndex: currently active account index
 *
 * Security:
 * - Validates __sso_session cookie (iframe on IDP domain reads directly)
 * - No tokens returned
 * - Only basic account info (email, name, avatar)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMasterCookie } from '@/lib/utils';
import { getSession } from '@/lib/db';
import { getAllAccountsWithIndices, getIndexByAccountId } from '@/lib/account-indexing';

interface AccountItem {
  index: number;
  id: string;
  email: string;
  name: string;
  avatar: string;
  isPrimary: boolean;
}

interface WidgetAccountsResponse {
  accounts: AccountItem[];
  activeIndex: number;
}

export async function GET(request: NextRequest) {
  try {
    // Get IDP session from cookie
    const sessionId = getMasterCookie(request);

    if (!sessionId) {
      console.log('[Widget] /accounts: No IDP session found');
      return NextResponse.json(
        { success: false, error: 'Not logged in' },
        { status: 401 }
      );
    }

    // Validate session exists and get user
    const session = await getSession(sessionId);

    if (!session || !session.user_id) {
      console.log('[Widget] /accounts: Session invalid or expired');
      return NextResponse.json(
        { success: false, error: 'Session invalid or expired' },
        { status: 401 }
      );
    }

    if (!session.active_account_id) {
      console.log('[Widget] /accounts: No active account in session');
      return NextResponse.json(
        { success: false, error: 'No active account' },
        { status: 400 }
      );
    }

    // Get all accounts in session with indices
    const accountsWithIndices = await getAllAccountsWithIndices(sessionId);

    if (accountsWithIndices.length === 0) {
      console.log('[Widget] /accounts: No accounts in session');
      return NextResponse.json(
        { success: false, error: 'No accounts found' },
        { status: 400 }
      );
    }

    // Find active account index
    const activeIndex = await getIndexByAccountId(sessionId, session.active_account_id);

    if (activeIndex === null) {
      console.log('[Widget] /accounts: Active account not found in indices');
      return NextResponse.json(
        { success: false, error: 'Active account not found' },
        { status: 400 }
      );
    }

    // Format response
    const accounts: AccountItem[] = accountsWithIndices.map((acc) => ({
      index: acc.index,
      id: acc.id,
      email: acc.email,
      name: acc.name,
      avatar: acc.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(acc.name)}`,
      isPrimary: acc.isPrimary,
    }));

    const response: WidgetAccountsResponse = {
      accounts,
      activeIndex,
    };

    console.log(
      `[Widget] /accounts: Returning ${accounts.length} accounts, active index: ${activeIndex}`
    );

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[Widget] /accounts error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
