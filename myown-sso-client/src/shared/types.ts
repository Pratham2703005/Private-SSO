/**
 * Shared TypeScript types for myown-sso-client
 * Used by both client and server
 */

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Account {
  id: string;
  name: string;
  email: string;
  isPrimary?: boolean;
}

export interface SessionData {
  user: User;
  account: Account;
  accounts: Account[];
  activeAccountId: string;
  issuedAt: number;
}

export interface SSOProviderConfig {
  idpServer: string;
  clientId?: string;
  redirectUri?: string;
  scope?: string;
  enableWidget?: boolean;
  onSessionUpdate?: (session: SessionData | null) => void;
  onError?: (error: Error) => void;
}

export interface StartAuthConfig {
  clientId: string;
  idpServer: string;
  redirectUri: string;
  oauthSecret: string;
}

export interface HandleCallbackConfig {
  clientId: string;
  idpServer: string;
  redirectUri: string;
  oauthSecret: string;
}

export interface ValidateSessionConfig {
  clientId: string;
  idpServer: string;
  oauthSecret?: string;
}

export interface ValidateSessionResponse {
  authenticated: boolean;
  user?: User;
  account?: Account;
  accounts?: Account[];
  activeAccountId?: string;
  error?: string;
}

export interface AuthStartResponse {
  url: string;
}

export interface TokenResponse {
  session_id: string;
  session_state?: "active" | "inactive";
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
}

export type EventType = 
  | 'logout' 
  | 'sessionRefresh' 
  | 'accountSwitch' 
  | 'globalLogout' 
  | 'error';

export type EventCallback<T = any> = (data?: T) => void;

export interface SSOContextValue {
  session: SessionData | null;
  loading: boolean;
  error: Error | null;
  signIn: (email?: string, prompt?: string) => Promise<void>;
  logout: () => void;
  globalLogout: () => void;
  refresh: () => Promise<SessionData | null>;
  switchAccount: (accountId: string) => Promise<void>;
  on: (event: EventType, callback: EventCallback) => () => void;
}

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  maxAge?: number;
  path?: string;
}
