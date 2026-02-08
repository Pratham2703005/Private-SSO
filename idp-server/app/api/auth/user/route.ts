import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession, getUserById, getUserAccounts } from "@/lib/db";

/**
 * GET /api/auth/user
 * Returns the currently authenticated user's profile
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("__sso_session");

    if (!sessionCookie || !sessionCookie.value) {
      console.log("[User] No session cookie found");
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const sessionId = sessionCookie.value;
    const session = await getSession(sessionId);

    if (!session) {
      console.log("[User] Session not found or expired");
      return NextResponse.json(
        { success: false, error: "Session expired" },
        { status: 401 }
      );
    }

    // Get user by ID
    const user = await getUserById(session.user_id);
    if (!user) {
      console.log("[User] User not found");
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Get user's accounts
    const accounts = await getUserAccounts(user.id);
    const primaryAccount = accounts.find((acc) => acc.is_primary) || accounts[0];

    return NextResponse.json(
      {
        success: true,
        data: {
          id: user.id,
          email: primaryAccount?.email || user.email,
          name: primaryAccount?.name || user.name,
          profileImage: user.profile_image_url,
          accountId: primaryAccount?.id,
          accounts: accounts,
          activeAccountId: session.active_account_id,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[User] Error fetching user:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
