import { cookies } from 'next/headers';
import { getAllAccountsWithIndices } from '@/lib/account-indexing';
import { supabase } from '@/lib/db';
import type { IndexedAccount } from '@/lib/account-indexing';

/**
 * Optimized account fetching with parallel queries
 * This runs on the server and can be suspended, showing a skeleton while loading
 */
export async function AccountDataFetcher({
  children,
}: {
  children: (data: {
    accounts: IndexedAccount[];
    isSignedOut: boolean;
  }) => React.ReactNode;
}): Promise<React.ReactNode> {
  let accounts: IndexedAccount[] = [];
  let isSignedOut = false;

  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('__sso_session')?.value;
    console.log('[AccountDataFetcher] sessionId:', sessionId ? 'present' : 'missing');

    let activeAccountId: string | null = null;
    const accountsMap = new Map<string, IndexedAccount>();

    // PARALLEL: Fetch session data and accounts in parallel if session exists
    if (sessionId) {
      console.log('[AccountDataFetcher] Fetching accounts for session');

      // Run these in parallel
      const [sessionRes, sessionAccounts] = await Promise.all([
        supabase
          .from('sessions')
          .select('active_account_id')
          .eq('id', sessionId)
          .maybeSingle(),
        getAllAccountsWithIndices(sessionId),
      ]);

      const sessionData = sessionRes.data ?? null;


      activeAccountId = sessionData?.active_account_id || null;
      console.log('[AccountDataFetcher] Active account ID:', activeAccountId);
      console.log('[AccountDataFetcher] Session accounts:', sessionAccounts?.length);

      if (sessionAccounts && sessionAccounts.length > 0) {
        sessionAccounts.forEach((acc) => {
          const state = acc.id === activeAccountId ? 'active' : 'can_switch';
          accountsMap.set(acc.id, {
            ...acc,
            accountState: state as 'active' | 'can_switch' | 'needs_reauth',
          });
        });
      }
    }

    // FLOW 2: Check idp_jar for remembered accounts
    const jarCookie = cookieStore.get('idp_jar')?.value;
    console.log('[AccountDataFetcher] idp_jar cookie:', jarCookie ? `"${jarCookie}"` : 'missing');

    if (jarCookie) {
      const jarAccountIds = jarCookie.split(',').filter(Boolean);
      console.log('[AccountDataFetcher] Found', jarAccountIds.length, 'remembered account IDs');

      if (jarAccountIds.length > 0) {
        const jarAccountsToCheck = jarAccountIds.filter((id) => !accountsMap.has(id));
        console.log('[AccountDataFetcher] Jar accounts to check:', jarAccountsToCheck.length);

        if (jarAccountsToCheck.length > 0) {
          try {
            // Fetch jar account details
            const accountsData = (
              await supabase
                .from('user_accounts')
                .select('id, name, email')
                .in('id', jarAccountsToCheck)
            ).data || [];
            console.log('[AccountDataFetcher] DB found', accountsData.length, 'jar accounts');

            // Check state for each jar account (in parallel batches)
            const jarAccountPromises = accountsData.map(async (account) => {
              let state: 'active' | 'can_switch' | 'needs_reauth' = 'needs_reauth';

              if (sessionId) {
                try {
                  // Check if account has valid logon in current session
                  const [logonRes, sessionRes] = await Promise.all([
                    supabase
                      .from('session_logons')
                      .select('id')
                      .eq('session_id', sessionId)
                      .eq('account_id', account.id)
                      .not('revoked', 'is', true)
                      .maybeSingle(),
                    supabase
                      .from('sessions')
                      .select('expires_at')
                      .eq('id', sessionId)
                      .maybeSingle(),
                  ]);

                  const logonCheck = logonRes.data ?? null;
                  const sessionCheck = sessionRes.data ?? null;


                  if (logonCheck && sessionCheck?.expires_at && new Date(sessionCheck.expires_at) > new Date()) {
                    console.log(`[AccountDataFetcher] Account ${account.id}: can_switch`);
                    state = 'can_switch';
                  }
                } catch (error) {
                  console.log(`[AccountDataFetcher] Account ${account.id}: needs_reauth`);
                }
              }

              return { account, state };
            });

            const results = await Promise.all(jarAccountPromises);
            results.forEach(({ account, state }) => {
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
            });
          } catch (error) {
            console.error('[AccountDataFetcher] Error processing jar accounts:', error);
          }
        }
      }
    }

    // Compute stable jarIndex from idp_jar cookie order
    const jarCookieValue = cookieStore.get('idp_jar')?.value;
    const jarAccountIds = jarCookieValue ? jarCookieValue.split(',').filter(Boolean) : [];

    accounts = Array.from(accountsMap.values()).map((acc, idx) => {
      const jarPos = jarAccountIds.indexOf(acc.id);
      return {
        ...acc,
        index: idx,
        jarIndex: jarPos >= 0 ? jarPos : undefined,
      };
    });

    isSignedOut = accounts.length === 0;
    console.log('[AccountDataFetcher] Final: ' + accounts.length + ' accounts, isSignedOut=' + isSignedOut);
  } catch (error) {
    console.error('[AccountDataFetcher] Error fetching accounts:', error);
    isSignedOut = true;
  }

  return children({ accounts, isSignedOut });
}
