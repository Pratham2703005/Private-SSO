'use client';

import { useState } from 'react';
import Image from 'next/image';
import { IndexedAccount } from '@/lib/account-indexing';
import { getThemeClasses } from '@/lib/theme-config';

interface WidgetClientState {
  accounts: IndexedAccount[];
  isSignedOut: boolean;
  error?: string;
}

interface WidgetClientProps {
  initialAccounts: IndexedAccount[];
  initialError?: string;
  initialIsSignedOut?: boolean;
}

function initializeWidgetState(
  initialAccounts: IndexedAccount[],
  initialError?: string,
  initialIsSignedOut?: boolean
): WidgetClientState {
  // Simple initialization: always use server data
  return {
    accounts: initialAccounts,
    isSignedOut: initialIsSignedOut ?? false,
    error: initialError,
  };
}

export default function WidgetClient({ initialAccounts, initialError, initialIsSignedOut }: WidgetClientProps) {
  const theme = getThemeClasses();
  const [state, setState] = useState<WidgetClientState>(() =>
    initializeWidgetState(initialAccounts, initialError, initialIsSignedOut)
  );

  // Handle global logout
  const handleLogoutGlobal = async (): Promise<void> => {
    try {
      const response = await fetch('/api/widget/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'global' }),
        credentials: 'include',
      });

      if (!response.ok) {
        console.error('[WidgetClient] Failed to logout globally:', response.status);
        setState(prev => ({ 
          ...prev, 
          error: 'Failed to sign out',
        }));
        return;
      }

      // Save all current account IDs as signed out (for persistence across reload)
      if (state.accounts && state.accounts.length > 0) {
        const signedOutIds = new Set(state.accounts.map(acc => acc.id));
        console.log('[WidgetClient] Marked accounts as signed out:', Array.from(signedOutIds));
      }

      // Mark as signed out immediately without waiting
      // Accounts data is preserved in state
      setState(prev => ({
        ...prev,
        isSignedOut: true,
        error: undefined,
      }));

      // Notify parent app of global logout so it can clear its refresh token
      if (typeof window !== 'undefined' && window.parent) {
        console.log('[WidgetClient] Notifying parent of global logout');
        window.parent.postMessage(
          { type: 'globalLogout' },
          '*'
        );
      }

      console.log('[WidgetClient] Global logout successful, accounts marked as signed out');
    } catch (error) {
      console.error('[WidgetClient] Error logging out globally:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Error signing out',
      }));
    }
  };

  // Handle add account
  const handleAddAccount = (): void => {
    // Send message to parent frame (client app) to initiate OAuth flow
    // Parent will call /api/auth/start and redirect
    if (typeof window !== 'undefined' && window.parent) {
      console.log('[WidgetClient] Sending startAuth message to parent');
      window.parent.postMessage(
        { type: 'startAuth' },
        '*'
      );
    }
  };

  // Handle clicking a signed-out account
  const handleSignedOutAccountClick = (account?: IndexedAccount): void => {
    // Send message to parent frame (client app) to initiate OAuth flow
    // Parent will call /api/auth/start and redirect
    if (typeof window !== 'undefined' && window.parent) {
      console.log('[WidgetClient] Sending startAuth message to parent', account?.email);
      window.parent.postMessage(
        { type: 'startAuth', email: account?.email },
        '*'
      );
    }
  };

  // Handle account switch when not signed out
  const handleAccountSwitch = async (account: IndexedAccount): Promise<void> => {
    try {
      const response = await fetch('/api/widget/switch-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: account.index }),
        credentials: 'include',
      });

      if (!response.ok) {
        console.error('[WidgetClient] Failed to switch account:', response.status);
        return;
      }

      // Notify parent about account switch
      if (window.parent) {
        window.parent.postMessage(
          { type: 'accountSwitched', accountIndex: account.index, accountId: account.id },
          '*'
        );
      }
    } catch (error) {
      console.error('[WidgetClient] Error switching account:', error);
    }
  };

  // Show "No active session" only if we have literally no accounts at all
  if (!state.accounts || state.accounts.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full text-gray-600`}>
        No active session
      </div>
    );
  }

  // Always show accounts (either active or with "Signed out" badges)
  const displayAccounts = state.accounts;
  const activeAccount = displayAccounts[0];
  const otherAccounts = displayAccounts.slice(1);

  return (
    <div className={`w-full max-w-md ${theme.colors.cardBackground} ${theme.styles.cardBorderRadius} ${theme.styles.cardShadow} overflow-hidden`}>
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

        {/* Status Badge */}
        {state.isSignedOut && (
          <div className="mb-3 px-3 py-1 bg-yellow-100 border border-yellow-300 rounded-full">
            <span className="text-xs font-medium text-yellow-800">Signed out</span>
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

        {/* Button */}
        {state.isSignedOut ? (
          <button
            onClick={() => handleSignedOutAccountClick(activeAccount)}
            className={`px-6 py-2.5 ${theme.colors.primaryButtonBg} ${theme.colors.primaryButtonBgHover} ${theme.colors.primaryButtonText} text-sm font-medium ${theme.styles.buttonBorderRadius} transition-colors duration-200`}
            type="button"
          >
            Sign in with this account
          </button>
        ) : (
          <button
            onClick={() => {
              const url = `/u/${activeAccount.index}`;
              if (typeof window !== 'undefined' && window.top) {
                window.top.location.href = url;
              }
            }}
            className={`px-6 py-2.5 ${theme.colors.primaryButtonBg} ${theme.colors.primaryButtonBgHover} ${theme.colors.primaryButtonText} text-sm font-medium ${theme.styles.buttonBorderRadius} transition-colors duration-200`}
            type="button"
          >
            Manage your Account
          </button>
        )}
      </div>

      {/* Other Accounts */}
      {otherAccounts.length > 0 && !state.isSignedOut && (
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
                onClick={() => handleAccountSwitch(account)}
                className={`w-full px-6 py-3.5 flex items-center gap-3 ${theme.colors.hoverBackground} transition-colors duration-150 text-left border-t ${theme.colors.dividerBorder}`}
                type="button"
              >
                {/* Avatar */}
                <div className="relative w-10 h-10 shrink-0">
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
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Other Accounts (Signed Out) */}
      {otherAccounts.length > 0 && state.isSignedOut && (
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
                onClick={() => handleSignedOutAccountClick(account)}
                className={`w-full px-6 py-3.5 flex items-center gap-3 ${theme.colors.hoverBackground} transition-colors duration-150 text-left border-t ${theme.colors.dividerBorder}`}
                type="button"
              >
                {/* Avatar */}
                <div className="relative w-10 h-10 shrink-0 opacity-60">
                  {account.avatar_url ? (
                    <Image
                      src={account.avatar_url}
                      alt={account.name}
                      fill
                      className={`${theme.styles.avatarBorderRadius} object-cover`}
                    />
                  ) : (
                    <div className={`w-10 h-10 ${theme.styles.avatarBorderRadius} bg-linear-to-br ${theme.colors.avatarGradientFrom} ${theme.colors.avatarGradientTo} flex items-center justify-center text-white text-sm font-semibold`}>
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

                {/* Signed Out Badge */}
                <div className="shrink-0 px-2 py-1 bg-yellow-100 border border-yellow-300 rounded-full">
                  <span className="text-xs font-medium text-yellow-800">Signed out</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-6 py-6 space-y-1">
        {/* Add Account Button */}
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
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          <span className={`text-sm ${theme.colors.bodyText}`}>
            Add another account
          </span>
        </button>

        {/* Global Logout Button */}
        {!state.isSignedOut && (
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
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
