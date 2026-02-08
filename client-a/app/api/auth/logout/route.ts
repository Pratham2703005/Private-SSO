import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/session-store";

const IDP_SERVER = process.env.NEXT_PUBLIC_IDP_SERVER || "http://localhost:3000";

export async function POST(request: NextRequest) {
  try {
    console.log("[/api/auth/logout] Processing logout...");
    
    // Get session cookie
    const sessionCookie = request.cookies.get("app_session")?.value;
    
    if (sessionCookie) {
      try {
        const sessionData = JSON.parse(sessionCookie);
        if (sessionData.sessionId) {
          await clearSession(sessionData.sessionId);
          console.log("[/api/auth/logout] ✅ Server-side session cleared");
        }
      } catch (e) {
        console.log("[/api/auth/logout] ⚠️ Failed to parse session cookie");
      }
    }

    // Create response that clears app_session cookie
    const response = NextResponse.json(
      { success: true, message: "Logged out successfully" },
      { status: 200 }
    );

    // Clear app_session cookie
    response.cookies.set({
      name: "app_session",
      value: "",
      httpOnly: true,
      maxAge: 0,
      path: "/",
    });

    console.log("[/api/auth/logout] ✅ Logout complete");
    return response;
  } catch (error) {
    console.error("[/api/auth/logout] ❌ Error:", error);
    return NextResponse.json(
      { success: false, error: "Logout failed" },
      { status: 500 }
    );
  }
}
