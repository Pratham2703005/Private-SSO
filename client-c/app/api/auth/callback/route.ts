import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { storeAccessToken, storeRefreshToken } from "@/lib/session-store";
import { validateState } from "@/lib/state-store";

const IDP_SERVER = process.env.NEXT_PUBLIC_IDP_SERVER || "http://localhost:3000";
const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID || "client-c";
const REDIRECT_URI =
  process.env.NEXT_PUBLIC_REDIRECT_URI || "http://localhost:3003/api/auth/callback";

// POST handler for testing - allows manually setting access/refresh tokens
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken, refreshToken } = body;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Missing accessToken" },
        { status: 400 }
      );
    }

    // Decode access token to get user info
    let userId = "";
    let userName = "";
    try {
      // JWT decode without validation (for testing)
      const parts = accessToken.split(".");
      const decodedToken = JSON.parse(
        Buffer.from(parts[1], "base64").toString()
      );
      userId = decodedToken.sub;
      userName = decodedToken.name || decodedToken.email || "User";
    } catch (err) {
      console.error("[Callback POST] Failed to decode token:", err);
      return NextResponse.json(
        { error: "Invalid token format" },
        { status: 400 }
      );
    }

    // Create response
    const response = NextResponse.json({ success: true });

    // Generate session ID
    const sessionId = randomBytes(32).toString("hex");

    // Store tokens server-side
    await storeAccessToken(sessionId, accessToken);
    if (refreshToken) {
      await storeRefreshToken(sessionId, refreshToken);
    }

    // ✅ Set app_session cookie with HttpOnly + Secure + SameSite
    const sessionData = {
      sessionId,
      userId,
      userName,
      issuedAt: Date.now(),
    };

    response.cookies.set({
      name: "app_session",
      value: JSON.stringify(sessionData),
      httpOnly: true,  // ✅ SECURE - not accessible to JS
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",  // ✅ CSRF protection
      maxAge: 24 * 60 * 60, // 1 day
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[Callback POST] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log("[Callback] 🔄 Processing callback...");
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    // Validate CSRF state
    if (!state || !validateState(state)) {
      console.log("[Callback] ❌ CSRF state validation failed");
      return NextResponse.redirect(
        new URL("/?error=csrf_validation_failed", request.nextUrl.origin)
      );
    }

    if (!code) {
      console.log("[Callback] ❌ No authorization code in query params");
      return NextResponse.redirect(
        new URL("/?error=missing_code", request.nextUrl.origin)
      );
    }

    console.log("[Callback] ✅ State validated, code received");
    console.log("[Callback]   Code:", code.substring(0, 8) + "...");

    // Read PKCE verifier from HttpOnly cookie
    const codeVerifier = request.cookies.get("pkce_verifier")?.value;

    if (!codeVerifier) {
      console.log("[Callback] ❌ PKCE verifier not found in cookie");
      return NextResponse.redirect(
        new URL("/?error=missing_verifier", request.nextUrl.origin)
      );
    }

    console.log("[Callback] ✅ PKCE verifier retrieved from HttpOnly cookie");
    console.log("[Callback]   Verifier length:", codeVerifier.length);

    // Exchange code for tokens (server-to-server)
    console.log("[Callback] 🔄 Exchanging code for tokens...");

    let accessToken: string;
    let idToken: string;
    let refreshToken: string;
    let userId: string;
    let userName: string;

    try {
      const tokenResponse = await fetch(`${IDP_SERVER}/api/auth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id: CLIENT_ID,
          redirect_uri: REDIRECT_URI,
          code: code,
          code_verifier: codeVerifier,
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        console.log("[Callback] ❌ Token exchange failed:");
        console.log("[Callback]   Status:", tokenResponse.status);
        console.log("[Callback]   Error:", errorData.error);

        const errorCode = errorData.error || "invalid_grant";
        return NextResponse.redirect(
          new URL(
            `/?error=${errorCode}`,
            request.nextUrl.origin
          )
        );
      }

      const tokens = await tokenResponse.json();
      accessToken = tokens.access_token;
      idToken = tokens.id_token;
      refreshToken = tokens.refresh_token;

      console.log("[Callback] ✅ Token exchange successful");

      // Decode id_token to get user info
      const idTokenParts = idToken.split(".");
      const decodedIdToken = JSON.parse(
        Buffer.from(idTokenParts[1], "base64").toString()
      );
      userId = decodedIdToken.sub;
      userName = decodedIdToken.name || decodedIdToken.email || "User";

      console.log("[Callback] 📋 ID Token decoded:");
      console.log("[Callback]   Full payload:", JSON.stringify(decodedIdToken, null, 2));
      console.log("[Callback]   User ID:", userId.substring(0, 8) + "...");
      console.log("[Callback]   User Name:", userName);
    } catch (error) {
      console.error("[Callback] ❌ Error exchanging code:", error);
      return NextResponse.redirect(
        new URL("/?error=exchange_failed", request.nextUrl.origin)
      );
    }

    // Create response that redirects to home
    const response = NextResponse.redirect(
      new URL("/", request.nextUrl.origin)
    );

    // Generate a unique session ID
    const sessionId = randomBytes(32).toString("hex");
    console.log("[Callback] 📝 Generated sessionId:", sessionId.substring(0, 8) + "...");

    // Store tokens server-side (NOT in cookies)
    await storeAccessToken(sessionId, accessToken);
    console.log("[Callback] 💾 Access token stored server-side");

    if (refreshToken) {
      await storeRefreshToken(sessionId, refreshToken);
      console.log("[Callback] 💾 Refresh token stored server-side");
    }

    // ✅ Set app_session cookie with HttpOnly + Secure + SameSite
    const sessionData = {
      sessionId,
      userId,
      userName,
      issuedAt: Date.now(),
    };

    console.log("[Callback] 🍪 Setting app_session cookie (HttpOnly)...");

    response.cookies.set({
      name: "app_session",
      value: JSON.stringify(sessionData),
      httpOnly: true,  // ✅ SECURE - not accessible to JS
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",  // ✅ CSRF protection
      maxAge: 24 * 60 * 60, // 1 day
      path: "/",
    });

    // ✅ Clear the PKCE verifier cookie after use
    response.cookies.delete("pkce_verifier");
    console.log("[Callback] 🗑️  Cleaned up pkce_verifier cookie");

    console.log("[Callback] ✅ Redirecting to home");
    return response;
  } catch (error) {
    console.error("[Callback] ❌ Unexpected error:", error);
    return NextResponse.redirect(
      new URL("/?error=callback_error", request.nextUrl.origin)
    );
  }
}
