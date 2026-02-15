import { NextRequest, NextResponse } from "next/server";

const IDP_SERVER = process.env.NEXT_PUBLIC_IDP_SERVER || "http://localhost:3000";

/**
 * GET /api/me
 * 
 * Validate session and return user profile
 * Called by frontend to check if user is logged in and get current account data
 * 
 * Critical: Client backend must forward IDP cookies to IDP server-to-server call
 * - Browser does NOT auto-send cookies on server-to-server fetch
 * - We manually extract Cookie header from incoming request and forward it
 * 
 * Flow:
 * 1. Browser has both app_session_c cookie (this domain) + __sso_session cookie (from IDP)
 * 2. Browser sends both cookies to GET /api/me
 * 3. Client backend extracts Cookie header from request
 * 4. Client backend forwards Cookie header to IDP POST /api/auth/session/validate
 * 5. IDP server reads __sso_session from forwarded cookies
 * 6. IDP returns user data and new CSRF token
 * 7. Browser receives Set-Cookie header with new __csrf and updates it
 * 
 * Security:
 * - Session binding prevents stolen tokens from being used on different device
 * - CSRF tokens refreshed with each validate call
 */
export async function GET(request: NextRequest) {
  try {
    // Check if app_session_c cookie exists
    const appSessionCookie = request.cookies.get("app_session_c")?.value;

    if (!appSessionCookie) {
      return NextResponse.json(
        { authenticated: false, error: "No session cookie" },
        { status: 401 }
      );
    }

    // CRITICAL: Forward Cookie header to IDP server-to-server
    // Browser does not auto-send cookies on fetch() - we must do it manually
    const cookieHeader = request.headers.get("cookie") || "";

    // Call IDP session validate endpoint
    const validateResponse = await fetch(`${IDP_SERVER}/api/auth/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Forward cookies from this request to IDP
        // This includes __sso_session, __csrf, and any other IDP cookies
        "Cookie": cookieHeader,
        // Forward User-Agent for session binding validation
        "User-Agent": request.headers.get("user-agent") || "",
      },
      body: JSON.stringify({
        _csrf: request.cookies.get("__csrf")?.value || "",
      }),
    });

    if (!validateResponse.ok) {
      if (validateResponse.status === 401) {
        return NextResponse.json(
          { authenticated: false, error: "Session invalid or expired" },
          { status: 401 }
        );
      }
      const error = await validateResponse.json().catch(() => ({}));
      return NextResponse.json(
        { authenticated: false, error: error.error || "Validation failed" },
        { status: 401 }
      );
    }

    const validateData = await validateResponse.json();

    if (!validateData.success) {
      return NextResponse.json(
        { authenticated: false, error: validateData.error },
        { status: 401 }
      );
    }

    // Build response with user data and account list
    const response = NextResponse.json({
      authenticated: true,
      user: validateData.user,
      account: validateData.account,
      accounts: validateData.accounts,
      activeAccountId: validateData.activeAccountId,
    });

    // Forward IDP Set-Cookie headers to client
    // This updates __csrf and other IDP cookies on browser
    const setCookieHeaders = validateResponse.headers.getSetCookie();
    if (setCookieHeaders && setCookieHeaders.length > 0) {
      for (const setCookie of setCookieHeaders) {
        response.headers.append("Set-Cookie", setCookie);
      }
    }

    return response;
  } catch (error) {
    console.error("[/api/me] Error:", error);
    return NextResponse.json(
      { authenticated: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
