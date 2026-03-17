'use client';

import { useContext } from 'react';
import { SSOContext } from '../provider/context';

/**
 * useSession - Lightweight session-only hook
 * 
 * Use when you only need:
 * - Current session
 * - Loading state
 * - Error state
 * 
 * Doesn't expose auth methods (prevents unnecessary component rerenders)
 * Useful for: Navbar, profile avatars, role-based UI
 * 
 * Example:
 * ```tsx
 * function Navbar() {
 *   const { session, loading } = useSession();
 *   
 *   if (loading) return <div>...</div>;
 *   if (!session) return <LoginLink />;
 *   
 *   return (
 *     <nav>
 *       <Avatar user={session.user} />
 *       <AccountMenu accounts={session.accounts} />
 *     </nav>
 *   );
 * }
 * ```
 */
export function useSession() {
  const context = useContext(SSOContext);

  if (!context) {
    throw new Error(
      'useSession must be used within a SSOProvider. ' +
      'Wrap your app with <SSOProvider> in a parent component.'
    );
  }

  return {
    session: context.session,
    loading: context.loading,
    error: context.error,
  };
}
