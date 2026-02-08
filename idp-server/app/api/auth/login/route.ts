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
    const cookies = request.headers.get("cookie") || "";
    const existingSessionMatch = cookies.match(/(__sso_session|sso_refresh_token)=([^;,]+)/);
    let sessionId: string;

    if (existingSessionMatch) {
      // Session exists - reuse it for multiple account login
      sessionId = existingSessionMatch[2].trim();
      const existingSession = await getSession(sessionId);
      
      if (existingSession) {
        console.log("[Login] ✅ Reusing existing IDP session for multi-account login");
        // Add this account to the session's logons
        await addAccountToSession(sessionId, primaryAccount.id);
      } else {
        // Session expired - create new one
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

    return setMasterCookie(response, sessionId);
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
