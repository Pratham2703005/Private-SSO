import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { storeAccessToken, storeRefreshToken, getAccessToken } from "@/lib/session-store";

const IDP_SERVER = process.env.NEXT_PUBLIC_IDP_SERVER || "http://localhost:3000";
const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID || "client-b";

/**
 * POST /api/auth/auto-login
 * 
 * This endpoint checks if the user has a valid IDP session and if so,
 * automatically creates a local app session without requiring user interaction.
 * 
 * Used when user logs out locally but IDP session still exists.
 */
export async function POST(request: NextRequest) {
  try {
    console.log("[/api/auth/auto-login] Attempting auto-login...");

    // Check if user already has app session
    const existingSession = request.cookies.get("app_session");
    if (existingSession) {
      console.log("[/api/auth/auto-login] Found existing app session cookie");
      
      // Validate that tokens actually exist for this session
      try {
        const sessionData = JSON.parse(existingSession.value);
        const { sessionId } = sessionData;
        
        if (sessionId) {
          const token = await getAccessToken(sessionId);
          if (token) {
            console.log("[/api/auth/auto-login] ✅ Session cookie is valid and has tokens");
            return NextResponse.json(
              { success: true, message: "Already authenticated" },
              { status: 200 }
            );
          } else {
            console.log("[/api/auth/auto-login] ⚠️ Session cookie exists but no tokens found, clearing cookie");
          }
        }
      } catch (e) {
        console.log("[/api/auth/auto-login] ⚠️ Failed to parse session cookie:", e);
      }
      
      // Cookie is stale/orphaned - clear it and continue with fresh login
      const response = NextResponse.json(
        { success: false, message: "Session expired" },
        { status: 401 }
      );
      response.cookies.set({
        name: "app_session",
        value: "",
        httpOnly: true,
        maxAge: 0,
        path: "/",
      });
      console.log("[/api/auth/auto-login] ✅ Cleared stale session cookie");
      return response;
    }

    // Try to get tokens from IDP using the existing IDP session
    try {
      console.log("[/api/auth/auto-login] Calling IDP /api/auth/get-token...");
      const tokenResponse = await fetch(
        `${IDP_SERVER}/api/auth/get-token`,
        {
          headers: {
            // Pass all cookies from the request to preserve IDP session
            Cookie: request.headers.get("cookie") || "",
          },
        }
      );

      if (tokenResponse.ok) {
        const tokens = await tokenResponse.json();
        console.log("[/api/auth/auto-login] ✅ Got tokens from IDP");

        if (tokens.access_token) {
          // Generate session ID and store tokens
          const sessionId = randomBytes(32).toString("hex");

          await storeAccessToken(sessionId, tokens.access_token);
          if (tokens.refresh_token) {
            await storeRefreshToken(sessionId, tokens.refresh_token);
          }

          // Create app session response
          const response = NextResponse.json(
            { success: true, message: "Auto-login successful" },
            { status: 200 }
          );

          // Decode id_token to get user info
          let userId = "unknown";
          if (tokens.id_token) {
            try {
              const idTokenParts = tokens.id_token.split(".");
              const decodedIdToken = JSON.parse(
                Buffer.from(idTokenParts[1], "base64").toString()
              );
              userId = decodedIdToken.sub;
            } catch (e) {
              console.log("[/api/auth/auto-login] Warning: Failed to decode id_token");
            }
          }

          // Set app_session cookie
          response.cookies.set({
            name: "app_session",
            value: JSON.stringify({
              sessionId,
              userId,
              issuedAt: Date.now(),
            }),
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 24 * 60 * 60,
            path: "/",
          });

          console.log("[/api/auth/auto-login] ✅ App session created");
          return response;
        }
      } else {
        console.log("[/api/auth/auto-login] ❌ IDP returned error:", tokenResponse.status);
      }
    } catch (err) {
      console.log("[/api/auth/auto-login] IDP call failed:", err);
    }

    // If silent login didn't work, user needs to manually login
    console.log("[/api/auth/auto-login] ❌ Could not auto-login");
    return NextResponse.json(
      { success: false, message: "No active IDP session" },
      { status: 401 }
    );
  } catch (error) {
    console.error("[/api/auth/auto-login] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
