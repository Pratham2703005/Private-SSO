import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { storeState } from "@/lib/state-store";

const IDP_SERVER = process.env.NEXT_PUBLIC_IDP_SERVER || "http://localhost:3000";
const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID || "client-c";
const REDIRECT_URI = process.env.NEXT_PUBLIC_REDIRECT_URI || "http://localhost:3003/api/auth/callback";

export async function GET(request: NextRequest) {
  try {
    console.log("[AuthStart] 🔐 Generating PKCE and authorization URL...");

    // Generate state for CSRF protection
    const state = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    storeState(state);

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
    authorizeUrl.searchParams.set("scope", "profile email");
    authorizeUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("code_challenge", challenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");

    console.log("[AuthStart] 🔗 Authorize URL built");

    // Create response with redirect URL
    const response = NextResponse.json({
      url: authorizeUrl.toString(),
    });

    // ✅ Store PKCE verifier in HttpOnly cookie (secure, XSS-safe)
    response.cookies.set({
      name: "pkce_verifier",
      value: verifier,
      httpOnly: true,  // ✅ SECURE - not accessible to JS
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 300, // 5 minutes
      path: "/",
    });

    console.log("[AuthStart] 🍪 pkce_verifier cookie set (HttpOnly, 5 min TTL)");

    return response;
  } catch (error) {
    console.error("[AuthStart] ❌ Error:", error);
    return NextResponse.json(
      { error: "Failed to start authorization" },
      { status: 500 }
    );
  }
}
