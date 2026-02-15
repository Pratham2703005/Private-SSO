/**
 * Account Switcher Page
 * Server-rendered page that fetches account data, then renders client-side widget
 * Lives on IDP domain, embedded in client apps as iframe
 */

import { cookies } from 'next/headers';
import { getAllAccountsWithIndices } from '@/lib/account-indexing';
import IframeMessenger from '@/components/widget/iframe-messenger';
import SignInButton from '@/components/widget/sign-in-button';
import WidgetClient from '@/components/widget/widget-client';
import { getThemeClasses } from '@/lib/theme-config';

export default async function AccountSwitcherPage() {
  const theme = getThemeClasses();
  
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('__sso_session')?.value;

    if (!sessionId) {
      return (
        <>
          <IframeMessenger />
          <div className={`w-full ${theme.colors.cardBackground} overflow-hidden`}>
            <div className="px-6 py-8 text-center flex flex-col items-center gap-4">
              <div className="text-4xl">🔐</div>
              <p className={`text-sm ${theme.colors.bodyText}`}>No active session</p>
              <SignInButton
                buttonBg={theme.colors.primaryButtonBg}
                buttonText={theme.colors.primaryButtonText}
              />
            </div>
          </div>
        </>
      );
    }

    // Fetch all accounts with indices
    const accounts = await getAllAccountsWithIndices(sessionId);

    if (!accounts || accounts.length === 0) {
      return (
        <>
          <IframeMessenger />
          <div className={`w-full ${theme.colors.cardBackground} overflow-hidden`}>
            <div className="px-6 py-8 text-center flex flex-col items-center gap-4">
              <div className="text-4xl">📭</div>
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

    return (
      <>
        <IframeMessenger />
        <WidgetClient initialAccounts={accounts} />
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