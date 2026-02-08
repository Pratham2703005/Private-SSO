import { NextRequest, NextResponse } from "next/server";
import { getMasterCookie, generateState, hashToken } from "@/lib/utils";
import {
  getSession,
  getUserById,
  getUserAccounts,
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
    const scopes = searchParams.get("scopes") || "profile,email";
    const state = searchParams.get("state") || generateState();
    const codeChallenge = searchParams.get("code_challenge");
    const ttlSecondsParam = searchParams.get("ttl_seconds"); // For testing
    const ttlSeconds = ttlSecondsParam ? parseInt(ttlSecondsParam, 10) : 600; // Default 10 minutes

    // Debug logging
    console.log('[Authorize] Request received');
    console.log('[Authorize] CODE_CHALLENGE from query:', {
      codeChallenge: codeChallenge,
      codeChallenge_length: codeChallenge ? codeChallenge.length : 0,
      codeChallenge_first_20: codeChallenge ? codeChallenge.substring(0, 20) + "..." : "(null)",
      codeChallenge_type: typeof codeChallenge,
    });
    console.log('[Authorize] Query params:', {
      clientId,
      redirectUri,
      scopes,
      codeChallenge,
      ttlSeconds,
    });
    
    const allCookies = request.cookies.getAll();
    console.log('[Authorize] Incoming cookies:', allCookies.map(c => ({
      name: c.name,
      valuePreview: c.value ? c.value.substring(0, 16) + "..." : "EMPTY",
    })));

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
    console.log('[Authorize] Validating OAuth client:', clientId);
    const oauthClient = await getOAuthClient(clientId);
    console.log('[Authorize] OAuth client result:', oauthClient ? 'found' : 'not found');

    if (!oauthClient) {
      console.log('[Authorize] Client not found:', clientId);
      const errorResponse = NextResponse.json(
        { success: false, error: "invalid_client", error_description: "Client not found" },
        { status: 400 }
      );
      return addCorsHeaders(errorResponse, request);
    }

    console.log('[Authorize] Client is_active:', oauthClient.is_active);
    if (!oauthClient.is_active) {
      console.log('[Authorize] Client is inactive:', clientId);
      const errorResponse = NextResponse.json(
        { success: false, error: "invalid_client", error_description: "Client is inactive" },
        { status: 400 }
      );
      return addCorsHeaders(errorResponse, request);
    }

    // Validate redirect_uri is in the allowed list
    const allowedRedirectUris = oauthClient.allowed_redirect_uris || [];
    console.log('[Authorize] Allowed redirect URIs:', allowedRedirectUris);
    console.log('[Authorize] Requested redirect URI:', redirectUri);
    const isRedirectUriAllowed = allowedRedirectUris.includes(redirectUri);

    if (!isRedirectUriAllowed) {
      console.log('[Authorize] Invalid redirect_uri:', redirectUri, 'Allowed:', allowedRedirectUris);
      const errorResponse = NextResponse.json(
        { success: false, error: "invalid_redirect_uri", error_description: "Redirect URI not allowed" },
        { status: 400 }
      );
      return addCorsHeaders(errorResponse, request);
    }

    console.log('[Authorize] OAuth client validation passed:', clientId);

    // Check for master cookie (existing session)
    const sessionId = getMasterCookie(request);
    console.log('[Authorize] Master cookie check:', {
      found: !!sessionId,
      sessionId: sessionId ? sessionId.substring(0, 16) + "..." : "NOT_FOUND",
    });

    if (sessionId) {
      // User is logged in, fetch session
      const session = await getSession(sessionId);
      console.log('[Authorize] Session found:', !!session);

      if (session && session.expires_at > new Date().toISOString()) {
        // Session is valid, generate authorization code
        const user = await getUserById(session.user_id);
        console.log('[Authorize] User found:', !!user);
        
        if (!user) {
          const errorResponse = NextResponse.json(
            { success: false, error: "User not found" },
            { status: 404 }
          );
          return addCorsHeaders(errorResponse, request);
        }

        const accounts = await getUserAccounts(session.user_id);
        console.log('[Authorize] Accounts found:', accounts.length);
        
        const primaryAccount =
          accounts.find((acc) => acc.is_primary) || accounts[0];

        console.log('[Authorize] Primary account:', !!primaryAccount);

        if (!primaryAccount) {
          const errorResponse = NextResponse.json(
            { success: false, error: "No account found" },
            { status: 500 }
          );
          return addCorsHeaders(errorResponse, request);
        }

        // Stage 3: Generate authorization code instead of access token
        const scopesArray = scopes.split(",").map((s) => s.trim());

        console.log('[Authorize] ABOUT TO CREATE AUTH CODE with codeChallenge:', {
          codeChallenge: codeChallenge,
          codeChallenge_length: codeChallenge ? codeChallenge.length : 0,
          codeChallenge_first_20: codeChallenge ? codeChallenge.substring(0, 20) + "..." : "(null or empty)",
        });

        const authCode = await createAuthorizationCode(
          session.user_id,
          clientId,
          redirectUri,
          codeChallenge, // Optional: PKCE can be provided but not required for backward compatibility
          state,
          scopesArray,
          ttlSeconds // Pass optional TTL from query param
        );

        console.log('[Authorize] auth code created:', {
          code: authCode ? authCode.substring(0, 20) + "..." : "(null)",
          codeChallenge_passed: codeChallenge ? "YES" : "NO",
        });

        if (!authCode) {
          const errorResponse = NextResponse.json(
            { success: false, error: "Failed to generate authorization code" },
            { status: 500 }
          );
          return addCorsHeaders(errorResponse, request);
        }

        console.log('[Authorize] Authorization code generated');

        // Redirect back to client with code + state (NO access_token in URL)
        const callbackUrl = new URL(redirectUri);
        callbackUrl.searchParams.set("code", authCode);
        callbackUrl.searchParams.set("state", state);

        console.log('[Authorize] Redirecting to callback:', callbackUrl.toString());

        return NextResponse.redirect(callbackUrl);
      }
    }

    // No valid session
    console.log('[Authorize] No valid session, redirecting to login');
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
