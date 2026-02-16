/**
 * Account Switcher Page
 * Server-rendered page that fetches account data, then renders client-side widget
 * Lives on IDP domain, embedded in client apps as iframe
 * 
 * Supports two flows:
 * 1. Active session: shows all accounts in session
 * 2. No session: shows remembered accounts from idp_jar (Google-style "Signed out" state)
 */

import { cookies } from 'next/headers';
import { getAllAccountsWithIndices } from '@/lib/account-indexing';
import { supabase } from '@/lib/db';
import IframeMessenger from '@/components/widget/iframe-messenger';
import SignInButton from '@/components/widget/sign-in-button';
import WidgetClient from '@/components/widget/widget-client';
import { getThemeClasses } from '@/lib/theme-config';
import type { IndexedAccount } from '@/lib/account-indexing';

export default async function AccountSwitcherPage() {
  const theme = getThemeClasses();
  let accounts: IndexedAccount[] = [];
  let isSignedOut = false; // Track if user is signed out (no active session at all)
  
  try {
    const cookieStore = await cookies();
    // Get master cookie (session ID is stored here)
    const sessionId = cookieStore.get('__sso_session')?.value;
    console.log('[AccountSwitcher] sessionId from __sso_session:', sessionId ? 'present' : 'missing');

    let activeAccountId: string | null = null;

    // Use Map to prevent duplicate accounts and maintain order
    const accountsMap = new Map<string, IndexedAccount>();

    // FLOW 1: Active session exists - get active accounts from session_logons
    if (sessionId) {
      console.log('[AccountSwitcher] Active session found, fetching accounts');
      
      // Get the active account ID from the sessions table
      try {
        const sessionResponse = await supabase
          .from('sessions')
          .select('active_account_id')
          .eq('id', sessionId)
          .single();
        
        if (sessionResponse.data) {
          activeAccountId = sessionResponse.data.active_account_id;
          console.log('[AccountSwitcher] Active account ID:', activeAccountId);
        }
      } catch (error) {
        console.error('[AccountSwitcher] Failed to get active account ID:', error);
      }
      
      const sessionAccounts = await getAllAccountsWithIndices(sessionId);
      console.log('[AccountSwitcher] Session accounts:', sessionAccounts?.length);
      
      if (sessionAccounts && sessionAccounts.length > 0) {
        // Mark each session account based on whether it's the active one
        sessionAccounts.forEach(acc => {
          const state = acc.id === activeAccountId ? 'active' : 'can_switch';
          accountsMap.set(acc.id, {
            ...acc,
            accountState: state as 'active' | 'can_switch' | 'needs_reauth'
          });
        });
      }
    }

    // FLOW 2: Check idp_jar for remembered accounts NOT already in session
    const jarCookie = cookieStore.get('idp_jar')?.value;
    console.log('[AccountSwitcher] idp_jar cookie:', jarCookie ? `"${jarCookie}"` : 'missing');
    
    if (jarCookie) {
      const jarAccountIds = jarCookie.split(',').filter(Boolean);
      console.log('[AccountSwitcher] Found', jarAccountIds.length, 'remembered account IDs');
      
      if (jarAccountIds.length > 0) {
        // Only process jar accounts that are NOT already in the session map
        const jarAccountsToCheck = jarAccountIds.filter(id => !accountsMap.has(id));
        console.log('[AccountSwitcher] Jar accounts to check (not in session):', jarAccountsToCheck.length);
        
        if (jarAccountsToCheck.length > 0) {
          try {
            // Fetch account details from DB
            const response = await supabase
              .from('user_accounts')
              .select('id, name, email')
              .in('id', jarAccountsToCheck);
            
            const accountsData = response.data || [];
            console.log('[AccountSwitcher] DB found', accountsData.length, 'jar accounts');
            
            // For jar accounts, check if they have valid session in CURRENT sessionId only
            for (const account of accountsData) {
              let state: 'active' | 'can_switch' | 'needs_reauth' = 'needs_reauth';
              
              try {
                // Only mark can_switch if account has valid logon in CURRENT sessionId
                if (sessionId) {
                  const logonCheck = await supabase
                    .from('session_logons')
                    .select('id')
                    .eq('session_id', sessionId)
                    .eq('account_id', account.id)
                    .not('revoked', 'is', true)
                    .single();
                  
                  if (logonCheck.data) {
                    // Check if CURRENT session is not expired
                    const sessionCheck = await supabase
                      .from('sessions')
                      .select('expires_at')
                      .eq('id', sessionId)
                      .single();
                    
                    if (sessionCheck.data?.expires_at && new Date(sessionCheck.data.expires_at) > new Date()) {
                      console.log(`[AccountSwitcher] Account ${account.id}: can_switch (valid logon in current session)`);
                      state = 'can_switch';
                    }
                  }
                }
              } catch (error) {
                console.log(`[AccountSwitcher] Account ${account.id}: needs_reauth (not in current session)`);
                state = 'needs_reauth';
              }
              
              // Add to map (only if not already present from session)
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
                  accountState: state
                });
              }
            }
          } catch (error) {
            console.error('[AccountSwitcher] Error processing jar accounts:', error);
          }
        }
      }
    }

    // Compute stable jarIndex from idp_jar cookie order
    const jarCookieValue = cookieStore.get('idp_jar')?.value;
    const jarAccountIds = jarCookieValue ? jarCookieValue.split(',').filter(Boolean) : [];

    // Convert Map to array, updating indices and adding stable jarIndex
    accounts = Array.from(accountsMap.values()).map((acc, idx) => {
      const jarPos = jarAccountIds.indexOf(acc.id);
      return {
        ...acc,
        index: idx,
        jarIndex: jarPos >= 0 ? jarPos : undefined,
      };
    });

    // Set isSignedOut only if NO accounts at all
    isSignedOut = accounts.length === 0;
    console.log('[AccountSwitcher] Final: ' + accounts.length + ' accounts, isSignedOut=' + isSignedOut);

    // If no accounts found, show sign-in prompt
    if (accounts.length === 0) {
      return (
        <>
          <IframeMessenger />
          <div className={`w-full ${theme.colors.cardBackground} overflow-hidden`}>
            <div className="px-6 py-8 text-center flex flex-col items-center gap-4">
              <div className="text-4xl">🔐</div>
              <p className={`text-sm ${theme.colors.bodyText}`}>No accounts found</p>
              <SignInButton
                buttonBg={theme.colors.primaryButtonBg}
                buttonText={theme.colors.primaryButtonText}
              />
            </div>
          </div>
        </>
      );
    }

    console.log('[AccountSwitcher] Rendering widget with', accounts.length, 'accounts, isSignedOut:', isSignedOut);

    return (
      <>
        <IframeMessenger />
        <WidgetClient initialAccounts={accounts} initialIsSignedOut={isSignedOut} />
      </>
    );
  } catch (error) {
    console.error('[AccountSwitcher] Error rendering page:', error);
    return (
      <>
        <IframeMessenger />
        <div className={`w-full ${theme.colors.cardBackground} overflow-hidden`}>
          <div className="px-6 py-8 text-center flex flex-col items-center gap-4">
            <div className="text-4xl">⚠️</div>
            <p className="text-sm text-red-600">Error loading accounts</p>
            <SignInButton
              buttonBg={theme.colors.primaryButtonBg}
              buttonText={theme.colors.primaryButtonText}
            />
          </div>
        </div>
      </>
    );
  }
}
