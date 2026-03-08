import { NextRequest, NextResponse } from "next/server";
import { getMasterCookie } from "@/lib/utils";
import {
  getSession,
  getUserById,
  getUserAccounts,
  getAccountById,
  getOAuthClient,
  createAuthorizationCode,
} from "@/lib/db";

// CORS headers for cross-origin SSO requests
function addCorsHeaders(response: NextResponse, request: NextRequest): NextResponse {
  const origin = request.headers.get("origin");
  
  // Allow requests from localhost and any port (for development)
  // In production, you should whitelist specific domains
  if (origin && origin.includes("localhost")) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }
  
  return response;
}

// Handle CORS preflight requests
export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response, request);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("client_id");
    const redirectUri = searchParams.get("redirect_uri");
    const scopes = searchParams.get("scopes")!;
    const state = searchParams.get("state")!;
    const codeChallenge = searchParams.get("code_challenge");
    const ttlSecondsParam = searchParams.get("ttl_seconds"); // For testing
    const ttlSeconds = ttlSecondsParam ? parseInt(ttlSecondsParam, 10) : 600; // Default 10 minutes
    const prompt = searchParams.get("prompt"); // "none" for silent auth

    if (!clientId || !redirectUri) {
      const errorResponse = NextResponse.json(
        { success: false, error: "Missing client_id or redirect_uri" },
        { status: 400 }
      );
      return addCorsHeaders(errorResponse, request);
    }

    // ============================================================================
    // STAGE 2: Validate OAuth Client
    // ============================================================================
    const oauthClient = await getOAuthClient(clientId);

    if (!oauthClient) {
      const errorResponse = NextResponse.json(
        { success: false, error: "invalid_client", error_description: "Client not found" },
        { status: 400 }
      );
      return addCorsHeaders(errorResponse, request);
    }

    if (!oauthClient.is_active) {
      const errorResponse = NextResponse.json(
        { success: false, error: "invalid_client", error_description: "Client is inactive" },
        { status: 400 }
      );
      return addCorsHeaders(errorResponse, request);
    }

    // Validate redirect_uri is in the allowed list
    const allowedRedirectUris = oauthClient.allowed_redirect_uris || [];
    const isRedirectUriAllowed = allowedRedirectUris.includes(redirectUri);

    if (!isRedirectUriAllowed) {
      const errorResponse = NextResponse.json(
        { success: false, error: "invalid_redirect_uri", error_description: "Redirect URI not allowed" },
        { status: 400 }
      );
      return addCorsHeaders(errorResponse, request);
    }

    // Check for master cookie (existing session)
    const sessionId = getMasterCookie(request);

    // prompt=login means the user explicitly wants the login page (re-auth, add account)
    // Skip auto-approval even if there's a valid session
    if (prompt === 'login') {
    } else if (sessionId) {
      // User is logged in, fetch session
      const session = await getSession(sessionId);

      if (session && session.expires_at > new Date().toISOString()) {
        // Session is valid, generate authorization code
        // Use the active account (set by login/switch) — NOT the primary account by user_id
        // This correctly handles multi-user sessions (Account A = user1, Account B = user2)
        const activeAccountId = session.active_account_id;
        let activeAccount = null;

        if (activeAccountId) {
          activeAccount = await getAccountById(activeAccountId);
        }

        // Fallback to legacy behavior if active_account_id not set
        if (!activeAccount) {
          const accounts = await getUserAccounts(session.user_id);
          activeAccount = accounts.find((acc) => acc.is_primary) || accounts[0];
        }

        if (!activeAccount) {
          const errorResponse = NextResponse.json(
            { success: false, error: "No account found" },
            { status: 500 }
          );
          return addCorsHeaders(errorResponse, request);
        }

        // Get the user who owns this account
        const user = await getUserById(activeAccount.user_id || session.user_id);
        
        if (!user) {
          const errorResponse = NextResponse.json(
            { success: false, error: "User not found" },
            { status: 404 }
          );
          return addCorsHeaders(errorResponse, request);
        }

        // Stage 3: Generate authorization code instead of access token
        const scopesArray = scopes.split(",").map((s) => s.trim());

        const authCode = await createAuthorizationCode(
          user.id,  // Use the user who owns the active account
          clientId,
          redirectUri,
          codeChallenge,
          state,
          scopesArray,
          ttlSeconds
        );

        if (!authCode) {
          const errorResponse = NextResponse.json(
            { success: false, error: "Failed to generate authorization code" },
            { status: 500 }
          );
          return addCorsHeaders(errorResponse, request);
        }

        // For prompt=none (silent auth), return JSON response
        if (prompt === 'none') {
          const response = NextResponse.json(
            { code: authCode, state },
            { status: 200 }
          );
          return addCorsHeaders(response, request);
        }

        // Redirect back to client with code + state (NO access_token in URL)
        const callbackUrl = new URL(redirectUri);
        callbackUrl.searchParams.set("code", authCode);
        callbackUrl.searchParams.set("state", state);

        return NextResponse.redirect(callbackUrl);
      }
    }

    // For prompt=none (silent auth fail), return 401 instead of redirect to login
    if (prompt === 'none') {
      const errorResponse = NextResponse.json(
        { success: false, error: 'No valid session', error_description: 'prompt=none but no active session' },
        { status: 401 }
      );
      return addCorsHeaders(errorResponse, request);
    }
    
    // Redirect to login with return params (including code_challenge for PKCE)
    const loginUrl = new URL("/login", request.nextUrl.origin);
    loginUrl.searchParams.set("client_id", clientId);
    loginUrl.searchParams.set("redirect_uri", redirectUri);
    loginUrl.searchParams.set("scopes", scopes);
    loginUrl.searchParams.set("state", state);
    
    // Preserve code_challenge if provided
    if (codeChallenge) {
      loginUrl.searchParams.set("code_challenge", codeChallenge);
    }

    // Preserve code_challenge_method if provided
    const codeChallengeMethod = searchParams.get("code_challenge_method");
    if (codeChallengeMethod) {
      loginUrl.searchParams.set("code_challenge_method", codeChallengeMethod);
    }

    // Pass login_hint (email) if provided
    const loginHint = searchParams.get("login_hint");
    if (loginHint) {
      loginUrl.searchParams.set("login_hint", loginHint);
    }

    return NextResponse.redirect(loginUrl);
  } catch (error) {
    console.error("Authorize error:", error);
    const errorResponse = NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
    return addCorsHeaders(errorResponse, request);
  }
}
