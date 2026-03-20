/**
 * myown-sso-client
 * Production-ready SSO SDK with Clerk/Auth0 level DX
 * 
 * Usage:
 * 
 * // In app/layout.tsx
 * import { SSOProvider } from 'myown-sso-client';
 * 
 * <SSOProvider
 *   idpServer="https://idp.yourdomain.com"
 *   clientId="your-client-id"
 *   redirectUri="/api/auth/callback"
 *   enableWidget
 * >
 *   {children}
 * </SSOProvider>
 * 
 * // In components
 * import { useSSO, useSession } from 'myown-sso-client';
 * 
 * const { session, loading, signIn } = useSSO();
 * const { session } = useSession(); // Lightweight version
 */

// Client exports
export { SSOProvider } from './client/provider/SSOProvider';
export type { SSOContext } from './client/provider/context';
export { useSSO } from './client/hooks/useSSO';
export { useSession } from './client/hooks/useSession';
export { AccountSwitcher } from './client/widget/account-switcher';
export { IframeMessenger } from './client/widget/iframe-messenger';

// Server exports
export { startAuth } from './server/start-auth';
export { handleCallback } from './server/callback';
export { validateSession } from './server/validate-session';
export { handleLogout } from './server/handle-logout';

// Shared exports
export type {
  SessionData,
  User,
  Account,
  SSOProviderConfig,
  StartAuthConfig,
  HandleCallbackConfig,
  ValidateSessionConfig,
  HandleLogoutConfig,
  EventType,
  EventCallback,
  WidgetMessage,
  WidgetConfig,
} from './shared';
export {
  DEFAULT_CONFIG,
  COOKIE_DEFAULTS,
  API_PATHS,
} from './shared';
