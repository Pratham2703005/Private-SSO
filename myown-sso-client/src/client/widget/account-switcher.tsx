'use client';

import React, { useState } from 'react';
import { useSSO } from '../hooks/useSSO';

/**
 * AccountSwitcher - UI for switching between user accounts
 * 
 * Displays dropdown of all available accounts with ability to switch
 * Currently active account is highlighted
 */
export function AccountSwitcher() {
  const { session, loading, switchAccount } = useSSO();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  if (loading || !session) {
    return null;
  }

  const accounts = session.accounts || [];
  if (accounts.length <= 1) {
    return null; // Don't show if only 1 account
  }

  const handleSwitch = async (accountId: string) => {
    if (accountId === session.activeAccountId) {
      setIsOpen(false);
      return;
    }

    setIsSwitching(true);
    try {
      await switchAccount(accountId);
      setIsOpen(false);
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-2 rounded hover:bg-gray-100"
        disabled={isSwitching}
      >
        {session.account.name}
        <span className="ml-1">▼</span>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 bg-white border rounded shadow-lg z-50">
          {accounts.map(account => (
            <button
              key={account.id}
              onClick={() => handleSwitch(account.id)}
              disabled={isSwitching}
              className={`
                block w-full text-left px-4 py-2 hover:bg-gray-50
                ${account.id === session.activeAccountId ? 'bg-blue-50 font-semibold' : ''}
              `}
            >
              <div>{account.name}</div>
              <div className="text-xs text-gray-500">{account.email}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
