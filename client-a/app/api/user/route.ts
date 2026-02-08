import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/session-store";

export async function GET(request: NextRequest) {
  try {
    // Get the session cookie
    const sessionCookie = request.cookies.get("app_session")?.value;
    console.log("[/api/user] Session cookie:", sessionCookie ? "✅ Present" : "❌ Missing");

    if (!sessionCookie) {
      console.log("[/api/user] ❌ No session cookie found");
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    let sessionData: any;
    try {
      sessionData = JSON.parse(sessionCookie);
      console.log("[/api/user] ✅ Parsed session data:", JSON.stringify(sessionData));
    } catch (e) {
      console.log("[/api/user] ❌ Failed to parse session:", e);
      return NextResponse.json(
        { success: false, error: "Invalid session" },
        { status: 401 }
      );
    }

    const { sessionId } = sessionData;
    console.log("[/api/user] Session ID:", sessionId ? `${sessionId.substring(0, 8)}...` : "Missing");

    if (!sessionId) {
      console.log("[/api/user] ❌ No sessionId in cookie");
      return NextResponse.json(
        { success: false, error: "Invalid session" },
        { status: 401 }
      );
    }

    // ✅ Retrieve access token from server-side database ONLY (not from cookie)
    const accessToken = await getAccessToken(sessionId);

    if (!accessToken) {
      console.log("[/api/user] ❌ No access token in server store for this sessionId");
      
      // Check if user has IDP session (master __sso_session cookie)
      const idpSession = request.cookies.get("__sso_session");
      console.log("[/api/user] 🔍 Checking for master __sso_session cookie:", {
        found: !!idpSession,
        value: idpSession ? idpSession.value.substring(0, 16) + "..." : "NOT_FOUND",
      });
      
      // Also log all cookies available
      const allCookies = request.cookies.getAll();
      console.log("[/api/user] 📋 All available cookies:", allCookies.map(c => c.name).join(", "));
      
      if (idpSession) {
        // User is logged into IDP but this client doesn't have a local token yet
        // This happens when user logs into another client and then switches here
        // Silently bootstrap by getting token from IDP using return_json=true
        console.log("[/api/user] 🔄 IDP session exists, attempting bootstrap...");
        console.log("[/api/user] 🔑 Master session cookie value:", idpSession.value.substring(0, 16) + "...");
        
        const IDP_SERVER = process.env.NEXT_PUBLIC_IDP_SERVER || "http://localhost:3000";
        const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID || "client-a";
        const REDIRECT_URI = process.env.NEXT_PUBLIC_REDIRECT_URI || "http://localhost:3001/api/auth/callback";
        
        try {
          // Call IDP authorize with return_json=true to get token server-side
          // Pass the master cookie in headers since server-side fetch doesn't auto-include cookies
          const authorizeUrl = `${IDP_SERVER}/api/auth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scopes=profile,email&return_json=true`;
          console.log("[/api/user] 📡 Calling IDP authorize for bootstrap:");
          console.log("[/api/user]   URL:", authorizeUrl);
          console.log("[/api/user]   Passing master cookie in headers...");
          
          const idpResponse = await fetch(authorizeUrl, {
            headers: {
              Cookie: `__sso_session=${idpSession.value}`,
            },
          });
          
          console.log("[/api/user] 📥 IDP authorize response:", {
            status: idpResponse.status,
            statusText: idpResponse.statusText,
          });
          
          if (!idpResponse.ok) {
            const errorText = await idpResponse.text();
            console.log("[/api/user] ❌ IDP authorize failed:", {
              status: idpResponse.status,
              body: errorText.substring(0, 200),
            });
            return NextResponse.json(
              { success: false, error: "Session expired" },
              { status: 401 }
            );
          }
          
          const idpData = await idpResponse.json();
          console.log("[/api/user] ✅ Got token from IDP:", {
            success: idpData.success,
            hasToken: !!idpData.accessToken,
            tokenPreview: idpData.accessToken ? idpData.accessToken.substring(0, 20) + "..." : "NONE",
            user: idpData.user ? { id: idpData.user.id, email: idpData.user.email } : "NONE",
          });
          
          if (!idpData.success || !idpData.accessToken) {
            console.log("[/api/user] ❌ Invalid response from IDP:", idpData);
            return NextResponse.json(
              { success: false, error: "Session expired" },
              { status: 401 }
            );
          }
          
          // Store the token in this client's session store
          const { storeAccessToken } = await import("@/lib/session-store");
          await storeAccessToken(sessionId, idpData.accessToken);
          console.log("[/api/user] ✅ Stored bootstrapped token in session store:", sessionId.substring(0, 16) + "...");
          
          // Return the user data from IDP
          return NextResponse.json({
            success: true,
            data: idpData.user,
          });
        } catch (error) {
          console.log("[/api/user] ❌ Bootstrap error:", error instanceof Error ? error.message : error);
          console.log("[/api/user] ❌ Full error:", error);
          return NextResponse.json(
            { success: false, error: "Session expired" },
            { status: 401 }
          );
        }
      }
      
      return NextResponse.json(
        { success: false, error: "Session expired" },
        { status: 401 }
      );
    }

    console.log("[/api/user] ✅ Got access token from store");

    // ✅ Use the server-side token to fetch user data from IDP
    // Client NEVER sees the access token
    const idpServer = process.env.NEXT_PUBLIC_IDP_SERVER;
    console.log("[/api/user] Calling IDP at:", idpServer);

    const userResponse = await fetch(`${idpServer}/api/user/profile`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.log("[/api/user] IDP response status:", userResponse.status);

    if (!userResponse.ok) {
      const errorData = await userResponse.text();
      console.log("[/api/user] ❌ IDP error:", errorData);
      return NextResponse.json(
        { success: false, error: "Failed to fetch user from IDP" },
        { status: 401 }
      );
    }

    const userData = await userResponse.json();
    console.log("[/api/user] ✅ Got user data:", JSON.stringify(userData));

    return NextResponse.json({
      success: true,
      data: userData.data, // IDP returns { success, data }, extract just the data
    });
  } catch (error) {
    console.error("[/api/user] ❌ Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
