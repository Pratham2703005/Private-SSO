import { NextRequest, NextResponse } from "next/server";
import { SignupSchema } from "@/lib/schemas";
import {
  getUserByEmail,
  createUser,
  createUserAccount,
  createSession,
  storeRefreshToken,
  getSession,
  addAccountToSession,
} from "@/lib/db";
import { generateAccessToken, generateRefreshToken } from "@/lib/jwt";
import { setMasterCookie, hashToken } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = SignupSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid input format",
        },
        { status: 400 }
      );
    }

    const { email, password, name } = validation.data;

    // Check if user exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "Email already registered" },
        { status: 409 }
      );
    }

    // Create user (auth identity only)
    const user = await createUser(email, password);

    // Create primary account (profile identity)
    const account = await createUserAccount(user.id, email, name, true);

    // Stage 11: Check if user already has IDP session
    // (unlikely for signup but possible if multi-account signup flow)
    const existingSessionId = request.cookies.get('__sso_session')?.value;
    let sessionId: string;

    if (existingSessionId) {
      // Session exists - reuse it for multiple account signup
      const existingSession = await getSession(existingSessionId);
      
      if (existingSession) {
        console.log("[Signup] ✅ Reusing existing IDP session for multi-account signup");
        // Add this account to the session's logons and make it active
        await addAccountToSession(existingSessionId, account.id);
        sessionId = existingSessionId;
      } else {
        // Session expired - create new one
        console.log("[Signup] Session expired, creating new session");
        sessionId = await createSession(user.id, account.id);
      }
    } else {
      // No session exists - create new one
      console.log("[Signup] Creating new IDP session");
      sessionId = await createSession(user.id, account.id);
    }

    // Generate tokens
    const accessToken = generateAccessToken(
      user.id,
      account.email,
      account.name,
      account.id
    );

    const refreshToken = generateRefreshToken(
      user.id,
      account.id,
      "idp",
      sessionId
    );

    // Store refresh token hash with session_id for precise revocation
    const refreshTokenHash = hashToken(refreshToken);
    
    try {
      await storeRefreshToken(user.id, account.id, "idp", refreshTokenHash);

      // Update the token record to include session_id
      const { supabase } = await import("@/lib/db");
      const { error: updateError } = await supabase
        .from("refresh_tokens")
        .update({ session_id: sessionId })
        .eq("token_hash", refreshTokenHash);

      if (updateError) {
        console.error("[Signup] Error updating token with session_id:", updateError);
        throw updateError;
      }
    } catch (tokenError) {
      console.error("[Signup] Error storing refresh token:", tokenError);
      throw tokenError;
    }

    // Set response with master cookie
    const response = NextResponse.json(
      {
        success: true,
        message: "Sign up successful",
        data: {
          accessToken,
          accountId: account.id,
          user: {
            id: user.id,
            email,
            name,
            profileImage: null,
          },
        },
      },
      { status: 201 }
    );

    // Store account ID in idp_jar cookie (for widget to remember logged-in accounts)
    const existingJar = request.cookies.get("idp_jar")?.value || "";
    const jarIds = existingJar ? existingJar.split(",").filter(Boolean) : [];
    if (!jarIds.includes(account.id)) {
      jarIds.push(account.id);
    }
    const trimmedJar = jarIds.slice(-10).join(",");
    response.cookies.set({
      name: "idp_jar",
      value: trimmedJar,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 365 * 24 * 60 * 60, // 1 year
      path: "/",
    });

    return setMasterCookie(response, sessionId);
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
