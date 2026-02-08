import { NextRequest, NextResponse } from "next/server";
import {
  getSession,
  switchActiveAccount,
  getActiveSessionLogons,
} from "@/lib/db";
import { generateAccessToken, generateIdToken } from "@/lib/jwt";

/**
 * POST /api/auth/switch-account
 * Switch the currently active account in the IDP session (context switch)
 * 
 * Request: {accountId}
 * Returns: {
 *   success: true,
 *   activeAccountId,
 *   accessToken,
 *   idToken
 *   // NO refreshToken - refresh tied to login, not switches
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId required" },
        { status: 400 }
      );
    }

    // Extract IDP session cookie
    const cookies = request.headers.get("cookie") || "";
    const sessionIdMatch = cookies.match(/(__sso_session|sso_refresh_token)=([^;]+)/);
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

    // Get active accounts in this session
    const logons = await getActiveSessionLogons(sessionId);

    // Find the account to switch to
    const targetLogon = logons.find((l: any) => l.account_id === accountId);
    if (!targetLogon) {
      return NextResponse.json(
        { error: "Account not in this session or is revoked" },
        { status: 400 }
      );
    }

    // Switch to new account
    await switchActiveAccount(sessionId, accountId);

    // Generate new tokens for the new account (no refresh_token)
    const userId = session.user_id;
    const userAccount = targetLogon.user_accounts;
    
    const accessToken = generateAccessToken(
      userId,
      userAccount.email,
      userAccount.name,
      accountId
    );

    const idToken = generateIdToken(
      userId,
      userAccount.email,
      userAccount.name,
      accountId
    );

    return NextResponse.json({
      success: true,
      activeAccountId: accountId,
      accessToken,
      idToken,
      // NOTE: refreshToken NOT returned - refresh tokens are tied to login, not switches
    });
  } catch (error) {
    console.error("[/api/auth/switch-account] Error:", error);
    return NextResponse.json(
      { error: "Failed to switch account" },
      { status: 500 }
    );
  }
}
