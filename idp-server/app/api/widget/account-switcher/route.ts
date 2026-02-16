/**
 * GET /api/widget/account-switcher
 *
 * Returns accounts with 3-state (active | can_switch | needs_reauth) for widget display.
 * Mirrors the logic from app/widget/account-switcher/page.tsx but as a JSON API.
 *
 * Used by widget-client.tsx to refetch account states after:
 * - Account switch
 * - Logout (current or global)
 * - Session update from parent
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMasterCookie } from '@/lib/utils';
import { supabase } from '@/lib/db';
import { getAllAccountsWithIndices } from '@/lib/account-indexing';
import type { IndexedAccount } from '@/lib/account-indexing';

export async function GET(request: NextRequest) {
  try {
    const sessionId = getMasterCookie(request);
    let activeAccountId: string | null = null;

    // Use Map to prevent duplicate accounts
    const accountsMap = new Map<string, IndexedAccount>();

    // FLOW 1: Active session — get accounts from session_logons
    if (sessionId) {
      try {
        const sessionResponse = await supabase
          .from('sessions')
          .select('active_account_id')
          .eq('id', sessionId)
          .single();

        if (sessionResponse.data) {
          activeAccountId = sessionResponse.data.active_account_id;
        }
      } catch {
        // Session might be invalid
      }

      const sessionAccounts = await getAllAccountsWithIndices(sessionId);

      if (sessionAccounts && sessionAccounts.length > 0) {
        sessionAccounts.forEach(acc => {
          const state = acc.id === activeAccountId ? 'active' : 'can_switch';
          accountsMap.set(acc.id, {
            ...acc,
            accountState: state as 'active' | 'can_switch' | 'needs_reauth',
          });
        });
      }
    }

    // FLOW 2: Check idp_jar for remembered accounts NOT already in session
    const jarCookie = request.cookies.get('idp_jar')?.value;

    if (jarCookie) {
      const jarAccountIds = jarCookie.split(',').filter(Boolean);
      const jarAccountsToCheck = jarAccountIds.filter(id => !accountsMap.has(id));

      if (jarAccountsToCheck.length > 0) {
        try {
          const response = await supabase
            .from('user_accounts')
            .select('id, name, email')
            .in('id', jarAccountsToCheck);

          const accountsData = response.data || [];

          for (const account of accountsData) {
            let state: 'active' | 'can_switch' | 'needs_reauth' = 'needs_reauth';

            // Only mark can_switch if account has valid logon in CURRENT sessionId
            if (sessionId) {
              try {
                const logonCheck = await supabase
                  .from('session_logons')
                  .select('id')
                  .eq('session_id', sessionId)
                  .eq('account_id', account.id)
                  .not('revoked', 'is', true)
                  .single();

                if (logonCheck.data) {
                  const sessionCheck = await supabase
                    .from('sessions')
                    .select('expires_at')
                    .eq('id', sessionId)
                    .single();

                  if (sessionCheck.data?.expires_at && new Date(sessionCheck.data.expires_at) > new Date()) {
                    state = 'can_switch';
                  }
                }
              } catch {
                state = 'needs_reauth';
              }
            }

            if (!accountsMap.has(account.id)) {
              accountsMap.set(account.id, {
                index: accountsMap.size,
                id: account.id,
                name: account.name,
                email: account.email,
                avatar_url: undefined,
                isPrimary: false,
                logged_in_at: new Date().toISOString(),
                last_active_at: new Date().toISOString(),
                revoked: false,
                accountState: state,
              });
            }
          }
        } catch {
          // Silent fail on jar account fetch
        }
      }
    }

    // Compute stable jarIndex from idp_jar cookie order
    const jarAccountIds = jarCookie ? jarCookie.split(',').filter(Boolean) : [];

    // Convert Map to array with updated indices
    const accounts = Array.from(accountsMap.values()).map((acc, idx) => {
      const jarPos = jarAccountIds.indexOf(acc.id);
      return {
        ...acc,
        index: idx,
        jarIndex: jarPos >= 0 ? jarPos : undefined,
      };
    });

    const isSignedOut = accounts.length === 0;

    return NextResponse.json({ accounts, isSignedOut }, { status: 200 });
  } catch (error) {
    console.error('[API] /api/widget/account-switcher error:', error);
    return NextResponse.json({ accounts: [], isSignedOut: true }, { status: 200 });
  }
}
