/**
 * GET /api/widget/accounts
 *
 * Returns accounts for widget display
 * Supports two flows:
 * 1. With active session: returns all accounts in session with active account index
 * 2. Without active session: returns idp_jar remembered accounts (Google-style "Signed out" state)
 *
 * Security:
 * - Returns minimal info only (id, email, name, profile_image_url, index)
 * - No tokens returned
 * - IDs from idp_jar are unprivileged account references
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionId } from '@/lib/utils';
import { getSession, supabase } from '@/lib/db';
import { getAllAccountsWithIndices, getIndexByAccountId } from '@/lib/account-indexing';
import { addWidgetCorsHeaders } from '@/lib/cors-utils';


export async function OPTIONS(request: NextRequest) {
  return addWidgetCorsHeaders(new NextResponse(null, { status: 200 }), request);
}

export async function GET(request: NextRequest) {
  try {
    // Get IDP session from cookie or Authorization header
    const sessionId = getSessionId(request);

    // FLOW 1: Active session exists - return all session accounts with active index
    if (sessionId) {
      const session = await getSession(sessionId);

      if (session && session.user_id && session.active_account_id) {
        console.log('[Widget] /accounts: Active session found, fetching accounts');

        // Get all accounts in session with indices
        const accountsWithIndices = await getAllAccountsWithIndices(sessionId);

        if (accountsWithIndices.length > 0) {
          // Find active account index
          const activeIndex = await getIndexByAccountId(sessionId, session.active_account_id);

          // Format response
          const accounts = accountsWithIndices.map((acc) => ({
            index: acc.index,
            id: acc.id,
            email: acc.email,
            name: acc.name,
            profile_image_url: acc.profile_image_url,
            isPrimary: acc.isPrimary,
          }));

          console.log(
            `[Widget] /accounts: Returning ${accounts.length} active accounts, active index: ${activeIndex}`
          );

          return addWidgetCorsHeaders(NextResponse.json({ accounts, activeIndex }, { status: 200 }), request);
        }
      }
    }

    // FLOW 2: No active session - try to return remembered accounts from idp_jar
    console.log('[Widget] /accounts: No active session, checking idp_jar cookie');
    const jarCookie = request.cookies.get('idp_jar')?.value;

    if (!jarCookie) {
      console.log('[Widget] /accounts: No idp_jar cookie found');
      return addWidgetCorsHeaders(NextResponse.json({ accounts: [], activeIndex: -1 }, { status: 200 }), request);
    }

    // Parse account IDs from jar cookie
    const accountIds = jarCookie.split(',').filter(Boolean);

    if (accountIds.length === 0) {
      console.log('[Widget] /accounts: idp_jar cookie is empty');
      return addWidgetCorsHeaders(NextResponse.json({ accounts: [], activeIndex: -1 }, { status: 200 }), request);
    }

    console.log('[Widget] /accounts: Fetching remembered accounts for IDs:', accountIds);

    // Fetch account details from database
    const { data: accountsData, error } = await supabase
      .from('user_accounts')
      .select('id, email, name, profile_image_url')
      .in('id', accountIds);

    if (error) {
      console.error('[Widget] /accounts: Failed to fetch from DB:', error);
      return addWidgetCorsHeaders(NextResponse.json({ accounts: [], activeIndex: -1 }, { status: 200 }), request);
    }

    if (!accountsData || accountsData.length === 0) {
      console.log('[Widget] /accounts: No accounts found in DB');
      return addWidgetCorsHeaders(NextResponse.json({ accounts: [], activeIndex: -1 }, { status: 200 }), request);
    }

    // Format accounts with index (order matches jar)
    const accounts = accountIds
      .map((id, index) => {
        const account = accountsData.find((acc) => acc.id === id);
        if (!account) return null;
        return {
          index,
          id: account.id,
          email: account.email,
          name: account.name,
          profile_image_url: account.profile_image_url ?? null,
          isPrimary: false,
        };
      })
      .filter(Boolean);

    console.log('[Widget] /accounts: Returning', accounts.length, 'remembered accounts (signed out state)');

    return addWidgetCorsHeaders(NextResponse.json({ accounts, activeIndex: -1 }, { status: 200 }), request);
  } catch (error) {
    console.error('[Widget] /accounts error:', error);
    return addWidgetCorsHeaders(
      NextResponse.json(
        { accounts: [], activeIndex: -1 },
        { status: 200 }
      ),
      request
    );
  }
}
