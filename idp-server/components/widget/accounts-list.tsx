'use client';

import { useState } from 'react';
import Image from 'next/image';
import { IndexedAccount } from '@/lib/account-indexing';
import { getThemeClasses } from '@/lib/theme-config';

interface AccountsListProps {
  accounts: IndexedAccount[];
  activeIndex: number;
}

export default function AccountsList({ accounts, activeIndex }: AccountsListProps) {
  const theme = getThemeClasses();
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter out active account - show only other accounts
  const otherAccounts = accounts.filter((account) => account.index !== activeIndex);

  const handleAccountClick = async (account: IndexedAccount): Promise<void> => {
    try {
      const response = await fetch('/api/widget/switch-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: account.index }),
        credentials: 'include',
      });

      if (!response.ok) {
        console.error('[AccountsList] Failed to switch account:', response.status);
        return;
      }

      // Notify parent (caller iframe) about account switch
      if (window.parent) {
        window.parent.postMessage(
          { type: 'accountSwitched', accountIndex: account.index, accountId: account.id },
          '*'
        );
      }
    } catch (error) {
      console.error('[AccountsList] Error switching account:', error);
    }
  };

  if (!otherAccounts || otherAccounts.length === 0) {
    return null;
  }

  return (
    <div className={`border-b ${theme.colors.dividerBorder}`}>
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full px-6 py-3 flex items-center justify-between ${theme.colors.collapsibleHover} transition-colors duration-150`}
        type="button"
        aria-expanded={isExpanded}
        aria-label={isExpanded ? 'Hide more accounts' : 'Show more accounts'}
      >
        <span className={`text-sm ${theme.colors.bodyText}`}>
          {isExpanded ? 'Hide more accounts' : 'More accounts'}
        </span>
        <svg
          className={`w-5 h-5 ${theme.colors.bodyText} transition-transform duration-200 ${
            isExpanded ? '' : 'rotate-180'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 15l7-7 7 7"
          />
        </svg>
      </button>

      {/* Accounts List */}
      {isExpanded && (
        <div>
          {otherAccounts.map((account) => (
            <button
              key={account.id}
              onClick={() => handleAccountClick(account)}
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
                  <div className={`w-10 h-10 ${theme.styles.avatarBorderRadius} bg-gradient-to-br ${theme.colors.avatarGradientFrom} ${theme.colors.avatarGradientTo} flex items-center justify-center text-white text-sm font-semibold`}>
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
      )}
    </div>
  );
}