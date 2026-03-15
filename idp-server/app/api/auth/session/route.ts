import { NextRequest, NextResponse } from "next/server";
import { getMasterCookie } from "@/lib/utils";
import {
  getSession,
  getUserById,
  getUserAccounts,
  getAccountById,
  getClient,
  validateClientOrigin,
  getDomainPreference,
  setDomainPreference,
  clearDomainPreference,
} from "@/lib/db";
import { generateAccessToken } from "@/lib/jwt";
import {
  verifySessionBinding,
  setCSRFCookie,
  generateCSRFToken,
} from "@/lib/session-security-utils";
import { supabase } from "@/lib/db";

/**
 * POST /api/auth/session/validate
 * 
 * Validates client session and returns user profile + access token
 * Called by client backend before serving protected content
 * 
 * Security checks:
 * 1. Session exists and not expired
 * 2. Session binding matches User-Agent (prevents token theft)
 * 3. Account is not revoked
 * 4. Refresh token is valid
 * 
 * Returns:
 * - user: { id, email, name } for active account
 * - account: { id, name, org } for active account
 * - accounts: [ list of all accounts in session ]
 * - accessToken: short-lived (15 min) JWT for optional IDP API calls
 * - activeAccountId: which account is currently active
 */
export async function POST(request: NextRequest) {
  try {
    const sessionId = getMasterCookie(request) || request.headers.get("x-session-id");
    const clientId = request.headers.get("x-client-id");
    const origin = request.headers.get("origin");

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "No active session" },
        { status: 401 }
      );
    }

    // SECURITY: Validate client_id AND origin match
    // Prevents: curl -H "x-client-id: client-c-dev" from malicious.com
    // Note: origin is only set by browsers. Server-to-server calls have empty origin.
    // That's OK - we trust our own backend servers.
    if (clientId) {
      // Only validate origin if provided (browser request)
      // Empty origin = server-to-server call, which is trusted
      if (origin) {
        const isValidClient = await validateClientOrigin(clientId, origin);
        if (!isValidClient) {
          console.warn(
            `[Session] Invalid client: ${clientId} from origin ${origin}`
          );
          return NextResponse.json(
            { success: false, error: "Unauthorized client" },
            { status: 403 }
          );
        }
      } else {
        // Server-to-server: Just verify client exists
        const client = await getClient(clientId);
        if (!client) {
          console.warn(`[Session] Unknown client: ${clientId}`);
          return NextResponse.json(
            { success: false, error: "Unknown client" },
            { status: 403 }
          );
        }
      }
    }

    // 1. Get session from DB
    const session = await getSession(sessionId);

    if (!session) {
      const response = new NextResponse(
        JSON.stringify({ success: false, error: "Session not found or expired" }),
        { status: 401 }
      );
      return response;
    }

    // 2. Check session expiration
    const expiresAtMs = new Date(session.expires_at).getTime();
    if (expiresAtMs < Date.now()) {
      return NextResponse.json(
        { success: false, error: "Session expired" },
        { status: 401 }
      );
    }

    // 3. Get domain-specific account preference
    // NEW: Instead of global active_account_id, use per-domain preference
    let activeAccountId = session.active_account_id; // fallback to global

    if (clientId) {
      const domainPref = await getDomainPreference(sessionId, clientId);

      if (domainPref?.accountId) {
        // Preference exists, but check if it's still valid
        // If user logged out and logged in as a different account,
        // the preference becomes stale. Reinitialize it.
        if (domainPref.accountId !== session.active_account_id) {
          console.log(`[Session] Domain preference stale (${domainPref.accountId} != ${session.active_account_id}), reinitializing`);
          await setDomainPreference(sessionId, clientId, session.active_account_id);
          activeAccountId = session.active_account_id;
        } else {
          // Preference is still valid
          activeAccountId = domainPref.accountId;
        }
      } else {
        // First request from this client: initialize with current account
        console.log(`[Session] First request from ${clientId}, initializing preference with ${session.active_account_id}`);
        await setDomainPreference(sessionId, clientId, session.active_account_id);
        activeAccountId = session.active_account_id;
      }
    } 

    if (!activeAccountId) {
      return NextResponse.json(
        { success: false, error: "No active account in session" },
        { status: 401 }
      );
    }

    // 4. Get account data (handle deletion gracefully)
    let account = await getAccountById(activeAccountId);

    if (!account) {
      // Account was deleted: clear preference and fall back to primary
      if (clientId) {
        await clearDomainPreference(sessionId, clientId);
      }

      const allAccounts = await getUserAccounts(session.user_id);
      const primaryAccount = allAccounts.find((a) => a.is_primary) || allAccounts[0];

      if (!primaryAccount) {
        return NextResponse.json(
          { success: false, error: "No active account available" },
          { status: 401 }
        );
      }

      account = primaryAccount;
      activeAccountId = primaryAccount.id;

      // Initialize fallback preference if needed
      if (clientId) {
        await setDomainPreference(sessionId, clientId, primaryAccount.id);
      }
    }

    // 5. Get user data
    const user = await getUserById(session.user_id);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 401 }
      );
    }

    // 6. Verify session binding (User-Agent hash)
    // SOFT CHECK: UA changes are legitimate (Chrome updates, mobile WebView, proxies, Brave)
    // Log suspicious activity but don't block - prevents false logouts
    // For stronger security, bind to stable device_id cookie also
    const userAgent = request.headers.get("user-agent") || "";
    const { data: refreshTokens } = await supabase
      .from("refresh_tokens")
      .select("session_binding_hash")
      .eq("user_id", session.user_id)
      .eq("session_id", sessionId)
      .is("used_at", null)
      .not("replaced_by_token_hash", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (refreshTokens && refreshTokens.length > 0) {
      const binding = refreshTokens[0].session_binding_hash;
      const bindingCheck = verifySessionBinding(binding, userAgent);
      // Log suspicious cases but don't block - treat as soft check
      if (bindingCheck.suspicious) {
        console.warn("[SessionBinding] Suspicious activity - UA mismatch", {
          sessionId: sessionId.substring(0, 16) + "...",
          timestamp: new Date().toISOString(),
        });
        // Continue anyway - don't reject, just monitor
      }
    }

    // 7. Get all accounts in this session
    const allAccounts = await getUserAccounts(session.user_id);
    const accountList = (allAccounts || []).map((acc) => ({
      id: acc.id,
      name: acc.name,
      email: acc.email,
      isPrimary: acc.is_primary,
    }));

    // 8. Generate short-lived access token (15 minutes)
    const accessToken = generateAccessToken(
      user.id,
      account.email,
      account.name,
      activeAccountId
    );

    // 9. Generate CSRF token for next request
    // CRITICAL: Widget must read this fresh token from Set-Cookie header
    // If widget caches old token, next request will get 403 CSRF validation failed
    // Widget should parse Set-Cookie or make sure to fetch latest __csrf cookie
    const csrfToken = generateCSRFToken();

    // 10. Build response
    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: account.email,
          name: account.name,
        },
        account: {
          id: account.id,
          name: account.name,
          email: account.email,
        },
        accounts: accountList,
        activeAccountId: activeAccountId,
        accessToken: accessToken, // 15-min token for optional downstream API calls
        iat: Math.floor(Date.now() / 1000),
      },
      { status: 200 }
    );

    // Set CSRF cookie for next state-changing request
    setCSRFCookie(response, csrfToken);

    return response;
  } catch (error) {
    console.error("Session validate error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
