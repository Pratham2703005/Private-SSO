'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { IndexedAccount } from '@/lib/account-indexing';
import { getThemeClasses } from '@/lib/theme-config';

interface WidgetClientState {
  accounts: IndexedAccount[];
  error?: string;
  switching: boolean;
}

interface WidgetClientProps {
  initialAccounts: IndexedAccount[];
  initialError?: string;
  initialIsSignedOut?: boolean;
}

export default function WidgetClient({ initialAccounts, initialError }: WidgetClientProps) {
  const theme = getThemeClasses();
  const parentOriginRef = useRef<string | null>(null);
  
  const [state, setState] = useState<WidgetClientState>({
    accounts: initialAccounts,
    error: initialError,
    switching: false,
  });
  
  // Get parentOrigin from URL params on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = new URLSearchParams(window.location.search).get('parentOrigin');
      parentOriginRef.current = origin;
      
      // Notify parent that widget is ready
      if (origin && window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'iframeReady' }, origin);
      }
    }
  }, []);

  // Helper: refetch accounts from API
  const refetchAccounts = async (): Promise<void> => {
    try {
      const response = await fetch('/api/widget/account-switcher', {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) return;
      const data = await response.json();
      setState(prev => ({
        ...prev,
        accounts: data.accounts || [],
        error: undefined,
      }));
    } catch {
      // Silent fail
    }
  };

  // Helper: notify parent
  const notifyParent = (type: string, extra?: Record<string, unknown>): void => {
    if (parentOriginRef.current && typeof window !== 'undefined' && window.parent && window.parent !== window) {
      window.parent.postMessage({ type, ...extra }, parentOriginRef.current);
    }
  };

  // Handle sign out from CURRENT account only
  const handleLogoutCurrent = async (): Promise<void> => {
    try {
      const response = await fetch('/api/widget/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'current' }),
        credentials: 'include',
      });

      if (!response.ok && response.status !== 401) {
        console.error('[WidgetClient] Failed to logout current account:', response.status);
        setState(prev => ({ ...prev, error: 'Failed to sign out' }));
        return;
      }

      // Refetch to get updated account list
      await refetchAccounts();

      // Notify parent to refresh its session
      notifyParent('sessionUpdate');

      console.log('[WidgetClient] Current account logout successful');
    } catch (error) {
      console.error('[WidgetClient] Error logging out current account:', error);
      setState(prev => ({ ...prev, error: 'Error signing out' }));
    }
  };

  // Handle global logout (all accounts)
  const handleLogoutGlobal = async (): Promise<void> => {
    try {
      const response = await fetch('/api/widget/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'global' }),
        credentials: 'include',
      });

      if (!response.ok && response.status !== 401) {
        console.error('[WidgetClient] Failed to logout globally:', response.status);
        setState(prev => ({ ...prev, error: 'Failed to sign out' }));
        return;
      }

      // Notify parent FIRST so it clears its session
      notifyParent('globalLogout');

      // Then refetch — jar accounts will come back as needs_reauth
      await refetchAccounts();

      console.log('[WidgetClient] Global logout successful');
    } catch (error) {
      console.error('[WidgetClient] Error logging out globally:', error);
      setState(prev => ({ ...prev, error: 'Error signing out' }));
    }
  };

  // Handle add account — force create account page
  const handleAddAccount = (): void => {
    const idpOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const parentOrigin = parentOriginRef.current;
    const isOnIdp = parentOrigin === idpOrigin;

    if (isOnIdp) {
      const signupUrl = new URL('/signup', idpOrigin);
      notifyParent('navigate', { url: signupUrl.toString() });
      return;
    }

    notifyParent('startAuth', { prompt: 'signup' });
  };

  // Listen for session updates from parent app
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'sessionUpdate') {
        await refetchAccounts();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Handle clicking a needs_reauth account (re-authenticate)
  // Widget owns the reauth flow:
  // - On IDP domain: construct /login URL directly and navigate
  // - On client apps: send startAuth so client can initiate PKCE flow
  const handleReauthenticateAccountClick = (account?: IndexedAccount): void => {
    const idpOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const parentOrigin = parentOriginRef.current;
    const isOnIdp = parentOrigin === idpOrigin;

    if (isOnIdp) {
      // On IDP domain: navigate directly to login with hint + return_to
      const loginUrl = new URL('/login', idpOrigin);
      if (account?.email) {
        loginUrl.searchParams.set('login_hint', account.email);
      }
      // return_to: send user back to the account's /u/{jarIndex} page after login
      const jarIndex = account?.jarIndex ?? account?.index;
      if (jarIndex !== undefined) {
        loginUrl.searchParams.set('return_to', `/u/${jarIndex}`);
      }
      notifyParent('navigate', { url: loginUrl.toString() });
    } else {
      // On client app: delegate to client's OAuth/PKCE flow
      notifyParent('startAuth', { email: account?.email, prompt: 'login' });
    }
  };

  // Handle account switch (can_switch → active)
  const handleAccountSwitch = async (account: IndexedAccount): Promise<void> => {
    try {
      console.log('[WidgetClient] Switching to account:', account.email);
      
      // Show loading state in widget + notify parent
      setState(prev => ({ ...prev, switching: true }));
      notifyParent('ACCOUNT_SWITCHING');
      
      const response = await fetch('/api/widget/switch-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: account.index }),
        credentials: 'include',
      });

      if (!response.ok) {
        console.error('[WidgetClient] Failed to switch account:', response.status);
        setState(prev => ({ ...prev, switching: false }));
        return;
      }

      const data = await response.json();
      const jarIndex = account.jarIndex ?? account.index;

      const idpOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      const isOnIdp = parentOriginRef.current === idpOrigin;

      // On IDP: don't refetch/clear switching — page will fully navigate away via ACCOUNT_SWITCHED
      // On clients: refetch widget state and clear loading
      if (!isOnIdp) {
        await refetchAccounts();
        setState(prev => ({ ...prev, switching: false }));
      }

      // Always send ACCOUNT_SWITCHED
      // On IDP: widget.js handles redirect to /u/{jarIndex}
      // On client: widget-manager detects this and triggers OAuth re-auth
      //   (client constructs authorize URL from its own config, avoiding cross-origin access)
      notifyParent('ACCOUNT_SWITCHED', {
        activeAccountId: data.activeId,
        accountId: data.accountId, // For client to know which account was switched to
        jarIndex,
      });

      // Only send sessionUpdate on client apps — IDP page navigation already handles full refresh
      if (!isOnIdp) {
        notifyParent('sessionUpdate');
      }
    } catch (error) {
      console.error('[WidgetClient] Error switching account:', error);
      setState(prev => ({ ...prev, switching: false }));
    }
  };

  // Derive UI state from accounts
  const displayAccounts = state.accounts;
  const activeAccount = displayAccounts.length > 0 ? displayAccounts[0] : null;
  const otherAccounts = displayAccounts.slice(1);
  const hasAnyActiveSession = displayAccounts.some(a => a.accountState === 'active' || a.accountState === 'can_switch');

  // Track last sent state to avoid spamming parent with duplicate messages
  const lastSentStateRef = useRef<string>('');

  // Notify parent of account state changes (for widget button rendering)
  // Sends minimal preview data only — no full account list
  useEffect(() => {
    const hasActiveSession = !!activeAccount;
    const preview = hasActiveSession
      ? { name: activeAccount.name, email: activeAccount.email, avatarUrl: activeAccount.avatar_url || null }
      : null;

    // Shallow compare: only send if state actually changed
    const stateKey = JSON.stringify({ hasActiveSession, preview });
    if (stateKey === lastSentStateRef.current) return;
    lastSentStateRef.current = stateKey;

    notifyParent('accountStateChanged', {
      hasActiveSession,
      dataLoaded: true,
      activeAccountPreview: preview,
    });

    console.log('[WidgetClient] Sent accountStateChanged:', { hasActiveSession, preview: preview?.name || null });
  }, [activeAccount, displayAccounts]);

  // No accounts at all (no jar, no session) — just show "Add account"
  if (!activeAccount) {
    return (
      <div className={`w-full max-w-md ${theme.colors.cardBackground} ${theme.styles.cardBorderRadius} ${theme.styles.cardShadow} overflow-hidden`}>
        <div className="px-6 py-8 text-center flex flex-col items-center gap-4">
          <div className="text-4xl">🔐</div>
          <p className={`text-sm ${theme.colors.bodyText}`}>No accounts found</p>
          <button
            onClick={handleAddAccount}
            className={`px-6 py-2.5 ${theme.colors.primaryButtonBg} ${theme.colors.primaryButtonBgHover} ${theme.colors.primaryButtonText} text-sm font-medium ${theme.styles.buttonBorderRadius} transition-colors duration-200`}
            type="button"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-md ${theme.colors.cardBackground} ${theme.styles.cardBorderRadius} ${theme.styles.cardShadow} overflow-hidden relative`}>
      {/* Switching overlay */}
      {state.switching && (
        <div className="absolute inset-0 bg-white/70 z-50 flex items-center justify-center backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-500 font-medium">Switching account…</p>
          </div>
        </div>
      )}

      {/* Active Account Card */}
      <div className={`flex flex-col items-center justify-center py-8 px-6 border-b ${theme.colors.dividerBorder}`}>
        {/* Avatar */}
        <div className={`mb-4 relative w-20 h-20 ${theme.styles.avatarShadow}`}>
          {activeAccount.avatar_url ? (
            <Image
              src={activeAccount.avatar_url}
              alt={activeAccount.name}
              fill
              className={`${theme.styles.avatarBorderRadius} object-cover`}
              priority
            />
          ) : (
            <div className={`w-20 h-20 ${theme.styles.avatarBorderRadius} bg-linear-to-br ${theme.colors.avatarGradientFrom} ${theme.colors.avatarGradientTo} flex items-center justify-center text-white text-3xl font-semibold`}>
              {activeAccount.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Status Badge for needs_reauth */}
        {activeAccount.accountState === 'needs_reauth' && (
          <div className="mb-3 px-2 py-1 bg-gray-100 border border-gray-300 rounded-full">
            <span className="text-xs font-medium text-gray-600">Signed out</span>
          </div>
        )}

        {/* Greeting */}
        <h2 className={`text-xl font-normal ${theme.colors.headingText} mb-1`}>
          Hi, {activeAccount.name.split(' ')[0]}!
        </h2>

        {/* Email */}
        <p className={`text-sm ${theme.colors.mutedText} mb-6`}>
          {activeAccount.email}
        </p>

        {/* Button: Sign in (needs_reauth) or Manage Account (active) */}
        {activeAccount.accountState === 'needs_reauth' ? (
          <button
            onClick={() => handleReauthenticateAccountClick(activeAccount)}
            className={`px-6 py-2.5 ${theme.colors.primaryButtonBg} ${theme.colors.primaryButtonBgHover} ${theme.colors.primaryButtonText} text-sm font-medium ${theme.styles.buttonBorderRadius} transition-colors duration-200`}
            type="button"
          >
            Sign in with this account
          </button>
        ) : (
          <button
            onClick={() => {
              const idpOrigin = typeof window !== 'undefined' ? window.location.origin : '';
              const stableIndex = activeAccount.jarIndex ?? activeAccount.index;
              notifyParent('navigate', { url: `${idpOrigin}/u/${stableIndex}` });
            }}
            className={`px-6 py-2.5 ${theme.colors.primaryButtonBg} ${theme.colors.primaryButtonBgHover} ${theme.colors.primaryButtonText} text-sm font-medium ${theme.styles.buttonBorderRadius} transition-colors duration-200`}
            type="button"
          >
            Manage your Account
          </button>
        )}
      </div>

      {/* Other Accounts */}
      {otherAccounts.length > 0 && (
        <div className={`border-b ${theme.colors.dividerBorder}`}>
          <div className={`px-6 py-3 flex items-center justify-between ${theme.colors.collapsibleHover} bg-gray-50`}>
            <span className={`text-sm ${theme.colors.bodyText}`}>
              More accounts ({otherAccounts.length})
            </span>
          </div>
          <div>
            {otherAccounts.map((account) => (
              <button
                key={account.id}
                onClick={() => {
                  if (account.accountState === 'can_switch') {
                    handleAccountSwitch(account);
                  } else if (account.accountState === 'needs_reauth') {
                    handleReauthenticateAccountClick(account);
                  }
                }}
                className={`w-full px-6 py-3.5 flex items-center gap-3 ${theme.colors.hoverBackground} transition-colors duration-150 text-left border-t ${theme.colors.dividerBorder}`}
                type="button"
              >
                {/* Avatar */}
                <div className={`relative w-10 h-10 shrink-0 ${account.accountState === 'needs_reauth' ? 'opacity-60' : ''}`}>
                  {account.avatar_url ? (
                    <Image
                      src={account.avatar_url}
                      alt={account.name}
                      fill
                      className={`${theme.styles.avatarBorderRadius} object-cover`}
                    />
                  ) : (
                    <div className={`w-10 h-10 ${theme.styles.avatarBorderRadius} bg-linear-to-br ${theme.colors.avatarGradientFrom} ${theme.colors.avatarGradientTo} flex items-center justify-center text-white font-medium`}>
                      {account.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Account Info */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${theme.colors.headingText} truncate`}>
                    {account.name}
                  </p>
                  <p className={`text-xs ${theme.colors.mutedText} truncate`}>
                    {account.email}
                  </p>
                </div>

                {/* Status Badge - needs_reauth */}
                {account.accountState === 'needs_reauth' && (
                  <div className="shrink-0 px-2 py-1 bg-gray-100 border border-gray-300 rounded-full">
                    <span className="text-xs font-medium text-gray-600">Signed out</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-6 py-4 space-y-1">
        {/* Add another account */}
        <button
          onClick={handleAddAccount}
          className={`w-full px-4 py-3 flex items-center gap-3 ${theme.colors.hoverBackground} transition-colors duration-150 text-left rounded-lg`}
          type="button"
        >
          <svg
            className={`w-5 h-5 ${theme.colors.addAccountIcon} shrink-0`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className={`text-sm ${theme.colors.bodyText}`}>
            Add another account
          </span>
        </button>

        {/* Sign out from current account - only when active account has a live session */}
        {activeAccount.accountState === 'active' && (
          <button
            onClick={handleLogoutCurrent}
            className={`w-full px-4 py-3 flex items-center gap-3 ${theme.colors.signoutHover} transition-colors duration-150 text-left rounded-lg`}
            type="button"
          >
            <svg
              className={`w-5 h-5 ${theme.colors.signoutIcon} shrink-0`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className={`text-sm ${theme.colors.signoutText}`}>
              Sign out of this account
            </span>
          </button>
        )}

        {/* Sign out of ALL accounts - only when any session is active */}
        {hasAnyActiveSession && (
          <button
            onClick={handleLogoutGlobal}
            className={`w-full px-4 py-3 flex items-center gap-3 ${theme.colors.signoutHover} transition-colors duration-150 text-left rounded-lg`}
            type="button"
          >
            <svg
              className={`w-5 h-5 ${theme.colors.signoutIcon} shrink-0`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className={`text-sm ${theme.colors.signoutText}`}>
              Sign out of all accounts
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
