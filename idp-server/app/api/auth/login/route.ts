import { NextRequest, NextResponse } from "next/server";
import { LoginSchema } from "@/lib/schemas";
import {
  getUserByEmail,
  verifyPassword,
  getUserAccounts,
  createSession,
  storeRefreshToken,
  getSession,
  addAccountToSession,
} from "@/lib/db";
import {
  generateAccessToken,
  generateRefreshToken,
} from "@/lib/jwt";
import { setMasterCookie, hashToken } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = LoginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid email or password format",
        },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;
    const user = await getUserByEmail(email);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Get primary account
    const accounts = await getUserAccounts(user.id);
    const primaryAccount = accounts.find((acc) => acc.is_primary) || accounts[0];

    if (!primaryAccount) {
      return NextResponse.json(
        { success: false, error: "No account found" },
        { status: 500 }
      );
    }

    // Stage 11: Check if user already has IDP session
    // If so, reuse it; otherwise create new session
    // Use proper cookie API instead of fragile regex parsing
    const existingSessionId = request.cookies.get('__sso_session')?.value;
    let sessionId: string;

    if (existingSessionId) {
      // Session cookie exists - try to reuse for multi-account login
      const existingSession = await getSession(existingSessionId);
      
      if (existingSession) {
        console.log("[Login] ✅ Reusing existing IDP session for multi-account login");
        // Add this account to the session's logons and make it active
        await addAccountToSession(existingSessionId, primaryAccount.id);
        sessionId = existingSessionId;
      } else {
        // Session expired/invalid - create new one
        console.log("[Login] Session expired, creating new session");
        sessionId = await createSession(user.id, primaryAccount.id);
      }
    } else {
      // No session exists - create new one
      console.log("[Login] Creating new IDP session");
      sessionId = await createSession(user.id, primaryAccount.id);
    }

    // Generate tokens
    const accessToken = generateAccessToken(
      user.id,
      primaryAccount.email,
      primaryAccount.name,
      primaryAccount.id
    );

    const refreshToken = generateRefreshToken(
      user.id,
      primaryAccount.id,
      "idp", // Internal client ID
      sessionId
    );

    // Store refresh token hash with session_id for precise revocation
    const refreshTokenHash = hashToken(refreshToken);
    
    // Store the refresh token
    try {
      await storeRefreshToken(
        user.id,
        primaryAccount.id,
        "idp",
        refreshTokenHash
      );

      // Update the token record to include session_id
      const { supabase } = await import("@/lib/db");
      const { error: updateError } = await supabase
        .from("refresh_tokens")
        .update({ session_id: sessionId })
        .eq("token_hash", refreshTokenHash);

      if (updateError) {
        console.error("[Login] Error updating token with session_id:", updateError);
        throw updateError;
      }
    } catch (tokenError) {
      console.error("[Login] Error storing refresh token:", tokenError);
      throw tokenError;
    }

    // Set response with master cookie
    const response = NextResponse.json(
      {
        success: true,
        message: "Login successful",
        data: {
          accessToken,
          accountId: primaryAccount.id,
          user: {
            id: user.id,
            email: primaryAccount.email,
            name: primaryAccount.name,
            profileImage: user.profile_image_url,
          },
        },
      },
      { status: 200 }
    );

    // Set refresh token in HttpOnly cookie
    response.cookies.set({
      name: "sso_refresh_token",
      value: refreshToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    // Store account ID in idp_jar cookie (for widget to remember logged-in accounts)
    // This is a Google-style "account jar" - persists across logout so widget can show "Signed out" state
    // Format: comma-separated account IDs only (no PII, small cookie size)
    const existingJar = request.cookies.get("idp_jar")?.value || "";
    console.log('[Login] Existing idp_jar:', existingJar ? `"${existingJar}"` : 'empty');
    
    const jarIds = existingJar ? existingJar.split(",").filter(Boolean) : [];
    console.log('[Login] Parsed jar IDs:', jarIds);

    // Add account ID if not already in jar
    if (!jarIds.includes(primaryAccount.id)) {
      jarIds.push(primaryAccount.id);
      console.log('[Login] Added new account ID to jar:', primaryAccount.id);
    } else {
      console.log('[Login] Account ID already in jar:', primaryAccount.id);
    }

    // Keep only last 10 accounts to prevent cookie bloat
    const trimmedJar = jarIds.slice(-10).join(",");
    console.log('[Login] Final trimmed jar (', jarIds.length, 'accounts):', `"${trimmedJar}"`);

    response.cookies.set({
      name: "idp_jar",
      value: trimmedJar,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 365 * 24 * 60 * 60, // 1 year - persist across sessions
      path: "/",
    });
    console.log('[Login] idp_jar cookie set successfully');

    return setMasterCookie(response, sessionId);
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
