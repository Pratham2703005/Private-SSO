/**
 * Widget postMessage protocol types
 * Defines messages between app and widget iframe
 */

export type WidgetMessageType =
  | 'sessionUpdate'
  | 'logout'
  | 'globalLogout'
  | 'accountSwitch'
  | 'getAccounts'
  | 'accountsResponse'
  | 'error';

export interface WidgetMessage<T = any> {
  type: WidgetMessageType;
  data?: T;
  timestamp?: number;
}

export interface AccountSwitchMessage {
  accountId: string;
}

export interface AccountsResponseMessage {
  accounts: Array<{
    id: string;
    name: string;
    email: string;
    isPrimary?: boolean;
  }>;
  activeAccountId: string;
}

export interface WidgetConfig {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  theme?: 'light' | 'dark' | 'auto';
  compact?: boolean;
}
