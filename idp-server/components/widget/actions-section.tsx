'use client';

import { getThemeClasses } from '@/lib/theme-config';

export default function ActionsSection() {
  const theme = getThemeClasses();
  
  const handleAddAccount = (): void => {
    const referrer = typeof document !== 'undefined' ? document.referrer : window.location.origin;
    if (typeof window !== 'undefined' && window.top) {
      window.top.location.href = `/login?return_to=${encodeURIComponent(referrer)}`;
    }
  };

  const handleLogoutGlobal = async (): Promise<void> => {
    try {
      const response = await fetch('/api/widget/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'global' }),
        credentials: 'include',
      });

      if (!response.ok) {
        console.error('[ActionsSection] Failed to logout globally:', response.status);
        return;
      }

      // Notify parent (client domain) about global logout
      if (window.parent) {
        window.parent.postMessage(
          { type: 'logoutGlobal' },
          '*'
        );
      }
    } catch (error) {
      console.error('[ActionsSection] Error logging out globally:', error);
    }
  };

  return (
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
    </div>
  );
}