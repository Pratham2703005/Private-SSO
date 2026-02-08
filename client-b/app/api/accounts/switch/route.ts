import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getAccessToken, storeAccessToken, storeRefreshToken } from "@/lib/session-store";

const IDP_SERVER = process.env.NEXT_PUBLIC_IDP_SERVER || "http://localhost:3000";

/**
 * POST /api/accounts/switch
 * 
 * Switches to a different account. Fetches new tokens for that account from IDP.
 * 
 * Body: { accountId: string }
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

    // Get the session cookie
    const sessionCookie = request.cookies.get("app_session")?.value;

    if (!sessionCookie) {
      console.log("[/api/accounts/switch] ❌ No session cookie");
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    let sessionData: any;
    try {
      sessionData = JSON.parse(sessionCookie);
    } catch (e) {
      return NextResponse.json(
        { success: false, error: "Invalid session" },
        { status: 401 }
      );
    }

    // Get access token from server store
    const accessToken = await getAccessToken(sessionData.sessionId);
    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "Session expired" },
        { status: 401 }
      );
    }

    console.log("[/api/accounts/switch] Switching to account:", accountId);

    // Call IDP to switch account
    const switchResponse = await fetch(`${IDP_SERVER}/api/auth/switch-account`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ account_id: accountId }),
    });

    if (!switchResponse.ok) {
      console.log("[/api/accounts/switch] ❌ IDP error:", switchResponse.status);
      return NextResponse.json(
        { success: false, error: "Failed to switch account" },
        { status: switchResponse.status }
      );
    }

    const switchData = await switchResponse.json();
    console.log("[/api/accounts/switch] ✅ Account switched on IDP");

    // Get new tokens for this account
    const newSessionId = randomBytes(32).toString("hex");
    if (switchData.access_token) {
      await storeAccessToken(newSessionId, switchData.access_token);
      if (switchData.refresh_token) {
        await storeRefreshToken(newSessionId, switchData.refresh_token);
      }

      // Update app session cookie with new sessionId
      const response = NextResponse.json(
        { success: true, message: "Account switched" },
        { status: 200 }
      );

      // Decode id_token to get new user info
      let userId = accountId;
      if (switchData.id_token) {
        try {
          const idTokenParts = switchData.id_token.split(".");
          const decodedIdToken = JSON.parse(
            Buffer.from(idTokenParts[1], "base64").toString()
          );
          userId = decodedIdToken.sub || accountId;
        } catch (e) {
          console.log("[/api/accounts/switch] Warning: Failed to decode id_token");
        }
      }

      response.cookies.set({
        name: "app_session",
        value: JSON.stringify({
          sessionId: newSessionId,
          userId,
          issuedAt: Date.now(),
        }),
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60,
        path: "/",
      });

      return response;
    }

    return NextResponse.json(
      { success: false, error: "No tokens received" },
      { status: 500 }
    );
  } catch (error) {
    console.error("[/api/accounts/switch] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
