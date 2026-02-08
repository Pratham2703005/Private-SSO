import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getUserById, getUserAccounts } from "@/lib/db";

const publicKey = process.env.JWT_PUBLIC_KEY!.replace(/\\n/g, "\n");

if (!publicKey) {
  throw new Error("JWT_PUBLIC_KEY not configured");
}

export async function GET(request: NextRequest) {
  try {
    console.log("[Userinfo] 🔍 Protected endpoint request");

    // Extract Authorization header
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      console.log("[Userinfo] ❌ Missing Authorization header");
      return NextResponse.json(
        {
          error: "unauthorized",
          error_description: "Missing Authorization header",
        },
        { status: 401 }
      );
    }

    // Parse Bearer token
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
      console.log(
        "[Userinfo] ❌ Invalid Authorization header format:",
        authHeader.substring(0, 20) + "..."
      );
      return NextResponse.json(
        {
          error: "unauthorized",
          error_description: "Invalid Authorization header format",
        },
        { status: 401 }
      );
    }

    const token = parts[1];
    console.log("[Userinfo] 🔐 Verifying token...");
    console.log("[Userinfo]   Token length:", token.length);

    // Verify and decode JWT
    let decoded: any;
    try {
      decoded = jwt.verify(token, publicKey, {
        algorithms: ["RS256"],
      });
      console.log("[Userinfo] ✅ Token verified");
      console.log("[Userinfo]   User ID:", decoded.sub);
      console.log("[Userinfo]   Account ID:", decoded.accountId);
    } catch (error) {
      console.log("[Userinfo] ❌ Token verification failed:", (error as Error).message);
      return NextResponse.json(
        {
          error: "invalid_token",
          error_description: "Token is invalid or expired",
        },
        { status: 401 }
      );
    }

    // Fetch user from database
    const userId = decoded.sub as string;
    const user = await getUserById(userId);

    if (!user) {
      console.log("[Userinfo] ❌ User not found:", userId.substring(0, 8) + "...");
      return NextResponse.json(
        {
          error: "invalid_token",
          error_description: "User not found",
        },
        { status: 401 }
      );
    }

    console.log("[Userinfo] 📋 Fetching user accounts...");

    // Fetch user accounts
    const accounts = await getUserAccounts(userId);

    console.log("[Userinfo] ✅ User profile retrieved");
    console.log("[Userinfo]   Email:", user.email);
    console.log("[Userinfo]   Name:", user.name);
    console.log("[Userinfo]   Accounts:", accounts.length);

    // Return user profile
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      profile_image: user.profile_image_url,
      accounts: accounts.map((acc) => ({
        id: acc.id,
        email: acc.email,
        name: acc.name,
        is_primary: acc.is_primary,
      })),
    });
  } catch (error) {
    console.error("[Userinfo] ❌ Unexpected error:", error);
    return NextResponse.json(
      {
        error: "server_error",
        error_description: "Internal server error",
      },
      { status: 500 }
    );
  }
}
