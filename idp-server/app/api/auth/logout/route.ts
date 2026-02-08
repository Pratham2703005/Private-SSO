import { NextRequest, NextResponse } from "next/server";
import { getMasterCookie, clearMasterCookie, validateClientSecret } from "@/lib/utils";
import { revokeAllUserTokens, getSession, revokeSession } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, clientSecret } = body;

    // Get master cookie
    const sessionId = getMasterCookie(request);
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "Not logged in" },
        { status: 401 }
      );
    }

    // If client-specific logout (with clientSecret)
    if (clientId && clientSecret) {
      if (!validateClientSecret(clientId, clientSecret)) {
        return NextResponse.json(
          { success: false, error: "Invalid client credentials" },
          { status: 401 }
        );
      }
      // Only revoke tokens for this client - handled by client itself
      // This is a notification endpoint
      return NextResponse.json(
        { success: true, message: "Client logout successful" },
        { status: 200 }
      );
    }

    // Complete logout (revoke master cookie and all tokens)
    const session = await getSession(sessionId);
    if (session) {
      await revokeAllUserTokens(session.user_id);
      await revokeSession(sessionId);
    }

    const response = NextResponse.json(
      { success: true, message: "Logged out successfully" },
      { status: 200 }
    );

    return clearMasterCookie(response);
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
