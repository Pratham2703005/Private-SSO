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
  let isSignedOut = false; // Track if user is signed out (loading from jar, not active session)
  
  try {
    const cookieStore = await cookies();
    // Get master cookie (session ID is stored here)
    const sessionId = cookieStore.get('__sso_session')?.value;
    console.log('[AccountSwitcher] sessionId from __sso_session:', sessionId ? 'present' : 'missing');

    // FLOW 1: Active session exists
    if (sessionId) {
      console.log('[AccountSwitcher] Active session found, fetching accounts');
      const sessionAccounts = await getAllAccountsWithIndices(sessionId);
      console.log('[AccountSwitcher] Session accounts:', sessionAccounts?.length);
      if (sessionAccounts && sessionAccounts.length > 0) {
        accounts = sessionAccounts;
        isSignedOut = false; // User has active session
      }
    }

    // FLOW 2: No active session - try remembered accounts from idp_jar
    if (accounts.length === 0) {
      isSignedOut = true; // No active session, accounts are from jar (signed out state)
      console.log('[AccountSwitcher] No active session, checking idp_jar');
      const jarCookie = cookieStore.get('idp_jar')?.value;
      console.log('[AccountSwitcher] idp_jar cookie:', jarCookie ? `"${jarCookie}"` : 'missing');
      
      if (jarCookie) {
        const accountIds = jarCookie.split(',').filter(Boolean);
        console.log('[AccountSwitcher] Split accountIds:', accountIds);
        console.log('[AccountSwitcher] Found', accountIds.length, 'remembered account IDs');
        
        if (accountIds.length > 0) {
          // Fetch account details from DB
          console.log('[AccountSwitcher] Querying DB for account IDs:', accountIds);
          try {
            const response = await supabase
              .from('user_accounts')
              .select('id, name, email')
              .in('id', accountIds);
            
            const accountsData = response.data;
            const dbError = response.error;
            
            console.log('[AccountSwitcher] DB query response status:', response.status || 'unknown');
            console.log('[AccountSwitcher] DB query data count:', accountsData?.length || 0);
            
            if (dbError) {
              console.error('[AccountSwitcher] DB query error details:', {
                message: dbError.message || 'no message',
                code: dbError.code || 'no code',
                details: dbError.details || 'no details',
                hint: dbError.hint || 'no hint',
                fullError: JSON.stringify(dbError)
              });
            }

            if (accountsData && accountsData.length > 0) {
              console.log('[AccountSwitcher] Found', accountsData.length, 'accounts in DB');
              accounts = accountIds
                .map((id, index) => {
                  const account = accountsData.find((acc) => acc.id === id);
                  console.log(`[AccountSwitcher] Account ${id}:`, account ? 'found' : 'NOT FOUND');
                  return account ? {
                    id: account.id,
                    name: account.name,
                    email: account.email,
                    index,
                    isPrimary: false,
                    logged_in_at: new Date().toISOString(),
                    last_active_at: new Date().toISOString(),
                    revoked: false,
                  } : null;
                })
                .filter(Boolean) as IndexedAccount[];
              
              console.log('[AccountSwitcher] Mapped to', accounts.length, 'IndexedAccounts');
            } else {
              console.log('[AccountSwitcher] No accounts found in DB for IDs:', accountIds);
            }
          } catch (queryError) {
            console.error('[AccountSwitcher] Exception during DB query:', queryError);
          }
        }
      } else {
        console.log('[AccountSwitcher] idp_jar cookie is missing - no remembered accounts');
      }
    }

    console.log('[AccountSwitcher] Final accounts count:', accounts.length);

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
