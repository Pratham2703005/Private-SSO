import { NextRequest, NextResponse } from "next/server";
import { getMasterCookie, clearMasterCookie } from "@/lib/utils";
import { getSession, revokeAllUserTokens, revokeSession } from "@/lib/db";
import { validateCSRFToken, setCSRFCookie, generateCSRFToken } from "@/lib/session-security-utils";
import { supabase } from "@/lib/db";

/**
 * POST /api/auth/logout
 * 
 * Logout user with scope control
 * 
 * Scope Options:
 * 
 * - "app" (default): Revoke THIS APP's tokens ONLY
 *    → Revokes refresh_token where client_id = this client (e.g., "client-a")
 *    → Keeps __sso_session active (user stays logged into IDP)
 *    → Other clients (client-b, client-c) still have valid tokens
 *    → Widget still works (can still switch accounts and login to other apps)
 *    → User can still use other apps without re-logging in
 *    
 * - "global": Revoke ALL tokens + clear IDP session
 *    → Revokes ALL refresh_tokens for this user (all clients affected)
 *    → Clears __sso_session cookie (user logged out of IDP itself)
 *    → Widget can no longer access account list
 *    → Must re-login to use any app
 *    → Logout "everyone" button
 * 
 * Example Flows:
 * 
 * Scenario A: User clicks "Logout" on client-c
 *   1. POST /api/auth/logout { scope: "app", clientId: "client-c" }
 *   2. IDP revokes: refresh_tokens WHERE client_id="client-c" AND user_id=this_user
 *   3. Result: client-c is logged out, but user can still use client-a/b
 *   4. Widget still shows account list, can switch and add accounts
 * 
 * Scenario B: User clicks "Logout of everything"
 *   1. POST /api/auth/logout { scope: "global" }
 *   2. IDP revokes: ALL refresh_tokens for this user
 *   3. IDP clears: __sso_session cookie
 *   4. Result: All clients logged out, must re-login everywhere
 *   5. IDP login page shown if accessing widget
 * 
 * Security:
 * - CSRF protection (double-submit)
 * - Validates scope = "app" or "global"
 * - Only revokes correct tokens based on scope
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scope = "app", clientId } = body;

    // 1. Validate scope
    if (!["app", "global"].includes(scope)) {
      return NextResponse.json(
        { success: false, error: "Invalid scope. Must be 'app' or 'global'" },
        { status: 400 }
      );
    }

    // 2. Validate CSRF protection (double-submit)
    const csrfValidation = await validateCSRFToken(request);
    if (!csrfValidation.isValid) {
      return NextResponse.json(
        { success: false, error: csrfValidation.error || "CSRF validation failed" },
        { status: 403 }
      );
    }

    // 3. Get IDP session from __sso_session cookie
    const sessionId = getMasterCookie(request);
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "Not logged in" },
        { status: 401 }
      );
    }

    // 4. Validate session exists
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session not found or expired" },
        { status: 401 }
      );
    }

    // 5. Handle logout based on scope
    if (scope === "app") {
      // APP-ONLY LOGOUT: Revoke tokens for THIS CLIENT ONLY
      if (!clientId) {
        return NextResponse.json(
          { success: false, error: "clientId required for app-scope logout" },
          { status: 400 }
        );
      }

      // Revoke ONLY this client's refresh tokens (keep other clients active)
      // Look for all refresh tokens where:
      // - user_id = this user
      // - client_id = this specific client (e.g., "client-c")
      // - not already used (used_at IS NULL)
      const { error } = await supabase
        .from("refresh_tokens")
        .update({ is_compromised: true })
        .eq("user_id", session.user_id)
        .eq("client_id", clientId) // IMPORTANT: Only this client
        .is("used_at", null); // Only current generation

      if (error) {
        console.error("Error revoking app tokens:", error);
        throw error;
      }

      const response = NextResponse.json(
        {
          success: true,
          message: "Logged out from this app",
          scope: "app",
          detail: `Revoked tokens for client: ${clientId}. Other clients remain active.`,
        },
        { status: 200 }
      );

      // Generate new CSRF token for next request
      const newCSRFToken = generateCSRFToken();
      setCSRFCookie(response, newCSRFToken);

      return response;
    } else {
      // GLOBAL LOGOUT: Revoke everything and clear IDP session
      // Revokes ALL tokens for this user (affects all clients)
      await revokeAllUserTokens(session.user_id);

      // Revoke the session itself (__sso_session becomes invalid)
      await revokeSession(sessionId);

      const response = NextResponse.json(
        {
          success: true,
          message: "Logged out globally",
          scope: "global",
          detail: "All tokens revoked. User must re-login to any app.",
        },
        { status: 200 }
      );

      // Clear IDP session cookie (__sso_session)
      return clearMasterCookie(response);
    }
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
