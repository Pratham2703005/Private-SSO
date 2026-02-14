import { NextRequest, NextResponse } from "next/server";
import { deleteSession } from "@/lib/session-store";

/**
 * Logout Endpoint
 * Clears local app session and tokens
 */
export async function POST(request: NextRequest) {
  try {
    const appSessionCookie = request.cookies.get("app_session")?.value;

    if (appSessionCookie) {
      try {
        const sessionData = JSON.parse(decodeURIComponent(appSessionCookie));
        // Clear server-side tokens
        await deleteSession(sessionData.sessionId);
        console.log("[Logout] 🗑️  Deleted server-side tokens for:", sessionData.sessionId.substring(0, 8) + "...");
      } catch (parseError) {
        console.error("[Logout] Failed to parse session:", parseError);
      }
    }

    // ✅ Clear all auth-related cookies
    const response = NextResponse.json({ success: true });
    response.cookies.delete("app_session");
    response.cookies.delete("pkce_verifier");

    console.log("[Logout] ✅ Cookies cleared, user logged out");

    return response;
  } catch (error) {
    console.error("[Logout] ❌ Error:", error);
    return NextResponse.json(
      { error: "Logout failed" },
      { status: 500 }
    );
  }
}
