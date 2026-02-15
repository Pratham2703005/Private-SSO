import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { validateState } from "@/lib/state-store";

const IDP_SERVER = process.env.NEXT_PUBLIC_IDP_SERVER || "http://localhost:3000";
const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID || "client-c";
const REDIRECT_URI =
  process.env.NEXT_PUBLIC_REDIRECT_URI || "http://localhost:3003/api/auth/callback";

/**
 * GET /api/auth/callback
 * 
 * OAuth2 callback endpoint
 * 1. Receives authorization code from IDP
 * 2. Exchanges code for tokens (server-to-server)
 * 3. Sets opaque app_session_c cookie (does NOT store tokens)
 * 4. Redirects to home page
 * 
 * New architecture: NO token storage on client
 * - Client stores only opaque session ID
 * - Tokens generated on-demand by IDP when needed
 * - Session state always validated via IDP backend call
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    // Validate CSRF state
    if (!state || !validateState(state)) {
      return NextResponse.redirect(
        new URL("/?error=csrf_validation_failed", request.nextUrl.origin)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL("/?error=missing_code", request.nextUrl.origin)
      );
    }

    // Get PKCE verifier from HttpOnly cookie
    const codeVerifier = request.cookies.get("pkce_verifier")?.value;
    if (!codeVerifier) {
      return NextResponse.redirect(
        new URL("/?error=missing_verifier", request.nextUrl.origin)
      );
    }

    // Exchange code for tokens (server-to-server)
    const tokenResponse = await fetch(`${IDP_SERVER}/api/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        code: code,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      return NextResponse.redirect(
        new URL(`/?error=${errorData.error || "exchange_failed"}`, request.nextUrl.origin)
      );
    }

    const tokens = await tokenResponse.json();
    
    // Create response that redirects to home
    const response = NextResponse.redirect(
      new URL("/", request.nextUrl.origin)
    );

    // Generate opaque session ID (NOT tied to tokens, just a reference)
    const sessionId = randomBytes(32).toString("hex");

    // NO TOKEN STORAGE - client doesn't store access_token or refresh_token
    // IDP manages all tokens, client only stores session reference
    response.cookies.set({
      name: "app_session_c",
      value: sessionId,
      httpOnly: true, // Opaque, not readable by JS
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", // CSRF protection
      maxAge: 24 * 60 * 60, // 1 day (should match IDP session cookie TTL)
      path: "/",
    });

    // Clear PKCE verifier
    response.cookies.delete("pkce_verifier");

    return response;
  } catch (error) {
    console.error("[Callback GET] Error:", error);
    return NextResponse.redirect(
      new URL("/?error=callback_error", request.nextUrl.origin)
    );
  }
}
