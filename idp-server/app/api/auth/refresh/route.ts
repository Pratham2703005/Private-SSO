import { NextRequest, NextResponse } from "next/server";
import { verifyRefreshToken, generateAccessToken, generateRefreshToken } from "@/lib/jwt";
import { getRefreshToken, revokeRefreshToken, storeRefreshToken, getUserById } from "@/lib/db";
import { hashToken } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: "Refresh token required" },
        { status: 400 }
      );
    }

    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired refresh token" },
        { status: 401 }
      );
    }

    // Check if token is revoked
    const tokenRecord = await getRefreshToken(payload.jti);
    if (!tokenRecord || tokenRecord.is_revoked) {
      return NextResponse.json(
        { success: false, error: "Token has been revoked" },
        { status: 401 }
      );
    }

    // Get user data
    const user = await getUserById(payload.sub);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Revoke old token
    await revokeRefreshToken(payload.jti);

    // Generate new tokens (token rotation)
    const newAccessToken = generateAccessToken(
      payload.sub,
      user.email,
      user.name,
      payload.accountId
    );

    const newRefreshToken = generateRefreshToken(
      payload.sub,
      payload.accountId,
      payload.clientId,
      payload.jti // Keep same jti for rotation tracking
    );

    // Store new refresh token
    const refreshTokenHash = hashToken(newRefreshToken);
    await storeRefreshToken(
      payload.sub,
      payload.accountId,
      payload.clientId,
      refreshTokenHash
    );

    const response = NextResponse.json(
      {
        success: true,
        message: "Token refreshed",
        data: {
          accessToken: newAccessToken,
        },
      },
      { status: 200 }
    );

    // Set new refresh token in HttpOnly cookie
    response.cookies.set({
      name: "sso_refresh_token",
      value: newRefreshToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Refresh token error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
