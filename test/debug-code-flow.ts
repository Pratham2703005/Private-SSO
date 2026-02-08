import axios from "axios";
import { TestHttpClient } from "./utils/http-client";
import { TEST_USER } from "./fixtures/test-users";
import { generatePKCE } from "./fixtures/pkce";

const IDP_BASE_URL = "http://localhost:3000";

async function debugCodeFlow() {
  try {
    console.log("\n🔍 DEBUG: Authorization Code Flow\n");

    const http = new TestHttpClient();

    // Step 1: Login
    console.log("Step 1️⃣  Login...");
    await http.loginWithCredentials(TEST_USER.email, TEST_USER.password);
    console.log("✅ Logged in\n");

    // Step 2: Generate PKCE
    console.log("Step 2️⃣  Generate PKCE...");
    const { verifier, challenge } = generatePKCE();
    console.log("  Verifier:", verifier.substring(0, 20) + "...");
    console.log("  Challenge:", challenge.substring(0, 20) + "...\n");

    // Step 3: Hit /authorize
    console.log("Step 3️⃣  Call /authorize endpoint...");
    const authResponse = await http.authorizeWithSession("client-a", "http://localhost:3001/api/auth/callback", challenge);
    
    console.log("  Response status:", authResponse.status);
    console.log("  Location header:", authResponse.headers.location);

    // Extract code from redirect
    const locationUrl = authResponse.headers.location as string;
    const urlObj = new URL(locationUrl, "http://localhost:3001");
    const code = urlObj.searchParams.get("code");
    const state = urlObj.searchParams.get("state");

    console.log("\n✅ Code from /authorize:");
    console.log("  Code:", code);
    console.log("  Code length:", code?.length);
    console.log("  Code (first 20):", code?.substring(0, 20));
    console.log("  State:", state);

    if (!code) {
      console.error("❌ No code found in redirect!");
      return;
    }

    // Step 4: Try to exchange without calling DB API, just show what we're sending
    console.log("\nStep 4️⃣  Prepare token exchange request...");
    const tokenPayload = {
      grant_type: "authorization_code",
      client_id: "client-a",
      redirect_uri: "http://localhost:3001/api/auth/callback",
      code: code,
      code_verifier: verifier,
    };

    console.log("  Request body:");
    console.log("    grant_type:", tokenPayload.grant_type);
    console.log("    client_id:", tokenPayload.client_id);
    console.log("    redirect_uri:", tokenPayload.redirect_uri);
    console.log("    code:", tokenPayload.code);
    console.log("    code_verifier:", tokenPayload.code_verifier.substring(0, 20) + "...");

    // Step 5: Call /token endpoint
    console.log("\nStep 5️⃣  Call /token endpoint...");
    const tokenResponse = await axios.post(`${IDP_BASE_URL}/api/auth/token`, tokenPayload, {
      validateStatus: () => true,
    });

    console.log("  Response status:", tokenResponse.status);
    console.log("  Response body:", tokenResponse.data);

    if (tokenResponse.status === 200) {
      console.log("\n✅✅✅ SUCCESS! Tokens received!");
      console.log("  access_token:", tokenResponse.data.access_token?.substring(0, 20) + "...");
      console.log("  id_token:", tokenResponse.data.id_token?.substring(0, 20) + "...");
    } else {
      console.log("\n❌ Token exchange failed");
      console.log("  Error:", tokenResponse.data.error);
      console.log("  Description:", tokenResponse.data.error_description);
    }
  } catch (error) {
    console.error("❌ Exception:", error);
  }
}

debugCodeFlow();
