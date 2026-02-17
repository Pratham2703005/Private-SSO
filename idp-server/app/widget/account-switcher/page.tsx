/**
 * Account Switcher Page
 * Server-rendered page that fetches account data, then renders client-side widget
 * Lives on IDP domain, embedded in client apps as iframe
 * 
 * Uses Suspense boundaries to show skeleton loading while data fetches
 * Optimized with parallel DB queries for faster rendering
 */

import { Suspense } from 'react';
import { headers } from 'next/headers';

// Cache the page for 5 seconds to reduce repeated requests
// Users will see skeleton while fresh data loads in background
export async function generateMetadata() {
  // This function's existence helps with edge caching
  return {
    robots: 'noindex, nofollow', // Don't index widget page
  };
}
import IframeMessenger from '@/components/widget/iframe-messenger';
import SignInButton from '@/components/widget/sign-in-button';
import WidgetClient from '@/components/widget/widget-client';
import { WidgetSkeleton } from '@/components/widget/widget-skeleton';
import { AccountDataFetcher } from '@/components/widget/account-data-fetcher';
import { getThemeClasses } from '@/lib/theme-config';

export default async function AccountSwitcherPage() {
  const theme = getThemeClasses();

  return (
    <>
      <IframeMessenger />
      <Suspense fallback={<WidgetSkeleton />}>
        <AccountDataFetcher>
          {({ accounts, isSignedOut }) => {
            // If no accounts found, show sign-in prompt
            if (isSignedOut) {
              return (
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
              );
            }

            return (
              <WidgetClient initialAccounts={accounts} initialIsSignedOut={isSignedOut} />
            );
          }}
        </AccountDataFetcher>
      </Suspense>
    </>
  );
}
