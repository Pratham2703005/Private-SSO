import { NextRequest, NextResponse } from "next/server";
import { getMasterCookie } from "@/lib/utils";
import { addWidgetCorsHeaders } from "@/lib/cors-utils";
import {
  getSession,
  getUserById,
  getUserAccounts,
  getAccountById,
  getOAuthClient,
  createAuthorizationCode,
} from "@/lib/db";

// Handle CORS preflight requests
export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addWidgetCorsHeaders(response, request);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("client_id");
    const redirectUri = searchParams.get("redirect_uri");
    // ✅ OAuth 2.0 uses "scope" (singular), not "scopes"
    const scope = searchParams.get("scope");
    const state = searchParams.get("state")!;
    const codeChallenge = searchParams.get("code_challenge");
    const codeChallengeMethod = searchParams.get("code_challenge_method");
    const ttlSecondsParam = searchParams.get("ttl_seconds"); // For testing
    const ttlSeconds = ttlSecondsParam ? parseInt(ttlSecondsParam, 10) : 600; // Default 10 minutes
    const prompt = searchParams.get("prompt"); // "none" for silent auth

    if (!clientId || !redirectUri) {
      const errorResponse = NextResponse.json(
        { success: false, error: "Missing client_id or redirect_uri" },
        { status: 400 }
      );
      return addWidgetCorsHeaders(errorResponse, request);
    }

    // ✅ Validate scope is present
    if (!scope || scope.trim().length === 0) {
      const errorResponse = NextResponse.json(
        { success: false, error: "invalid_request", error_description: "scope parameter is required" },
        { status: 400 }
      );
      return addWidgetCorsHeaders(errorResponse, request);
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
      return addWidgetCorsHeaders(errorResponse, request);
    }

    if (!oauthClient.is_active) {
      const errorResponse = NextResponse.json(
        { success: false, error: "invalid_client", error_description: "Client is inactive" },
        { status: 400 }
      );
      return addWidgetCorsHeaders(errorResponse, request);
    }

    // Validate redirect_uri is in the allowed list
    const allowedRedirectUris = oauthClient.allowed_redirect_uris || [];
    const isRedirectUriAllowed = allowedRedirectUris.includes(redirectUri);

    if (!isRedirectUriAllowed) {
      const errorResponse = NextResponse.json(
        { success: false, error: "invalid_redirect_uri", error_description: "Redirect URI not allowed" },
        { status: 400 }
      );
      return addWidgetCorsHeaders(errorResponse, request);
    }

    // ============================================================================
    // STAGE 2B: Validate Scopes (OIDC + OAuth 2.0 compliance)
    // ============================================================================
    
    // Parse scopes from request (OAuth 2.0 uses space-separated scopes)
    const requestedScopes = scope.split(" ").map((s) => s.trim()).filter(Boolean);

    // ✅ MANDATORY: openid scope must be present (OIDC requirement)
    if (!requestedScopes.includes("openid")) {
      const errorResponse = NextResponse.json(
        { success: false, error: "invalid_scope", error_description: "The 'openid' scope is mandatory" },
        { status: 400 }
      );
      return addWidgetCorsHeaders(errorResponse, request);
    }

    // ✅ Validate requested scopes against client's allowed scopes
    const allowedScopes = oauthClient.allowed_scopes
      ? oauthClient.allowed_scopes.split(",").map((s: string) => s.trim())
      : [];
    
    const invalidScopes = requestedScopes.filter((scope) => !allowedScopes.includes(scope));
    if (invalidScopes.length > 0) {
      const errorResponse = NextResponse.json(
        {
          success: false,
          error: "invalid_scope",
          error_description: `Client is not authorized for the following scopes: ${invalidScopes.join(", ")}`,
        },
        { status: 400 }
      );
      return addWidgetCorsHeaders(errorResponse, request);
    }

    // ✅ Validate code_challenge format (if provided) - PKCE security requirement
    if (codeChallenge) {
      const codeChallengeRegex = /^[A-Za-z0-9_-]{43,128}$/;
      if (!codeChallengeRegex.test(codeChallenge)) {
        const errorResponse = NextResponse.json(
          {
            success: false,
            error: "invalid_request",
            error_description: "Invalid code_challenge format. Must be 43-128 base64url characters",
          },
          { status: 400 }
        );
        return addWidgetCorsHeaders(errorResponse, request);
      }

      // ✅ Validate code_challenge_method - RFC 7636 only supports S256
      if (codeChallengeMethod && codeChallengeMethod !== "S256") {
        const errorResponse = NextResponse.json(
          {
            success: false,
            error: "invalid_request",
            error_description: "Only 'S256' code_challenge_method is supported",
          },
          { status: 400 }
        );
        return addWidgetCorsHeaders(errorResponse, request);
      }
    }

    // ✅ Validate ttl_seconds bounds (300-3600 seconds / 5 minutes to 1 hour)
    const MIN_TTL = 300;
    const MAX_TTL = 3600;
    if (ttlSeconds < MIN_TTL || ttlSeconds > MAX_TTL) {
      const errorResponse = NextResponse.json(
        {
          success: false,
          error: "invalid_request",
          error_description: `ttl_seconds must be between ${MIN_TTL} and ${MAX_TTL} seconds`,
        },
        { status: 400 }
      );
      return addWidgetCorsHeaders(errorResponse, request);
    }

    // Check for master cookie (existing session)
    const sessionId = getMasterCookie(request);

    // prompt=login/signup means the user explicitly wants an auth screen.
    // Skip auto-approval even if there's a valid session.
    if (prompt === 'login' || prompt === 'signup') {
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
          return addWidgetCorsHeaders(errorResponse, request);
        }

        // Get the user who owns this account
        const user = await getUserById(activeAccount.user_id || session.user_id);
        
        if (!user) {
          const errorResponse = NextResponse.json(
            { success: false, error: "User not found" },
            { status: 404 }
          );
          return addWidgetCorsHeaders(errorResponse, request);
        }

        // Stage 3: Generate authorization code instead of access token
        // Use the already-validated requestedScopes from STAGE 2B
        const authCode = await createAuthorizationCode(
          user.id,  // Use the user who owns the active account
          clientId,
          redirectUri,
          codeChallenge,
          state,
          requestedScopes,
          ttlSeconds
        );

        if (!authCode) {
          const errorResponse = NextResponse.json(
            { success: false, error: "Failed to generate authorization code" },
            { status: 500 }
          );
          return addWidgetCorsHeaders(errorResponse, request);
        }

        // For prompt=none (silent auth), return JSON response
        if (prompt === 'none') {
          const response = NextResponse.json(
            { code: authCode, state },
            { status: 200 }
          );
          return addWidgetCorsHeaders(response, request);
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
      return addWidgetCorsHeaders(errorResponse, request);
    }
    
    // Redirect to login/signup with return params (including code_challenge for PKCE)
    const authPagePath = prompt === 'signup' ? '/signup' : '/login';
    const authUrl = new URL(authPagePath, request.nextUrl.origin);
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("state", state);
    
    // Preserve code_challenge if provided
    if (codeChallenge) {
      authUrl.searchParams.set("code_challenge", codeChallenge);
    }

    // Preserve code_challenge_method if provided
    if (codeChallengeMethod) {
      authUrl.searchParams.set("code_challenge_method", codeChallengeMethod);
    }

    // Pass login_hint (email) if provided
    const loginHint = searchParams.get("login_hint");
    if (loginHint) {
      authUrl.searchParams.set("login_hint", loginHint);
    }

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Authorize error:", error);
    const errorResponse = NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
    return addWidgetCorsHeaders(errorResponse, request);
  }
}
