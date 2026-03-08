import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { storeState } from "@/lib/state-store";

const IDP_SERVER = process.env.NEXT_PUBLIC_IDP_SERVER!;
const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID!;
const REDIRECT_URI = process.env.NEXT_PUBLIC_REDIRECT_URI!;
const isProduction = process.env.NODE_ENV === "production";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const prompt = searchParams.get('prompt'); // 'login' = force login page
    
    console.log("[AuthStart] 🔐 Generating PKCE and authorization URL...", email ? `for ${email}` : '', prompt ? `prompt=${prompt}` : '');

    // Generate state for CSRF protection
    const state = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Generate PKCE
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");

    console.log("[AuthStart] ✅ PKCE generated");
    console.log("[AuthStart]   Verifier length:", verifier.length);
    console.log("[AuthStart]   Challenge length:", challenge.length);

    // Build authorize URL
    const authorizeUrl = new URL("/api/auth/authorize", IDP_SERVER);
    authorizeUrl.searchParams.set("client_id", CLIENT_ID);
    authorizeUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("scope", "openid profile email");
    authorizeUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("code_challenge", challenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
    
    // Pass email as login_hint if provided
    if (email) {
      authorizeUrl.searchParams.set("login_hint", email);
    }

    // Pass prompt if provided (e.g., 'login' to force login page)
    if (prompt) {
      authorizeUrl.searchParams.set("prompt", prompt);
    }

    console.log("[AuthStart] 🔗 Authorize URL built");

    // Create response with authorize URL JSON
    const response = NextResponse.json({
      url: authorizeUrl.toString(),
    });

    // Store CSRF state in signed HttpOnly cookie (production-safe: survives instance restarts/load balancing)
    storeState(state, response);

    // ✅ Store PKCE verifier in HttpOnly cookie (secure, XSS-safe)
    response.cookies.set({
      name: "pkce_verifier",
      value: verifier,
      httpOnly: true,  // ✅ SECURE - not accessible to JS
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 300, // 5 minutes
      path: "/",
    });

    console.log(
      `[AuthStart] 🍪 OAuth state + PKCE cookies set (sameSite=${isProduction ? "none" : "lax"}, secure=${isProduction})`
    );

    return response;
  } catch (error) {
    console.error("[AuthStart] ❌ Error:", error);
    return NextResponse.json(
      { error: "Failed to start authorization" },
      { status: 500 }
    );
  }
}
