/**
 * Account Indexing Utility
 * Maps between account index (0, 1, 2...) and account ID
 * Ensures deterministic, stable ordering across requests
 */

import { getSessionLogons } from './db';

export interface IndexedAccount {
  index: number;
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  isPrimary: boolean;
  logged_in_at: string;
  last_active_at: string;
  revoked: boolean;
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
    const activeAccounts: IndexedAccount[] = logons
      .filter((logon) => !logon.revoked)
      .map((logon, accountIndex) => ({
        index: accountIndex,
        id: logon.account_id,
        email: logon.user_accounts?.email ?? 'unknown',
        name: logon.user_accounts?.name ?? 'Unknown',
        avatar_url: logon.user_accounts?.avatar_url,
        isPrimary: logon.user_accounts?.is_primary ?? false,
        logged_in_at: logon.logged_in_at,
        last_active_at: logon.last_active_at,
        revoked: logon.revoked,
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
