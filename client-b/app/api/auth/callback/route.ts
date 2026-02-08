import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { storeAccessToken, storeRefreshToken } from "@/lib/session-store";
import { validateState } from "@/lib/state-store";

const IDP_SERVER = process.env.NEXT_PUBLIC_IDP_SERVER || "http://localhost:3000";
const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID || "client-b";
const REDIRECT_URI =
  process.env.NEXT_PUBLIC_REDIRECT_URI || "http://localhost:3002/api/auth/callback";

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
    try {
      // JWT decode without validation (for testing)
      const parts = accessToken.split(".");
      const decodedToken = JSON.parse(
        Buffer.from(parts[1], "base64").toString()
      );
      userId = decodedToken.sub;
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

    // Set app_session cookie
    const sessionData = {
      sessionId,
      userId,
      issuedAt: Date.now(),
    };

    response.cookies.set({
      name: "app_session",
      value: JSON.stringify(sessionData),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
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
        new URL("/login?error=csrf_validation_failed", request.nextUrl.origin)
      );
    }

    if (!code) {
      console.log("[Callback] ❌ No authorization code in query params");
      return NextResponse.redirect(
        new URL("/login?error=missing_code", request.nextUrl.origin)
      );
    }

    console.log("[Callback] ✅ State validated, code received");
    console.log("[Callback]   Code:", code.substring(0, 8) + "...");

    // Read PKCE verifier from cookie
    const codeVerifier = request.cookies.get("pkce_verifier")?.value;

    if (!codeVerifier) {
      console.log("[Callback] ❌ PKCE verifier not found in cookie");
      return NextResponse.redirect(
        new URL("/login?error=missing_verifier", request.nextUrl.origin)
      );
    }

    console.log("[Callback] ✅ PKCE verifier retrieved from cookie");
    console.log("[Callback]   Verifier length:", codeVerifier.length);

    // Exchange code for tokens (server-to-server)
    console.log("[Callback] 🔄 Exchanging code for tokens...");

    let accessToken: string;
    let idToken: string;
    let refreshToken: string;
    let tokenType: string;
    let expiresIn: number;
    let userId: string;

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
        console.log("[Callback]   Description:", errorData.error_description);

        // Map IDP error codes to client error codes
        const errorCode = errorData.error || "invalid_grant";
        return NextResponse.redirect(
          new URL(
            `/login?error=${errorCode}&description=${encodeURIComponent(
              errorData.error_description || "Token exchange failed"
            )}`,
            request.nextUrl.origin
          )
        );
      }

      const tokens = await tokenResponse.json();
      accessToken = tokens.access_token;
      idToken = tokens.id_token;
      refreshToken = tokens.refresh_token;
      tokenType = tokens.token_type;
      expiresIn = tokens.expires_in;

      console.log("[Callback] ✅ Token exchange successful");
      console.log("[Callback]   Token type:", tokenType);
      console.log("[Callback]   Expires in:", expiresIn, "seconds");
      console.log("[Callback]   Refresh token received:", !!refreshToken);

      // Decode id_token to get user info (basic JWT decode without verification)
      const idTokenParts = idToken.split(".");
      const decodedIdToken = JSON.parse(
        Buffer.from(idTokenParts[1], "base64").toString()
      );
      userId = decodedIdToken.sub;

      console.log("[Callback] 📋 ID Token decoded");
      console.log("[Callback]   User ID:", userId.substring(0, 8) + "...");
    } catch (error) {
      console.error("[Callback] ❌ Error exchanging code:", error);
      return NextResponse.redirect(
        new URL(
          "/login?error=exchange_failed&description=" +
            encodeURIComponent("Failed to exchange code for tokens"),
          request.nextUrl.origin
        )
      );
    }

    // Create response that redirects to dashboard
    const response = NextResponse.redirect(
      new URL("/dashboard", request.nextUrl.origin)
    );

    // Create a unique session ID
    const sessionId = randomBytes(32).toString("hex");
    console.log("[Callback] 📝 Generated sessionId:", sessionId.substring(0, 8) + "...");

    // Store access token server-side (NOT in cookie)
    await storeAccessToken(sessionId, accessToken);
    console.log("[Callback] 💾 Access token stored server-side");

    // Store refresh token server-side (NOT in cookie)
    if (refreshToken) {
      await storeRefreshToken(sessionId, refreshToken);
      console.log("[Callback] 💾 Refresh token stored server-side");
    }

    // Set app_session cookie with only sessionId + userId (no secrets)
    const sessionData = {
      sessionId, // Only the session ID
      userId: userId, // User identifier from id_token
      issuedAt: Date.now(),
    };

    console.log("[Callback] 🍪 Setting app_session cookie...");

    response.cookies.set({
      name: "app_session",
      value: JSON.stringify(sessionData),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60, // 1 day
      path: "/",
    });

    // Clear the PKCE verifier cookie after use
    response.cookies.delete("pkce_verifier");
    console.log("[Callback] 🗑️  Cleaned up pkce_verifier cookie");

    console.log("[Callback] ✅ Redirecting to /dashboard");
    return response;
  } catch (error) {
    console.error("[Callback] ❌ Unexpected error:", error);
    return NextResponse.redirect(
      new URL("/login?error=callback_error", request.nextUrl.origin)
    );
  }
}
