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
import { rateLimit, getClientIp, rateLimited } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const ipLimit = rateLimit(`login:ip:${ip}`, 20, 15 * 60 * 1000);
    if (!ipLimit.allowed) {
      return rateLimited("Too many login attempts from this IP", ipLimit.retryAfterSeconds);
    }

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

    const emailLimit = rateLimit(`login:email:${email.toLowerCase()}`, 5, 15 * 60 * 1000);
    if (!emailLimit.allowed) {
      return rateLimited("Too many login attempts for this account", emailLimit.retryAfterSeconds);
    }

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
        // Add this account to the session's logons and make it active
        await addAccountToSession(existingSessionId, primaryAccount.id);
        sessionId = existingSessionId;
      } else {
        // Session expired/invalid - create new one
        sessionId = await createSession(user.id, primaryAccount.id);
      }
    } else {
      // No session exists - create new one
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
          },
        },
      },
      { status: 200 }
    );

    // Store account ID in idp_jar cookie (for widget to remember logged-in accounts)
    // This is a Google-style "account jar" - persists across logout so widget can show "Signed out" state
    // Format: comma-separated account IDs only (no PII, small cookie size)
    const existingJar = request.cookies.get("idp_jar")?.value || "";
    
    const jarIds = existingJar ? existingJar.split(",").filter(Boolean) : [];

    // Add account ID if not already in jar
    if (!jarIds.includes(primaryAccount.id)) {
      jarIds.push(primaryAccount.id);
    }

    // Keep only last 10 accounts to prevent cookie bloat
    const trimmedJar = jarIds.slice(-10).join(",");

    const isProduction = process.env.NODE_ENV === "production";
    response.cookies.set({
      name: "idp_jar",
      value: trimmedJar,
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 365 * 24 * 60 * 60, // 1 year - persist across sessions
      path: "/",
    });

    return setMasterCookie(response, sessionId);
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
