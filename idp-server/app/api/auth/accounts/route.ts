import { NextRequest, NextResponse } from "next/server";
import type { SessionLogonWithAccount } from "@/types";
import {
  getSession,
  getActiveSessionLogons,
} from "@/lib/db";

/**
 * GET /api/auth/accounts
 * Returns list of all accounts logged into the current IDP session
 * 
 * Request: Uses __sso_session cookie (IDP session)
 * Response: {
 *   accounts: [{id, email, name, isActive, loggedInAt, lastActiveAt}, ...],
 *   activeAccountId,
 *   sessionId
 * }
 */
export async function GET(request: NextRequest) {
  try {
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

    // Get all active accounts in this session
    const logons = (await getActiveSessionLogons(sessionId)) as unknown as SessionLogonWithAccount[];

    // Transform logons to account list
    const accounts = logons.map((logon) => ({
      id: logon.account_id,
      email: logon.account?.email ?? "unknown",
      name: logon.account?.name ?? "Unknown",
      isActive: session.active_account_id === logon.account_id,
      loggedInAt: logon.logged_in_at,
      lastActiveAt: logon.last_active_at,
    }));

    return NextResponse.json({
      accounts,
      activeAccountId: session.active_account_id,
      sessionId,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to get accounts" },
      { status: 500 }
    );
  }
}
