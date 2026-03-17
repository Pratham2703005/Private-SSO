'use client';

import { useContext } from 'react';
import { SSOContext } from '../provider/context';

/**
 * useSSO - Full SSO access hook
 * 
 * Use when you need:
 * - Current session
 * - Auth methods (signIn, logout, refresh, switchAccount)
 * - Event subscriptions
 * 
 * Throws if used outside SSOProvider (use in protected route)
 * 
 * Example:
 * ```tsx
 * function LoginButton() {
 *   const { session, loading, signIn } = useSSO();
 *   
 *   if (loading) return <div>Loading...</div>;
 *   
 *   if (!session) {
 *     return <button onClick={() => signIn()}>Sign In</button>;
 *   }
 *   
 *   return <div>Welcome, {session.user.email}</div>;
 * }
 * ```
 */
export function useSSO() {
  const context = useContext(SSOContext);

  if (!context) {
    throw new Error(
      'useSSO must be used within a SSOProvider. ' +
      'Wrap your app with <SSOProvider> in a parent component.'
    );
  }

  return context;
}
