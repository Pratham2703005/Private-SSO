/**
 * Client-Side Widget Integration Guide
 * 
 * This shows how the client application (client-a/b/c) embeds the widget
 * and handles postMessage communication.
 * 
 * Flow:
 * 1. Page embeds widget iframe pointing to IDP domain
 * 2. Widget sends WIDGET_READY message
 * 3. Page requests accounts via REQUEST_ACCOUNTS message
 * 4. Widget responds with ACCOUNT_SWITCHED or ERROR
 * 5. Page calls /api/me to fetch updated user data
 * 6. Page re-renders UI
 */

import crypto from "crypto";

type MessageType =
  | "WIDGET_READY"
  | "REQUEST_ACCOUNTS"
  | "SWITCH_ACCOUNT"
  | "LOGOUT_APP"
  | "LOGOUT_GLOBAL"
  | "ACCOUNT_SWITCHED"
  | "AUTH_STATE"
  | "ERROR";

interface WidgetMessage {
  type: MessageType;
  nonce: string;
  requestId: string;
  payload?: Record<string, unknown>;
}

interface UserData {
  authenticated: boolean;
  user: {
    id: string;
    email: string;
    name: string;
  };
  account: {
    id: string;
    name: string;
    email: string;
  };
  accounts: Array<{
    id: string;
    name: string;
    email: string;
    isPrimary: boolean;
  }>;
  activeAccountId: string;
}

interface AccountInfo {
  id: string;
  name: string;
  email: string;
  isPrimary: boolean;
}

interface AuthStatePayload {
  accounts?: AccountInfo[];
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
}

// ============================================================================
// Client-Side Widget Manager
// ============================================================================

class WidgetManager {
  private widgetFrame: HTMLIFrameElement | null = null;
  private widgetOrigin: string;
  private pendingRequests = new Map<string, (msg: WidgetMessage) => void>();
  private allowedWidgetOrigins = [
    process.env.NEXT_PUBLIC_IDP_ORIGIN,
  ];

  constructor(widgetOrigin: string = process.env.NEXT_PUBLIC_IDP_ORIGIN!) {
    this.widgetOrigin = widgetOrigin;
  }

  /**
   * Initialize widget: embed iframe and set up message listener
   */
  init() {
    this.setupIframe();
    this.setupMessageListener();
  }

  /**
   * Embed widget iframe
   * Points to IDP domain (must be different domain for widget isolation)
   */
  private setupIframe() {
    // Create iframe pointing to IDP widget endpoint
    // Pass client_id and parentOrigin parameters for:
    // - client_id: per-domain preference saving
    // - parentOrigin: so widget knows if it's on IDP or on client, and sends sessionUpdate appropriately
    const widgetUrl = new URL(`${this.widgetOrigin}/widget/account-switcher`);
    widgetUrl.searchParams.append('client_id', process.env.NEXT_PUBLIC_CLIENT_ID!);
    widgetUrl.searchParams.append('parentOrigin', window.location.origin);

    const iframe = document.createElement("iframe");
    iframe.id = "account-switcher-widget";
    iframe.src = widgetUrl.toString();
    iframe.style.border = "none";
    iframe.style.width = "100%";
    iframe.style.height = "auto";
    iframe.style.minHeight = "100px";

    // Sandbox restrictions (tight security)
    iframe.sandbox.add("allow-same-origin");
    iframe.sandbox.add("allow-scripts");
    iframe.sandbox.add("allow-popups"); // For "Open in new tab" fallback

    const container = document.getElementById("widget-container");
    if (container) {
      container.appendChild(iframe);
    }

    this.widgetFrame = iframe;
  }

  /**
   * Set up postMessage listener for widget messages
   */
  private setupMessageListener() {
    window.addEventListener("message", (event: MessageEvent) => {
      // 1. Validate origin
      if (!this.allowedWidgetOrigins.includes(event.origin)) {
        console.warn("[Client] Message from untrusted origin:", event.origin);
        return;
      }

      // 2. Validate message structure (type is required, but nonce/requestId are optional)
      const msg = event.data as WidgetMessage;
      if (!msg.type) {
        console.warn("[Client] Invalid message structure (missing type):", event.data);
        return;
      }

      // 3. Validate message type
      const validTypes: MessageType[] = [
        "WIDGET_READY",
        "ACCOUNT_SWITCHED",
        "AUTH_STATE",
        "ERROR",
      ];
      if (!validTypes.includes(msg.type)) {
        console.warn("[Client] Unknown message type:", msg.type);
        return;
      }

      // 4. Route to appropriate handler
      this.handleWidgetMessage(msg);

      // 5. Check if this was a awaited request (only if requestId exists)
      if (msg.requestId) {
        const handler = this.pendingRequests.get(msg.requestId);
        if (handler) {
          handler(msg);
          this.pendingRequests.delete(msg.requestId);
        }
      }
    });
  }

  /**
   * Handle widget messages
   */
  private handleWidgetMessage(msg: WidgetMessage) {
    switch (msg.type) {
      case "WIDGET_READY":
        console.log("[Client] Widget ready");
        // Widget is ready, request accounts
        void this.requestAccounts();
        break;

      case "ACCOUNT_SWITCHED":
        console.log("[Client] Account switched:", msg.payload?.activeAccountId);
        // Account switched on IDP - client session must be refreshed via OAuth re-auth
        // This ensures app_session_c matches IDP's active_account_id
        this.triggerAccountSwitchReauth(msg.payload?.accountId as string);
        break;

      case "AUTH_STATE": {
        const payload = msg.payload as AuthStatePayload | undefined;
        if (payload?.loggedOut) {
          console.log("[Client] User logged out, scope:", payload.scope);
          // User logged out, redirect to login or show login UI
          if (payload.scope === "global") {
            // Global logout - redirect to login page
            window.location.href = "/";
          } else {
            // App-only logout - refresh to show login state
            void this.fetchAndUpdateUser();
          }
        } else if (payload?.accounts) {
          // Got accounts list
          console.log("[Client] Got accounts:", payload.accounts);
          this.updateUIWithAccounts(payload);
        }
        break;
      }

      case "ERROR": {
        const payload = msg.payload as Record<string, unknown> | undefined;
        console.error("[Client] Widget error:", payload?.error);
        if (payload?.thirdPartyCookiesBlocked) {
          console.log("[Client] Third-party cookies blocked, widget will show fallback");
          // Widget will show "Open in new tab" button
        }
        break;
      }
    }
  }

  /**
   * Send message to widget and optionally wait for response
   */
  private sendToWidget(msg: WidgetMessage): Promise<WidgetMessage> {
    return new Promise((resolve) => {
      if (!this.widgetFrame?.contentWindow) {
        console.error("[Client] Widget frame not ready");
        resolve({
          type: "ERROR",
          nonce: msg.nonce,
          requestId: msg.requestId,
        });
        return;
      }

      // Store handler for response
      this.pendingRequests.set(msg.requestId, (response) => {
        resolve(response);
      });

      // Send message to widget
      this.widgetFrame.contentWindow.postMessage(msg, this.widgetOrigin);

      // Timeout if no response after 5 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(msg.requestId)) {
          this.pendingRequests.delete(msg.requestId);
          resolve({
            type: "ERROR",
            nonce: msg.nonce,
            requestId: msg.requestId,
            payload: { error: "Widget timeout" },
          });
        }
      }, 5000);
    });
  }

  /**
   * Request current accounts list from widget
   */
  private async requestAccounts() {
    const msg: WidgetMessage = {
      type: "REQUEST_ACCOUNTS",
      nonce: crypto.randomBytes(16).toString("hex"),
      requestId: crypto.randomBytes(16).toString("hex"),
    };

    await this.sendToWidget(msg);
    // Handler will update UI in handleWidgetMessage
  }

  /**
   * Request account switch
   */
  async switchAccount(accountId: string) {
    const msg: WidgetMessage = {
      type: "SWITCH_ACCOUNT",
      nonce: crypto.randomBytes(16).toString("hex"),
      requestId: crypto.randomBytes(16).toString("hex"),
      payload: { accountId },
    };

    await this.sendToWidget(msg);
    // Handler will call fetchAndUpdateUser() after switch
  }

  /**
   * Request logout this app
   */
  async logoutApp() {
    // Get clientId from window config (must be set by client)
    const clientId =
      (typeof window !== "undefined" &&
        (window as unknown as Record<string, unknown>).CLIENT_ID) ||
      "client-c";

    const msg: WidgetMessage = {
      type: "LOGOUT_APP",
      nonce: crypto.randomBytes(16).toString("hex"),
      requestId: crypto.randomBytes(16).toString("hex"),
      payload: { clientId },
    };

    await this.sendToWidget(msg);
    // Handler will call fetchAndUpdateUser() after logout
  }

  /**
   * Request logout everywhere
   */
  async logoutGlobal() {
    const msg: WidgetMessage = {
      type: "LOGOUT_GLOBAL",
      nonce: crypto.randomBytes(16).toString("hex"),
      requestId: crypto.randomBytes(16).toString("hex"),
    };

    await this.sendToWidget(msg);
    // Handler will redirect to login
  }

  /**
   * Handle account switch: trigger OAuth re-auth on client
   * This replaces app_session_c with a new session that matches IDP's active_account_id
   * 
   * Pattern:
   * - IDP updates __sso_session active_account_id
   * - Widget notifies client: ACCOUNT_SWITCHED
   * - Client constructs /authorize?prompt=none URL (from its own config)
   * - Client navigates to IDP /authorize
   * - IDP /authorize (with new active account) redirects to /callback?code=NEW_CODE
   * - Client /callback exchanges code, sets new app_session_c
   * - Result: Client session now matches IDP identity
   */
  private triggerAccountSwitchReauth(accountId?: string) {
    try {
      const idpOrigin = process.env.NEXT_PUBLIC_IDP_ORIGIN || 'http://localhost:3000';
      const clientId = process.env.NEXT_PUBLIC_CLIENT_ID || 'client-c';
      const redirectUri = process.env.NEXT_PUBLIC_REDIRECT_URI || 'http://localhost:3003/api/auth/callback';

      // Build authorize URL for silent re-auth
      const authorizeUrl = new URL(`${idpOrigin}/authorize`);
      authorizeUrl.searchParams.append('client_id', clientId);
      authorizeUrl.searchParams.append('redirect_uri', redirectUri);
      authorizeUrl.searchParams.append('response_type', 'code');
      authorizeUrl.searchParams.append('scope', 'openid profile email');
      authorizeUrl.searchParams.append('prompt', 'none'); // Silent auth
      if (accountId) {
        authorizeUrl.searchParams.append('account_hint', accountId);
      }

      console.log('[Client] Redirecting to OAuth re-auth after account switch:', authorizeUrl.toString());
      
      // Navigate to authorize endpoint
      // IDP will detect existing __sso_session with new active_account_id
      // and redirect back to /callback with new auth code
      window.location.href = authorizeUrl.toString();
    } catch (error) {
      console.error('[Client] Failed to trigger account switch re-auth:', error);
    }
  }

  /**
   * Fetch user data from client backend (/api/me)
   * This calls IDP internally to validate session
   */
  private async fetchAndUpdateUser() {
    try {
      const response = await fetch("/api/me");

      if (!response.ok) {
        if (response.status === 401) {
          // Not logged in - show login UI
          this.showLoginUI();
        }
        return;
      }

      const user = (await response.json()) as UserData;
      this.updateUIWithUser(user);
    } catch (error) {
      console.error("[Client] Failed to fetch user:", error);
    }
  }

  /**
   * Update UI with user data
   */
  private updateUIWithUser(user: UserData) {
    const userDisplay = document.getElementById("user-display");
    if (userDisplay) {
      userDisplay.innerHTML = `
        <div style="padding: 16px; background: #f0f9ff; border-radius: 4px;">
          <p><strong>User:</strong> ${user.user.name || user.user.email}</p>
          <p><strong>Account:</strong> ${user.account.name}</p>
          <p><strong>Email:</strong> ${user.account.email}</p>
          <button onclick="widgetManager.logoutApp()" style="
            margin-top: 8px;
            padding: 8px 16px;
            background: #dc3545;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          ">
            Logout
          </button>
        </div>
      `;
    }
  }

  /**
   * Update UI with accounts list
   */
  private updateUIWithAccounts(payload: AuthStatePayload) {
    const accountsList = document.getElementById("accounts-list");
    if (!accountsList) return;

    const { accounts = [], activeAccountId } = payload;

    accountsList.innerHTML = (accounts as AccountInfo[])
      .map((account) => {
        const isActive = account.id === activeAccountId;
        return `
      <div style="
        padding: 12px;
        margin: 8px 0;
        background: ${isActive ? "#d4edda" : "#f8f9fa"};
        border: 1px solid #ddd;
        border-radius: 4px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <div>
          <strong>${account.name}</strong><br/>
          <small>${account.email}</small>
        </div>
        ${
          !isActive
            ? `<button 
              data-account-id="${account.id}"
              onclick="widgetManager.switchAccount('${account.id}')"
              style="
                padding: 6px 12px;
                background: #0d6efd;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
              "
            >
              Switch
            </button>`
            : `<span style="color: #28a745; font-weight: bold;">Active</span>`
        }
      </div>
    `;
      })
      .join("");
  }

  /**
   * Show login UI
   */
  private showLoginUI() {
    const userDisplay = document.getElementById("user-display");
    if (userDisplay) {
      userDisplay.innerHTML = `
        <div style="padding: 16px; background: #f8d7da; border-radius: 4px;">
          <p>Not logged in</p>
          <a href="/api/auth/start" style="
            display: inline-block;
            margin-top: 8px;
            padding: 8px 16px;
            background: #0d6efd;
            color: white;
            text-decoration: none;
            border-radius: 4px;
          ">
            Login
          </a>
        </div>
      `;
    }
  }
}

// ============================================================================
// Export for use on page
// ============================================================================

if (typeof window !== "undefined") {
  const windowObj = window as unknown as Record<string, unknown>;
  windowObj.WidgetManager = WidgetManager;
  windowObj.widgetManager = new WidgetManager();
}

// ============================================================================
// Example HTML Integration:
// ============================================================================

/*

<!DOCTYPE html>
<html>
<head>
  <title>Client App with Widget</title>
  <script>window.CLIENT_ID = 'client-c';</script>
</head>
<body>
  <h1>My App</h1>

  <!-- User display section -->
  <div id="user-display" style="margin: 20px;">
    Loading...
  </div>

  <!-- Widget container -->
  <div id="widget-container" style="margin: 20px; border: 1px solid #ddd; padding: 16px;">
    <h3>Accounts</h3>
    <div id="accounts-list">Loading accounts...</div>
  </div>

  <!-- Widget script -->
  <script src="http://localhost:3000/api/widget.js"></script>

  <!-- Widget integration script -->
  <script src="/widget-manager.ts"></script>

  <script>
    // Initialize widget when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
      widgetManager.init();
    });
  </script>
</body>
</html>

*/
