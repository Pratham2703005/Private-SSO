import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/session-store";

const IDP_SERVER = process.env.NEXT_PUBLIC_IDP_SERVER || "http://localhost:3000";

/**
 * Session Check Endpoint
 * Returns user data from IDP by calling /api/auth/userinfo with stored access token
 * Called by frontend to check if user is logged in
 */
export async function GET(request: NextRequest) {
  try {
    // Read HttpOnly app_session cookie (only accessible server-side)
    const appSessionCookie = request.cookies.get("app_session")?.value;

    if (!appSessionCookie) {
      console.log("[/api/me] ❌ No session cookie found");
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
    }

    try {
      const sessionData = JSON.parse(decodeURIComponent(appSessionCookie));
      const sessionId = sessionData.sessionId;

      console.log("[/api/me] ✅ Session found:", sessionId.substring(0, 8) + "...");

      // Get access token from session store
      const accessToken = await getAccessToken(sessionId);

      if (!accessToken) {
        console.log("[/api/me] ❌ No access token found in store");
        return NextResponse.json(
          { authenticated: false, error: "No access token" },
          { status: 401 }
        );
      }

      console.log("[/api/me] 🔄 Calling IDP /api/auth/userinfo...");

      // Call IDP's userinfo endpoint with access token
      const userInfoResponse = await fetch(`${IDP_SERVER}/api/auth/userinfo`, {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      if (!userInfoResponse.ok) {
        console.log("[/api/me] ❌ IDP userinfo call failed:", userInfoResponse.status);
        return NextResponse.json(
          { authenticated: false, error: "Failed to get user info from IDP" },
          { status: 401 }
        );
      }

      const userInfo = await userInfoResponse.json();

      console.log("[/api/me] ✅ User info from IDP:");
      console.log("[/api/me]   ID:", userInfo.id.substring(0, 8) + "...");
      console.log("[/api/me]   Name:", userInfo.name);
      console.log("[/api/me]   Email:", userInfo.email);

      return NextResponse.json({
        authenticated: true,
        sessionId: sessionData.sessionId,
        userId: userInfo.id,
        userName: userInfo.name,
        email: userInfo.email,
        issuedAt: sessionData.issuedAt,
      });
    } catch (parseError) {
      console.error("[/api/me] ❌ Failed to parse session cookie:", parseError);
      return NextResponse.json(
        { authenticated: false, error: "Invalid session format" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("[/api/me] ❌ Error:", error);
    return NextResponse.json(
      { authenticated: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
