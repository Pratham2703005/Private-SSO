/**
 * Widget PostMessage Protocol Reference
 * 
 * This defines the strict message format for widget ↔ client communication
 * All messages include: type, nonce, requestId
 * Origin validation required on both sides
 */

// ============================================================================
// Message Types (Strict Enum)
// ============================================================================

export enum WidgetMessageType {
  // Widget → Client
  WIDGET_READY = "WIDGET_READY",
  ACCOUNT_SWITCHED = "ACCOUNT_SWITCHED",
  AUTH_STATE = "AUTH_STATE",
  ERROR = "ERROR",

  // Client → Widget
  REQUEST_ACCOUNTS = "REQUEST_ACCOUNTS",
  SWITCH_ACCOUNT = "SWITCH_ACCOUNT",
  LOGOUT_APP = "LOGOUT_APP",
  LOGOUT_GLOBAL = "LOGOUT_GLOBAL",
}

// ============================================================================
// Message Interfaces
// ============================================================================

export interface BaseMessage {
  type: WidgetMessageType;
  nonce: string; // Random token, echoed back to validate response
  requestId: string; // Unique ID to match request ↔ response
  payload?: Record<string, unknown>;
}

export interface WidgetReadyMessage extends BaseMessage {
  type: WidgetMessageType.WIDGET_READY;
  payload?: {
    idpUrl: string;
  };
}

export interface RequestAccountsMessage extends BaseMessage {
  type: WidgetMessageType.REQUEST_ACCOUNTS;
}

export interface SwitchAccountMessage extends BaseMessage {
  type: WidgetMessageType.SWITCH_ACCOUNT;
  payload: {
    accountId: string;
  };
}

export interface AccountSwitchedMessage extends BaseMessage {
  type: WidgetMessageType.ACCOUNT_SWITCHED;
  payload: {
    activeAccountId: string;
  };
}

export interface LogoutAppMessage extends BaseMessage {
  type: WidgetMessageType.LOGOUT_APP;
  payload: {
    clientId: string;
  };
}

export interface LogoutGlobalMessage extends BaseMessage {
  type: WidgetMessageType.LOGOUT_GLOBAL;
}

export interface AuthStateMessage extends BaseMessage {
  type: WidgetMessageType.AUTH_STATE;
  payload?: {
    accounts?: Array<{
      id: string;
      name: string;
      email: string;
      isPrimary: boolean;
    }>;
    activeAccountId?: string;
    user?: {
      id: string;
      email: string;
      name: string;
    };
    account?: {
      id: string;
      name: string;
      email: string;
    };
    loggedOut?: boolean;
    scope?: "app" | "global";
  };
}

export interface ErrorMessage extends BaseMessage {
  type: WidgetMessageType.ERROR;
  payload: {
    error: string;
    thirdPartyCookiesBlocked?: boolean;
  };
}

export type WidgetMessage =
  | WidgetReadyMessage
  | RequestAccountsMessage
  | SwitchAccountMessage
  | AccountSwitchedMessage
  | LogoutAppMessage
  | LogoutGlobalMessage
  | AuthStateMessage
  | ErrorMessage;

// ============================================================================
// Flow Examples
// ============================================================================

/*

=== INITIALIZATION ===

1. Widget → Client: WIDGET_READY
   {
     type: "WIDGET_READY",
     nonce: "abc123...",
     requestId: "req-001..."
   }

2. Client → Widget: REQUEST_ACCOUNTS
   {
     type: "REQUEST_ACCOUNTS",
     nonce: "def456...",
     requestId: "req-002..."
   }

3. Widget → Client: AUTH_STATE
   {
     type: "AUTH_STATE",
     nonce: "def456...",
     requestId: "req-002...",
     payload: {
       accounts: [
         { id: "acc-1", name: "John Doe", email: "john@example.com", isPrimary: true },
         { id: "acc-2", name: "Jane Doe", email: "jane@example.com", isPrimary: false }
       ],
       activeAccountId: "acc-1",
       user: { id: "user-123", email: "john@example.com", name: "John Doe" },
       account: { id: "acc-1", name: "John Doe", email: "john@example.com" }
     }
   }

=== ACCOUNT SWITCH ===

1. Client → Widget: SWITCH_ACCOUNT
   {
     type: "SWITCH_ACCOUNT",
     nonce: "ghi789...",
     requestId: "req-003...",
     payload: {
       accountId: "acc-2"
     }
   }

2. Widget → IDP: POST /api/auth/switch-account
   (internally, widget calls IDP, updates __sso_session)

3. Widget → Client: ACCOUNT_SWITCHED
   {
     type: "ACCOUNT_SWITCHED",
     nonce: "ghi789...",
     requestId: "req-003...",
     payload: {
       activeAccountId: "acc-2"
     }
   }

4. Client → Client Backend: GET /api/me
   (client backend calls IDP, gets new account data)

=== LOGOUT APP ===

1. Client → Widget: LOGOUT_APP
   {
     type: "LOGOUT_APP",
     nonce: "jkl012...",
     requestId: "req-004...",
     payload: {
       clientId: "client-c"
     }
   }

2. Widget → IDP: POST /api/auth/logout { scope: "app", clientId: "client-c" }
   (IDP revokes only this client's tokens)

3. Widget → Client: AUTH_STATE
   {
     type: "AUTH_STATE",
     nonce: "jkl012...",
     requestId: "req-004...",
     payload: {
       loggedOut: true,
       scope: "app"
     }
   }

4. Client: Calls /api/me, gets 401, shows login screen

=== ERROR: THIRD-PARTY COOKIES BLOCKED ===

1. Client → Widget: SWITCH_ACCOUNT
   {
     type: "SWITCH_ACCOUNT",
     nonce: "mno345...",
     requestId: "req-005...",
     payload: {
       accountId: "acc-2"
     }
   }

2. Widget detects: __csrf cookie missing (third-party cookies blocked)

3. Widget → Client: ERROR
   {
     type: "ERROR",
     nonce: "mno345...",
     requestId: "req-005...",
     payload: {
       error: "Third-party cookies blocked",
       thirdPartyCookiesBlocked: true
     }
   }

4. Client: Shows fallback message "Open accounts in new tab"
   Widget: Shows fallback "Switch Accounts in New Tab" button

5. User clicks button → window.open("https://idp.com/u/accounts", "_blank")
   User manages accounts in new tab (full browser context, no cookie issues)

6. User returns to client tab, clicks "refresh" or waits for polling
   Client calls /api/me, sees account changed, updates UI

*/

// ============================================================================
// Origin Validation
// ============================================================================

export const ALLOWED_CLIENT_ORIGINS = [
  "http://localhost:3001", // client-a
  "http://localhost:3002", // client-b
  "http://localhost:3003", // client-c
  "https://client-a.com",
  "https://client-b.com",
  "https://client-c.com",
];

export const ALLOWED_WIDGET_ORIGINS = [
  "http://localhost:3000", // IDP
  "https://idp.com",
];

// ============================================================================
// Helper: Validate Message
// ============================================================================

export function validateMessage(msg: unknown): msg is BaseMessage {
  if (typeof msg !== "object" || msg === null) return false;

  const m = msg as Record<string, unknown>;

  return (
    typeof m.type === "string" &&
    typeof m.nonce === "string" &&
    typeof m.requestId === "string" &&
    m.type in WidgetMessageType &&
    m.nonce.length > 0 &&
    m.requestId.length > 0
  );
}

// ============================================================================
// Helper: Generate Nonce & RequestId
// ============================================================================

export function generateNonce(): string {
  if (typeof window !== "undefined" && window.crypto) {
    return Array.from(window.crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback for Node.js (testing)
  return Math.random().toString(36).substring(2, 15);
}

export function generateRequestId(): string {
  if (typeof window !== "undefined" && window.crypto) {
    return Array.from(window.crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return Math.random().toString(36).substring(2, 15);
}
