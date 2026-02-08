import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken, generateAccessToken, generateRefreshToken } from "@/lib/jwt";
import { getAccountById, storeRefreshToken } from "@/lib/db";
import { hashToken, validateClientSecret } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId, clientId, clientSecret } = body;

    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Missing authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);

    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401 }
      );
    }

    // Validate client secret (should come from client backend)
    if (!validateClientSecret(clientId, clientSecret)) {
      return NextResponse.json(
        { success: false, error: "Invalid client credentials" },
        { status: 401 }
      );
    }

    // Get the account to switch to
    const account = await getAccountById(accountId);
    if (!account || account.user_id !== payload.sub) {
      return NextResponse.json(
        { success: false, error: "Account not found" },
        { status: 404 }
      );
    }

    // Generate new token for switched account
    const newAccessToken = generateAccessToken(
      payload.sub,
      account.email,
      account.name,
      account.id
    );

    const newRefreshToken = generateRefreshToken(
      payload.sub,
      account.id,
      clientId,
      payload.sub // Generate new jti
    );

    // Store new refresh token
    const refreshTokenHash = hashToken(newRefreshToken);
    await storeRefreshToken(
      payload.sub,
      account.id,
      clientId,
      refreshTokenHash
    );

    return NextResponse.json(
      {
        success: true,
        message: "Account switched",
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          user: {
            id: payload.sub,
            email: account.email,
            name: account.name,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Switch account error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
