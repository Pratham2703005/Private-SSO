import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  getAuthorizationCode,
  markAuthorizationCodeAsRedeemed,
  getUserById,
  getUserAccounts,
  storeRefreshToken,
  validateRefreshToken,
  rotateRefreshToken,
} from "@/lib/db";
import { generateAccessToken, generateIdToken } from "@/lib/jwt";

/**
 * POST /api/auth/token
 * 
 * OAuth2 Token Endpoint - Supports:
 * 1. Authorization Code + PKCE Token Exchange
 * 2. Refresh Token Grant (with token rotation)
 * 
 * Request (authorization_code):
 * {
 *   "grant_type": "authorization_code",
 *   "client_id": "string",
 *   "redirect_uri": "string",
 *   "code": "string",
 *   "code_verifier": "string"
 * }
 * 
 * Request (refresh_token):
 * {
 *   "grant_type": "refresh_token",
 *   "client_id": "string",
 *   "refresh_token": "string"
 * }
 * 
 * Response on success (200):
 * {
 *   "access_token": "jwt",
 *   "id_token": "jwt",
 *   "refresh_token": "jwt",
 *   "token_type": "Bearer",
 *   "expires_in": 86400
 * }
 * 
 * Response on error (400/500):
 * {
 *   "error": "error_code",
 *   "error_description": "string"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const grant_type = body.grant_type;

    console.log('[Token] Exchange request:', { grant_type });

    // Validate required params FIRST
    if (!grant_type) {
      console.log('[Token] Missing grant_type');
      return NextResponse.json(
        {
          error: "invalid_request",
          error_description: "Missing required parameter: grant_type",
        },
        { status: 400 }
      );
    }

    // Route to appropriate grant handler
    if (grant_type === "authorization_code") {
      return handleAuthorizationCodeGrant(body);
    } else if (grant_type === "refresh_token") {
      return handleRefreshTokenGrant(body);
    } else {
      console.log('[Token] Invalid grant_type:', grant_type);
      return NextResponse.json(
        {
          error: "unsupported_grant_type",
          error_description: "Only authorization_code and refresh_token grant types are supported",
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("[Token] Error:", error);
    return NextResponse.json(
      {
        error: "server_error",
        error_description: "An error occurred during token exchange",
      },
      { status: 500 }
    );
  }
}

/**
 * Handle authorization_code grant type
 * Exchanges authorization code + PKCE for tokens
 */
async function handleAuthorizationCodeGrant(body: {
  client_id?: string;
  redirect_uri?: string;
  code?: string;
  code_verifier?: string;
}) {
  try {
    const { client_id, redirect_uri, code, code_verifier } = body;

    // Validate required params for authorization_code grant
    if (!code || !code_verifier || !client_id || !redirect_uri) {
      console.log('[Token] Missing required parameters for authorization_code grant');
      return NextResponse.json(
        {
          error: "invalid_request",
          error_description: "Missing required parameters: code, code_verifier, client_id, redirect_uri",
        },
        { status: 400 }
      );
    }

    // Fetch authorization code from DB
    console.log('[Token] 🔍 FETCHING authorization code from DB:', {
      code: code.substring(0, 8) + '...',
      code_length: code.length,
      code_exact_first_20_chars: code.substring(0, 20),
      code_full: code, // Log full code for comparison
    });
    const authCode = await getAuthorizationCode(code);

    if (!authCode) {
      console.log('[Token] ❌ FAILED: Code not found, expired, or already redeemed', {
        code_attempted: code.substring(0, 8) + '...',
        result: authCode,
      });
      return NextResponse.json(
        {
          error: "invalid_grant",
          error_description: "Authorization code is invalid, expired, or already used",
        },
        { status: 400 }
      );
    }

    console.log('[Token] ✅ Code found in database:', {
      authCode_properties: Object.keys(authCode),
      authCode_client_id: authCode.client_id,
      authCode_user_id: authCode.user_id,
      authCode_redirect_uri: authCode.redirect_uri,
      authCode_is_redeemed: authCode.is_redeemed,
    });

    // Validate client_id matches
    if (authCode.client_id !== client_id) {
      console.log('[Token] ❌ Client ID mismatch. Expected:', authCode.client_id, 'Got:', client_id);
      return NextResponse.json(
        {
          error: "invalid_grant",
          error_description: "Client ID does not match authorization code",
        },
        { status: 400 }
      );
    }

    console.log('[Token] ✅ Client ID matches');

    // Validate redirect_uri matches exactly
    if (authCode.redirect_uri !== redirect_uri) {
      console.log('[Token] ❌ Redirect URI mismatch. Expected:', authCode.redirect_uri, 'Got:', redirect_uri);
      return NextResponse.json(
        {
          error: "invalid_grant",
          error_description: "Redirect URI does not match authorization code",
        },
        { status: 400 }
      );
    }

    console.log('[Token] ✅ Redirect URI matches');

    // PKCE Validation: Only validate if code_challenge exists and is non-empty (backward compatible)
    // Empty string "" means PKCE was not used when creating the authorization code
    if (authCode.code_challenge && authCode.code_challenge.trim() !== "") {
      console.log('[Token] ✅ PKCE challenge exists, validating...');
      
      // Compute SHA256(code_verifier) and compare with stored code_challenge
      const computedChallenge = crypto
        .createHash("sha256")
        .update(code_verifier)
        .digest("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

      console.log('[Token] PKCE Debug:', {
        verifier: code_verifier ? code_verifier.substring(0, 20) + '...' : 'MISSING',
        verifierLength: code_verifier ? code_verifier.length : 0,
        storedChallenge: authCode.code_challenge.substring(0, 20) + '...',
        storedChallengeLength: authCode.code_challenge.length,
        computedChallenge: computedChallenge.substring(0, 20) + '...',
        computedChallengeLength: computedChallenge.length,
        matches: authCode.code_challenge === computedChallenge,
      });

      if (authCode.code_challenge !== computedChallenge) {
        console.log('[Token] ❌ PKCE validation failed - code_verifier does not match code_challenge');
        return NextResponse.json(
          {
            error: "invalid_grant",
            error_description: "Code verifier does not match code challenge (PKCE validation failed)",
          },
          { status: 400 }
        );
      }
      console.log('[Token] ✅ PKCE validation passed');
    } else {
      console.log('[Token] ℹ️ No PKCE challenge - skipping PKCE validation (backward compatible)');
    }

    // All validations passed - code is valid and PKCE checks out (if required)
    // Fetch user and accounts
    const user = await getUserById(authCode.user_id);

    if (!user) {
      console.log('[Token] User not found');
      return NextResponse.json(
        {
          error: "server_error",
          error_description: "User not found",
        },
        { status: 500 }
      );
    }

    const accounts = await getUserAccounts(authCode.user_id);
    const primaryAccount = accounts.find((acc) => acc.is_primary) || accounts[0];

    if (!primaryAccount) {
      console.log("[Token] No account found");
      return NextResponse.json(
        {
          error: "server_error",
          error_description: "No account found",
        },
        { status: 500 }
      );
    }

    // Generate tokens
    console.log('[Token] Generating access_token, id_token, and refresh_token');
    const accessToken = generateAccessToken(
      authCode.user_id,
      primaryAccount.email,
      primaryAccount.name,
      primaryAccount.id
    );

    const idToken = generateIdToken(
      authCode.user_id,
      primaryAccount.email,
      primaryAccount.name,
      primaryAccount.id
    );

    // Generate and store refresh token
    const refreshTokenValue = crypto.randomBytes(32).toString("hex");
    const refreshTokenHash = crypto
      .createHash("sha256")
      .update(refreshTokenValue)
      .digest("hex");

    await storeRefreshToken(authCode.user_id, authCode.client_id, refreshTokenHash);
    console.log('[Token] Refresh token stored');

    // Mark code as redeemed (prevents reuse)
    await markAuthorizationCodeAsRedeemed(code);
    console.log('[Token] Code marked as redeemed');

    console.log('[Token] Exchange successful - returning tokens');
    return NextResponse.json(
      {
        access_token: accessToken,
        id_token: idToken,
        refresh_token: refreshTokenValue,
        token_type: "Bearer",
        expires_in: 86400, // 1 day in seconds
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Token] Authorization Code Grant Error:", error);
    return NextResponse.json(
      {
        error: "server_error",
        error_description: "An error occurred during token exchange",
      },
      { status: 500 }
    );
  }
}

/**
 * Handle refresh_token grant type
 * Exchanges refresh token for new access_token + rotated refresh_token
 */
async function handleRefreshTokenGrant(body: {
  client_id?: string;
  refresh_token?: string;
}) {
  try {
    const { client_id, refresh_token } = body;

    // Validate required params
    if (!client_id || !refresh_token) {
      console.log('[Token] Missing required params for refresh_token grant');
      return NextResponse.json(
        {
          error: "invalid_request",
          error_description: "Missing required parameters: client_id, refresh_token",
        },
        { status: 400 }
      );
    }

    console.log('[Token] Refresh token grant request:', {
      client_id,
      refresh_token: refresh_token.substring(0, 8) + '...',
    });

    // Hash the incoming refresh token for lookup
    const refreshTokenHash = crypto
      .createHash("sha256")
      .update(refresh_token)
      .digest("hex");

    // Validate refresh token
    const validation = await validateRefreshToken(refreshTokenHash);
    if (!validation.valid) {
      console.log('[Token] ❌ Invalid or expired refresh token');
      return NextResponse.json(
        {
          error: "invalid_grant",
          error_description: "Refresh token is invalid or expired",
        },
        { status: 400 }
      );
    }

    const storedToken = validation.token;

    // Validate client_id matches
    if (storedToken.client_id !== client_id) {
      console.log('[Token] ❌ Client ID mismatch for refresh token');
      return NextResponse.json(
        {
          error: "invalid_grant",
          error_description: "Client ID does not match refresh token",
        },
        { status: 400 }
      );
    }

    console.log('[Token] ✅ Refresh token validated');

    // Stage 11: Check if account is revoked in this session
    // This prevents using refresh tokens if the account was logged out
    if (storedToken.session_id) {
      const { supabase } = await import("@/lib/db");
      const { data: logon, error: logonError } = await supabase
        .from("session_logons")
        .select("revoked")
        .eq("session_id", storedToken.session_id)
        .eq("account_id", storedToken.account_id)
        .single();

      if (logonError || logon?.revoked) {
        console.log('[Token] ❌ Account logged out in this session');
        return NextResponse.json(
          {
            error: "invalid_grant",
            error_description: "Account was logged out in this session",
          },
          { status: 400 }
        );
      }
    }

    console.log('[Token] ✅ Account is still active in session');
    const user = await getUserById(storedToken.user_id);
    if (!user) {
      console.log('[Token] User not found');
      return NextResponse.json(
        {
          error: "server_error",
          error_description: "User not found",
        },
        { status: 500 }
      );
    }

    const accounts = await getUserAccounts(storedToken.user_id);
    const primaryAccount = accounts.find((acc) => acc.is_primary) || accounts[0];

    if (!primaryAccount) {
      console.log("[Token] No account found");
      return NextResponse.json(
        {
          error: "server_error",
          error_description: "No account found",
        },
        { status: 500 }
      );
    }

    // Generate new tokens
    console.log('[Token] Generating new access_token, id_token, and refresh_token');
    const newAccessToken = generateAccessToken(
      storedToken.user_id,
      primaryAccount.email,
      primaryAccount.name,
      primaryAccount.id
    );

    const newIdToken = generateIdToken(
      storedToken.user_id,
      primaryAccount.email,
      primaryAccount.name,
      primaryAccount.id
    );

    // Generate new refresh token and rotate old one
    const newRefreshTokenValue = crypto.randomBytes(32).toString("hex");
    const newRefreshTokenHash = crypto
      .createHash("sha256")
      .update(newRefreshTokenValue)
      .digest("hex");

    // Mark old token as used and track replacement
    await rotateRefreshToken(refreshTokenHash, newRefreshTokenHash);
    console.log('[Token] Old refresh token marked as used, new token issued');

    // Store new refresh token with account and session info preserved
    await storeRefreshToken(
      storedToken.user_id, 
      storedToken.account_id, 
      client_id, 
      newRefreshTokenHash,
      storedToken.session_id
    );
    console.log('[Token] New refresh token stored');

    console.log('[Token] Refresh token exchange successful - returning new tokens');
    return NextResponse.json(
      {
        access_token: newAccessToken,
        id_token: newIdToken,
        refresh_token: newRefreshTokenValue,
        token_type: "Bearer",
        expires_in: 86400, // 1 day in seconds
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Token] Refresh Token Grant Error:", error);
    return NextResponse.json(
      {
        error: "server_error",
        error_description: "An error occurred during token refresh",
      },
      { status: 500 }
    );
  }
}
