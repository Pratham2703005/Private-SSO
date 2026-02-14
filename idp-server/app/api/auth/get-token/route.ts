import { NextRequest, NextResponse } from "next/server";
import { getSession, getUserById } from "@/lib/db";
import { generateAccessToken, generateRefreshToken, generateIdToken } from "@/lib/jwt";
import { randomBytes } from "crypto";

/**
 * GET /api/auth/get-token
 * 
 * For internal/client use: checks if user has a valid IDP session
 * and returns tokens if they do. Used for silent token refresh.
 * 
 * This is less secure than the full OAuth flow but used for UX
 * (avoiding re-login after local logout).
 */
export async function GET(request: NextRequest) {
  try {
    const cookies = request.headers.get("cookie") || "";
    const sessionIdMatch = cookies.match(/(__sso_session|__sso_refresh)=([^;]+)/);
    const sessionId = sessionIdMatch ? sessionIdMatch[2] : null;

    if (!sessionId) {
      console.log("[/api/auth/get-token] ❌ No session cookie");
      return NextResponse.json(
        { success: false, error: "No valid session" },
        { status: 401 }
      );
    }

    // Validate session
    const session = await getSession(sessionId);
    if (!session || !session.user_id) {
      console.log("[/api/auth/get-token] ❌ Invalid session");
      return NextResponse.json(
        { success: false, error: "Session expired" },
        { status: 401 }
      );
    }

    console.log("[/api/auth/get-token] ✅ Valid session found for user:", session.user_id);

    // Get user info by ID
    const user = await getUserById(session.user_id);
    if (!user) {
      console.log("[/api/auth/get-token] ❌ User not found");
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Get active account ID from session (required for token generation)
    const sessionWithAccounts = session as { active_account_id: string | null };
    const accountId = sessionWithAccounts.active_account_id || user.id;

    // Generate new tokens
    const jti = randomBytes(16).toString("hex");
    const accessToken = generateAccessToken(user.id, user.email, user.name, accountId);
    const refreshToken = generateRefreshToken(user.id, accountId, "web", jti);
    const idToken = generateIdToken(user.id, user.email, user.name, accountId);

    console.log("[/api/auth/get-token] ✅ Tokens generated");

    return NextResponse.json({
      success: true,
      access_token: accessToken,
      refresh_token: refreshToken,
      id_token: idToken,
      token_type: "Bearer",
      expires_in: 900,
    });
  } catch (error) {
    console.error("[/api/auth/get-token] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
