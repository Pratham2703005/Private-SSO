import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { storeAccessToken, storeRefreshToken } from "@/lib/session-store";

const IDP_SERVER = process.env.NEXT_PUBLIC_IDP_SERVER || "http://localhost:3000";

/**
 * GET /api/auth/silent-login
 *
 * Silent login after account switch on IDP.
 * Attempts to get tokens silently using existing IDP session.
 * Called by widget after user switches accounts.
 *
 * Flow:
 * 1. Calls IDP /api/auth/get-token (checks for valid IDP session)
 * 2. If success: exchanges for tokens, stores in httpOnly cookies, redirects to /dashboard
 * 3. If failure (401): redirects to /login
 */
export async function GET(request: NextRequest) {
  try {
    console.log("[/api/auth/silent-login] Attempting silent login after account switch...");

    // Call IDP to get tokens using existing IDP session
    const tokenResponse = await fetch(`${IDP_SERVER}/api/auth/get-token`, {
      method: "GET",
      headers: {
        // Pass all cookies from request (includes IDP session cookie)
        Cookie: request.headers.get("cookie") || "",
      },
    });

    if (!tokenResponse.ok) {
      console.log("[/api/auth/silent-login] ❌ No valid IDP session (HTTP", tokenResponse.status, ")");
      // Redirect with error param to prevent infinite loop
      const loginUrl = new URL("/login", request.nextUrl.origin);
      loginUrl.searchParams.set("error", "no_idp_session");
      return NextResponse.redirect(loginUrl);
    }

    const tokens = await tokenResponse.json() as {
      access_token: string;
      refresh_token?: string;
      id_token?: string;
    };

    if (!tokens.access_token) {
      console.log("[/api/auth/silent-login] ❌ No access token in response");
      const loginUrl = new URL("/login", request.nextUrl.origin);
      loginUrl.searchParams.set("error", "no_tokens");
      return NextResponse.redirect(loginUrl);
    }

    console.log("[/api/auth/silent-login] ✅ Got tokens from IDP");

    // Generate session ID and store tokens
    const sessionId = randomBytes(32).toString("hex");
    await storeAccessToken(sessionId, tokens.access_token);
    if (tokens.refresh_token) {
      await storeRefreshToken(sessionId, tokens.refresh_token);
    }

    // Decode id_token to get user info
    let userId = "unknown";
    if (tokens.id_token) {
      try {
        const idTokenParts = tokens.id_token.split(".");
        const decodedIdToken = JSON.parse(Buffer.from(idTokenParts[1], "base64").toString());
        userId = decodedIdToken.sub;
      } catch (e) {
        console.log("[/api/auth/silent-login] ⚠️ Failed to decode id_token");
      }
    }

    // Create response and redirect to dashboard
    const response = NextResponse.redirect(new URL("/dashboard", request.nextUrl.origin));

    // Set app_session cookie with token holder reference
    response.cookies.set({
      name: "app_session",
      value: JSON.stringify({
        sessionId,
        userId,
        issuedAt: Date.now(),
      }),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60, // 1 day
      path: "/",
    });

    console.log("[/api/auth/silent-login] ✅ Silent login successful, redirecting to dashboard");
    return response;
  } catch (error) {
    console.error("[/api/auth/silent-login] ❌ Error:", error);
    const loginUrl = new URL("/login", request.nextUrl.origin);
    loginUrl.searchParams.set("error", "silent_login_error");
    return NextResponse.redirect(loginUrl);
  }
}
