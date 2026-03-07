import { NextRequest, NextResponse } from "next/server";
import type { SessionLogonWithAccount } from "@/types";
import {
  getSession,
  getActiveSessionLogons,
  markLogonRevoked,
  revokeAccountTokensPrecise,
  switchActiveAccount,
  revokeSession,
} from "@/lib/db";
import { generateAccessToken, generateIdToken } from "@/lib/jwt";

/**
 * POST /api/auth/account-logout
 * Logout a specific account from the IDP session (per-account logout, not global)
 * 
 * Request: {accountId?}  // Defaults to active account
 * Response:
 * - If logging out last account: triggers global logout, clears session
 * - If logging out active account with others: auto-switches to next, returns new tokens
 * - If logging out inactive account: returns updated accounts list
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId: accountIdToLogout } = body;

    // Extract IDP session cookie
    const cookies = request.headers.get("cookie") || "";
    const sessionIdMatch = cookies.match(/(__sso_session)=([^;]+)/);
    const sessionId = sessionIdMatch ? sessionIdMatch[2] : null;

    if (!sessionId) {
      return NextResponse.json(
        { error: "No IDP session found" },
        { status: 401 }
      );
    }

    // Get session
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found or expired" },
        { status: 401 }
      );
    }

    const userId = session.user_id;

    // Get active accounts before logout
    const logons = (await getActiveSessionLogons(sessionId)) as unknown as SessionLogonWithAccount[];
    const accountToLogout = accountIdToLogout || session.active_account_id;

    if (!accountToLogout) {
      return NextResponse.json(
        { error: "accountId required or no active account set" },
        { status: 400 }
      );
    }

    // Verify account exists in session
    const logonToRevoke = logons.find((l) => l.account_id === accountToLogout);
    if (!logonToRevoke) {
      return NextResponse.json(
        { error: "Account not found in this session" },
        { status: 400 }
      );
    }

    // Mark logon as revoked
    await markLogonRevoked(sessionId, accountToLogout);

    // Revoke refresh tokens for this account in this session
    await revokeAccountTokensPrecise(userId, accountToLogout, sessionId);

    // Check remaining accounts
    const remainingLogons = logons.filter(
      (l) => l.account_id !== accountToLogout
    );

    // If logging out the last account: trigger global logout
    if (remainingLogons.length === 0) {
      console.log("[/api/auth/account-logout] Last account logged out, destroying session");
      
      // Destroy session and clear IDP session cookie
      await revokeSession(sessionId);

      const response = NextResponse.json({
        success: true,
        lastAccountLoggedOut: true,
        redirectToLogin: true,
      });

      // Clear IDP session cookie
      response.cookies.set("__sso_session", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
      });

      return response;
    }

    // If was active account: auto-switch to next (most recently used)
    if (accountToLogout === session.active_account_id) {
      const nextAccount = remainingLogons[0]; // Already sorted by last_active_at DESC
      await switchActiveAccount(sessionId, nextAccount.account_id);

      // Generate tokens for switch
      const userAccount = nextAccount.user_accounts!;
      const accessToken = generateAccessToken(
        userId,
        userAccount.email,
        userAccount.name,
        nextAccount.account_id
      );

      const idToken = generateIdToken(
        userId,
        userAccount.email,
        userAccount.name,
        nextAccount.account_id
      );

      return NextResponse.json({
        success: true,
        logout: { accountId: accountToLogout },
        switched_to: nextAccount.account_id,
        accessToken,
        idToken,
        accounts: remainingLogons.map((l) => ({
          id: l.account_id,
          email: l.user_accounts?.email || "unknown",
          name: l.user_accounts?.name || "Unknown",
          isActive: nextAccount.account_id === l.account_id,
        })),
      });
    }

    // Was inactive account: just return updated accounts list
    return NextResponse.json({
      success: true,
      logout: { accountId: accountToLogout },
      accounts: remainingLogons.map((l) => ({
        id: l.account_id,
        email: l.user_accounts?.email || "unknown",
        name: l.user_accounts?.name || "Unknown",
        isActive: l.account_id === session.active_account_id,
      })),
    });
  } catch (error) {
    console.error("[/api/auth/account-logout] Error:", error);
    return NextResponse.json(
      { error: "Failed to logout account" },
      { status: 500 }
    );
  }
}
