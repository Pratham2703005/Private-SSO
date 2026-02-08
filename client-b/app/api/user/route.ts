import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/session-store";

const IDP_SERVER = process.env.NEXT_PUBLIC_IDP_SERVER || "http://localhost:3000";

export async function GET(request: NextRequest) {
  try {
    // Get the session cookie
    const sessionCookie = request.cookies.get("app_session")?.value;
    console.log("[/api/user] Session cookie:", sessionCookie ? "✅ Present" : "❌ Missing");

    if (!sessionCookie) {
      console.log("[/api/user] ❌ No session cookie found");
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    let sessionData: any;
    try {
      sessionData = JSON.parse(sessionCookie);
    } catch (e) {
      console.log("[/api/user] ❌ Failed to parse session:", e);
      return NextResponse.json(
        { success: false, error: "Invalid session" },
        { status: 401 }
      );
    }

    const { sessionId } = sessionData;
    if (!sessionId) {
      console.log("[/api/user] ❌ No sessionId in cookie");
      return NextResponse.json(
        { success: false, error: "Invalid session" },
        { status: 401 }
      );
    }

    // Retrieve access token from server-side store
    const accessToken = await getAccessToken(sessionId);
    if (!accessToken) {
      console.log("[/api/user] ❌ No access token found");
      return NextResponse.json(
        { success: false, error: "Session expired" },
        { status: 401 }
      );
    }

    console.log("[/api/user] ✅ Got access token from store");

    // Fetch user profile from IDP using the access token
    const userResponse = await fetch(`${IDP_SERVER}/api/user/profile`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      console.log("[/api/user] ❌ IDP error:", userResponse.status);
      return NextResponse.json(
        { success: false, error: "Failed to fetch user" },
        { status: 401 }
      );
    }

    const userData = await userResponse.json();
    console.log("[/api/user] ✅ Got user data");

    return NextResponse.json({
      success: true,
      data: userData.data,
    });
  } catch (error) {
    console.error("[/api/user] ❌ Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
