import { NextRequest, NextResponse } from "next/server";

/**
 * /api/auth/logout-app
 *
 * Sign out user from this app only (keep IDP session active).
 * Called by widget after user clicks "Sign out of this app".
 * Does NOT affect other apps or IDP session.
 *
 * Requirements:
 * - Clear client-side session cookies (access_token, refresh_token)
 * - Do NOT touch IDP cookies (__sso_session, sso_refresh_token)
 * - Redirect to / or login screen
 *
 * Method: POST only (not a page, API endpoint)
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: "Method not allowed. Use POST to logout." },
    { status: 405 }
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log("[/api/auth/logout-app] Processing app-only logout...");

    // Create response that redirects to home
    const response = NextResponse.redirect(new URL("/", request.nextUrl.origin));

    // Clear app_session cookie (client session only)
    response.cookies.set({
      name: "app_session",
      value: "",
      httpOnly: true,
      maxAge: 0,
      path: "/",
    });

    // Note: DO NOT clear pkce_verifier, state, or other OAuth flow cookies here
    // as they should only be cleared after password verification or explicit logout

    console.log("[/api/auth/logout-app] ✅ App session cleared, redirecting to home");
    return response;
  } catch (error) {
    console.error("[/api/auth/logout-app] ❌ Error:", error);
    return NextResponse.json(
      { error: "Logout failed" },
      { status: 500 }
    );
  }
}
