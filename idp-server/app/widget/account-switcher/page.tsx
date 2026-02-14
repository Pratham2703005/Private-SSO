/**
 * Account Switcher Page
 * Server-rendered iframe content for the account switcher widget
 * Lives on IDP domain, embedded in client apps
 */

import { cookies } from 'next/headers';
import { getAllAccountsWithIndices } from '@/lib/account-indexing';
import ActiveAccountCard from '@/components/widget/active-account-card';
import AccountsList from '@/components/widget/accounts-list';
import ActionsSection from '@/components/widget/actions-section';
import IframeMessenger from '@/components/widget/iframe-messenger';
import SignInButton from '@/components/widget/sign-in-button';
import { getThemeClasses } from '@/lib/theme-config';

export default async function AccountSwitcherPage() {
  const theme = getThemeClasses();
  const idpOrigin = process.env.NEXT_PUBLIC_IDP_URL || 'http://localhost:3000';
  
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

    // Active account is the first in the list (index 0)
    const activeAccount = accounts[0];
    const otherAccounts = accounts.slice(1);

    return (
      <>
        <IframeMessenger />
        <div className={`w-full max-w-md ${theme.colors.cardBackground} ${theme.styles.cardBorderRadius} ${theme.styles.cardShadow} overflow-hidden`}>
          <ActiveAccountCard account={activeAccount} />
          {otherAccounts.length > 0 && (
            <AccountsList accounts={otherAccounts} activeIndex={activeAccount.index} />
          )}
          <ActionsSection />
        </div>
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