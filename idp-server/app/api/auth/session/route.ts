import { NextRequest, NextResponse } from "next/server";
import { getMasterCookie } from "@/lib/utils";
import { getSession } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const sessionId = getMasterCookie(request);
    
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "No active session" },
        { status: 401 }
      );
    }

    const session = await getSession(sessionId);
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session not found or expired" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        session: {
          sessionId,
          userId: session.user_id,
          expiresAt: session.expires_at
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
