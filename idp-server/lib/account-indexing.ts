/**
 * Account Indexing Utility
 * Maps between account index (0, 1, 2...) and account ID
 * Ensures deterministic, stable ordering across requests
 */

import type { SessionLogonWithAllFields } from '@/types';
import { getSessionLogons, supabase } from './db';

export interface IndexedAccount {
  index: number;
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  isPrimary: boolean;
  logged_in_at: string;
  last_active_at: string | null;
  revoked: boolean | null;
  // Stable index from idp_jar cookie (insertion order, never changes).
  // Used for /u/{jarIndex} URLs. Unlike `index` (session order), this is stable across account switches.
  jarIndex?: number;
  // Account state (Google-like):
  // - active: Currently logged in (in __sso_session with active_account_id = this account)
  // - can_switch: Has valid session_logon in CURRENT sessionId (one-click switch available)
  // - needs_reauth: Not in current session / expired / signed out (needs re-login)
  accountState: 'active' | 'can_switch' | 'needs_reauth';
}

/**
 * Get account by index (0-based, session-aware)
 * Returns the Nth account from session_logons ordered by logged_in_at ASC
 * Skips revoked logons
 */
export async function getAccountByIndex(
  sessionId: string,
  index: number
): Promise<IndexedAccount | null> {
  try {
    const allAccounts = await getAllAccountsWithIndices(sessionId);
    
    if (index < 0 || index >= allAccounts.length) {
      console.log(
        `[AccountIndexing] Index ${index} out of range (total: ${allAccounts.length})`
      );
      return null;
    }

    return allAccounts[index];
  } catch (error) {
    console.error('[AccountIndexing] Error getting account by index:', error);
    return null;
  }
}

/**
 * Get index by account ID (session-aware)
 * Returns the 0-based position of the account in the session
 * Useful for determining which /u/{index} URL to use
 */
export async function getIndexByAccountId(
  sessionId: string,
  accountId: string
): Promise<number | null> {
  try {
    const allAccounts = await getAllAccountsWithIndices(sessionId);
    const index = allAccounts.findIndex((acc) => acc.id === accountId);

    if (index === -1) {
      console.log(
        `[AccountIndexing] Account ${accountId.substring(0, 8)}... not found in session`
      );
      return null;
    }

    return index;
  } catch (error) {
    console.error('[AccountIndexing] Error getting index by account ID:', error);
    return null;
  }
}

/**
 * List all accounts with indices (session-aware)
 * Returns accounts ordered by logged_in_at ASC (consistent with session_logons ordering)
 * Includes both active and revoked accounts
 */
export async function getAllAccountsWithIndices(
  sessionId: string
): Promise<IndexedAccount[]> {
  try {
    const logons = await getSessionLogons(sessionId);

    // Filter by revoked status and assign indices
    const activeAccounts: IndexedAccount[] = (logons as unknown as SessionLogonWithAllFields[])
      .filter((logon) => !logon.revoked)
      .map((logon, accountIndex) => ({
        index: accountIndex,
        id: logon.account_id,
        avatar_url: undefined,
        email: logon.account?.email ?? 'unknown',
        name: logon.account?.name ?? 'Unknown',
        isPrimary: logon.account?.is_primary ?? false,
        logged_in_at: logon.logged_in_at,
        last_active_at: logon.last_active_at,
        revoked: logon.revoked,
        accountState: 'active' as const, // Default to 'active' - will be overridden by caller if needed
      }));

    return activeAccounts;
  } catch (error) {
    console.error('[AccountIndexing] Error getting all accounts with indices:', error);
    return [];
  }
}

/**
 * Get active (non-revoked) account count in session
 * Used for validation and boundary checking
 */
export async function getActiveAccountCount(sessionId: string): Promise<number> {
  try {
    const accounts = await getAllAccountsWithIndices(sessionId);
    return accounts.length;
  } catch (error) {
    console.error('[AccountIndexing] Error counting active accounts:', error);
    return 0;
  }
}

/**
 * Get account by combined index (session + jar)
 * 
 * Replicates the same indexing logic used by the widget API:
 * 1. Session accounts first (non-revoked, ordered by logged_in_at ASC)
 * 2. Jar-only accounts next (accounts in idp_jar cookie but NOT in session)
 * 
 * This ensures the index used in /u/{index} URLs matches what the widget shows.
 */
export async function getAccountByCombinedIndex(
  sessionId: string | null,
  jarCookieValue: string | null,
  index: number,
  activeAccountId?: string | null
): Promise<IndexedAccount | null> {
  try {
    const accountsMap = new Map<string, IndexedAccount>();

    // FLOW 1: Session accounts (same order as widget)
    if (sessionId) {
      const sessionAccounts = await getAllAccountsWithIndices(sessionId);
      sessionAccounts.forEach(acc => {
        const state = acc.id === activeAccountId ? 'active' : 'can_switch';
        accountsMap.set(acc.id, {
          ...acc,
          accountState: state as 'active' | 'can_switch' | 'needs_reauth',
        });
      });
    }

    // FLOW 2: Jar accounts NOT already in session
    if (jarCookieValue) {
      const jarAccountIds = jarCookieValue.split(',').filter(Boolean);
      const jarAccountsToCheck = jarAccountIds.filter(id => !accountsMap.has(id));

      if (jarAccountsToCheck.length > 0) {
        const response = await supabase
          .from('user_accounts')
          .select('id, name, email, avatar_url, is_primary')
          .in('id', jarAccountsToCheck);

        const accountsData = response.data || [];

        for (const account of accountsData) {
          if (!accountsMap.has(account.id)) {
            accountsMap.set(account.id, {
              index: accountsMap.size,
              id: account.id,
              name: account.name,
              email: account.email,
              avatar_url: account.avatar_url || undefined,
              isPrimary: account.is_primary ?? false,
              logged_in_at: new Date().toISOString(),
              last_active_at: new Date().toISOString(),
              revoked: false,
              accountState: 'needs_reauth',
            });
          }
        }
      }
    }

    // Convert map to array and reassign indices
    const allAccounts = Array.from(accountsMap.values()).map((acc, i) => ({
      ...acc,
      index: i,
    }));

    if (index < 0 || index >= allAccounts.length) {
      console.log(`[AccountIndexing] Combined index ${index} out of range (total: ${allAccounts.length})`);
      return null;
    }

    return allAccounts[index];
  } catch (error) {
    console.error('[AccountIndexing] Error in getAccountByCombinedIndex:', error);
    return null;
  }
}
