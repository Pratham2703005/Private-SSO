import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/session-store";

const IDP_SERVER = process.env.NEXT_PUBLIC_IDP_SERVER || "http://localhost:3000";

/**
 * GET /api/accounts
 * 
 * Fetches all accounts the user is logged into from the IDP.
 */
export async function GET(request: NextRequest) {
  try {
    // Get the session cookie
    const sessionCookie = request.cookies.get("app_session")?.value;

    if (!sessionCookie) {
      console.log("[/api/accounts] ❌ No session cookie found");
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

    const { sessionId } = sessionData;
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "Invalid session" },
        { status: 401 }
      );
    }

    // Get access token from server store
    const accessToken = await getAccessToken(sessionId);
    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "Session expired" },
        { status: 401 }
      );
    }

    // Fetch accounts from IDP
    const accountsResponse = await fetch(`${IDP_SERVER}/api/auth/accounts`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!accountsResponse.ok) {
      console.log("[/api/accounts] ❌ IDP error:", accountsResponse.status);
      return NextResponse.json(
        { success: false, error: "Failed to fetch accounts" },
        { status: 401 }
      );
    }

    const data = await accountsResponse.json();
    console.log("[/api/accounts] ✅ Got accounts from IDP");

    return NextResponse.json({
      success: true,
      data: data,
    });
  } catch (error) {
    console.error("[/api/accounts] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
