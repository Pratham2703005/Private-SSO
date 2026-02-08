import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { storeState } from "@/lib/state-store";

const IDP_SERVER = process.env.NEXT_PUBLIC_IDP_SERVER || "http://localhost:3000";
const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID || "client-a";
const REDIRECT_URI = process.env.NEXT_PUBLIC_REDIRECT_URI || "http://localhost:3001/api/auth/callback";

/**
 * GET /api/accounts/add
 *
 * Initiates an account adding flow by redirecting to IDP login.
 * After login, the user is returned to the app with a new account.
 */
export async function GET(request: NextRequest) {
  try {
    console.log("[/api/accounts/add] Initiating add account flow...");

    // Generate state and PKCE for the OAuth flow
    const state = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    storeState(state);

    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");

    // Build authorize URL with force_login parameter
    const authorizeUrl = new URL("/api/auth/authorize", IDP_SERVER);
    authorizeUrl.searchParams.set("client_id", CLIENT_ID);
    authorizeUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("scope", "profile email");
    authorizeUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("code_challenge", challenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
    authorizeUrl.searchParams.set("force_login", "true"); // Force fresh login

    console.log("[/api/accounts/add] Redirecting to IDP authorize");

    // Create response with PKCE verifier cookie
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
    console.error("[/api/accounts/add] Error:", error);
    return NextResponse.redirect(
      new URL("/dashboard?error=add_account_failed", request.nextUrl.origin)
    );
  }
}
