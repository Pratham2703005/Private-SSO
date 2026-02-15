import { NextRequest, NextResponse } from "next/server";
import {
  getSession,
  switchActiveAccount,
  getActiveSessionLogons,
} from "@/lib/db";
import { validateCSRFToken, setCSRFCookie, generateCSRFToken } from "@/lib/session-security-utils";
import { getMasterCookie } from "@/lib/utils";

/**
 * POST /api/auth/switch-account
 * 
 * Switch the currently active account in the IDP session
 * Only updates __sso_session on IDP (server-side state)
 * Client cookies (app_session_a) remain unchanged
 * 
 * Security:
 * - Uses CSRF double-submit (check __csrf cookie matches _csrf body field)
 * - Validates Origin header
 * 
 * Request:
 * {
 *   "accountId": "account-uuid",
 *   "_csrf": "token-from-__csrf-cookie"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "activeAccountId": "new-account-id"
 *   // NO cookie changes - client cookie unchanged
 *   // NO access token - client calls /api/me next
 * }
 * 
 * Flow:
 * 1. Widget calls POST with CSRF token
 * 2. IDP validates CSRF (cookie + body must match)
 * 3. IDP updates __sso_session (active_account_id changed)
 * 4. Client receives success
 * 5. Client calls /api/me on its own server
 * 6. Client backend calls IDP /api/auth/session/validate
 * 7. IDP sees new active_account_id, returns new user data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: "accountId required" },
        { status: 400 }
      );
    }

    // 1. Validate CSRF protection (double-submit)
    const csrfValidation = await validateCSRFToken(request);
    if (!csrfValidation.isValid) {
      return NextResponse.json(
        { success: false, error: csrfValidation.error || "CSRF validation failed" },
        { status: 403 }
      );
    }

    // 2. Get IDP session from __sso_session cookie
    const sessionId = getMasterCookie(request);
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "No IDP session found" },
        { status: 401 }
      );
    }

    // 3. Validate session exists
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session not found or expired" },
        { status: 401 }
      );
    }

    // 4. Get active accounts in this session
    const logons = await getActiveSessionLogons(sessionId);
    if (!logons || logons.length === 0) {
      return NextResponse.json(
        { success: false, error: "No active accounts in session" },
        { status: 400 }
      );
    }

    // 5. Find the account to switch to
    const targetLogon = logons.find((l: any) => l.account_id === accountId);
    if (!targetLogon) {
      return NextResponse.json(
        { success: false, error: "Account not in this session or is revoked" },
        { status: 400 }
      );
    }

    // 6. Update IDP session active account
    await switchActiveAccount(sessionId, accountId);

    // 7. Generate new CSRF token for next request
    const newCSRFToken = generateCSRFToken();

    // 8. Build response
    const response = NextResponse.json(
      {
        success: true,
        activeAccountId: accountId,
        // NOTE: No access token, no refresh token, no cookie changes
        // Client will call /api/me next, which triggers IDP validate call
      },
      { status: 200 }
    );

    // Set new CSRF token for next request
    setCSRFCookie(response, newCSRFToken);

    return response;
  } catch (error) {
    console.error("[POST /api/auth/switch-account] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to switch account" },
      { status: 500 }
    );
  }
}
