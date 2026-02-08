import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { storeState } from "@/lib/state-store";

const IDP_SERVER = process.env.NEXT_PUBLIC_IDP_SERVER || "http://localhost:3000";
const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID || "client-b";
const REDIRECT_URI = process.env.NEXT_PUBLIC_REDIRECT_URI || "http://localhost:3002/api/auth/callback";

/**
 * GET /api/auth/silent-login
 * 
 * Initiates a silent login flow by redirecting to IDP's authorize endpoint.
 * If user has a valid IDP session, they will be auto-approved.
 * If not, they will see the IDP login form.
 * 
 * This is called from the login page on initial load to attempt auto-login
 * without requiring user interaction.
 */
export async function GET(request: NextRequest) {
  try {
    console.log("[/api/auth/silent-login] Initiating silent login...");

    // Generate state for CSRF protection
    const state = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    storeState(state);

    // Generate PKCE
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");

    console.log("[/api/auth/silent-login] ✅ PKCE and state generated");

    // Build authorize URL
    const authorizeUrl = new URL("/api/auth/authorize", IDP_SERVER);
    authorizeUrl.searchParams.set("client_id", CLIENT_ID);
    authorizeUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("scope", "profile email");
    authorizeUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("code_challenge", challenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");

    console.log("[/api/auth/silent-login] Redirecting to IDP authorize...");

    // Create redirect response with PKCE verifier cookie
    const response = NextResponse.redirect(authorizeUrl.toString());
    response.cookies.set({
      name: "pkce_verifier",
      value: verifier,
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 300, // 5 minutes
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[/api/auth/silent-login] Error:", error);
    return NextResponse.json(
      { error: "Failed to initiate silent login" },
      { status: 500 }
    );
  }
}
