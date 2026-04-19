/**
 * Shared type definitions for the widget runtime.
 */

export type WidgetMode = 'integrated' | 'floating';

export type AccountPreview = {
  name: string;
  email: string;
  avatarUrl: string | null;
};

export type AccountState = {
  hasActiveSession: boolean;
  hasRememberedAccounts: boolean;
  activeAccountPreview: AccountPreview | null;
  dataLoaded: boolean;
};

export type SignInConfig = {
  text: string;
  style: string;
};

export type AvatarColorMap = Record<string, string>;

export type ButtonPosition = {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
};

export type ConfigureOptions = {
  buttonText?: string;
  buttonPosition?: ButtonPosition;
  buttonStyle?: Partial<CSSStyleDeclaration>;
};

export type AccountSwitcherApi = {
  open: () => void;
  close: () => void;
  configure: (config: ConfigureOptions) => void;
};

// Response shapes from the APIs the widget talks to.
export type MeResponse = {
  authenticated?: boolean;
  sessionId?: string;
  user?: { name?: string; email?: string; profile_image_url?: string | null };
  account?: { name?: string; email?: string };
};

export type RememberedAccount = {
  name?: string;
  email?: string;
  profile_image_url?: string | null;
};

export type AccountsResponse = {
  accounts?: RememberedAccount[];
};

// Discriminated union of inbound postMessage payloads handled by this widget.
// Stage 7 will replace this with the shared type from `pratham-sso`.
export type IncomingMessage =
  | { type: 'closeAccountSwitcher' }
  | { type: 'ACCOUNT_SWITCHED'; jarIndex?: number }
  | { type: 'logoutApp'; logoutUrl: string }
  | { type: 'logoutGlobal' }
  | { type: 'sessionUpdate' }
  | {
      type: 'accountStateChanged';
      hasActiveSession?: boolean;
      hasRememberedAccounts?: boolean;
      activeAccountPreview?: AccountPreview | null;
      dataLoaded?: boolean;
    }
  | { type: 'iframeReady' }
  | { type: 'contentHeightChanged'; height: number };

declare global {
  interface Window {
    __accountSwitcherLoaded?: boolean;
    __CLIENT_ID?: string;
    CLIENT_ID?: string;
    __accountSwitcher?: AccountSwitcherApi;
  }
}
