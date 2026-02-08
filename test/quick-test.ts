import axios from "axios";
import { TestHttpClient } from "./utils/http-client";
import { TEST_USER } from "./fixtures/test-users";
import { OAUTH_CLIENTS, VALID_REDIRECT_URIS } from "./fixtures/oauth-clients";
import { generatePKCE } from "./fixtures/pkce";

const IDP_BASE_URL = "http://localhost:3000";

async function quickTest() {
  console.log("🧪 Quick Happy Path Test\n");

  try {
    const http = new TestHttpClient();

    // Login
    console.log("Step 1: Login");
    await http.loginWithCredentials(TEST_USER.email, TEST_USER.password);
    console.log("✅ Logged in\n");

    // Generate PKCE
    console.log("Step 2: Generate PKCE");
    const { verifier, challenge } = generatePKCE();
    console.log("  Challenge:", challenge.substring(0, 30) + "...");
    console.log("  Verifier:", verifier.substring(0, 30) + "...\n");

    // Authorize
    console.log("Step 3: Call /authorize");
    const clientId = OAUTH_CLIENTS.VALID_CLIENT_A.clientId;
    const redirectUri = VALID_REDIRECT_URIS.CLIENT_A;
    console.log("  Sending challenge...");
    
    const authResponse = await http.authorizeWithSession(
      clientId,
      redirectUri,
      "test_state",
      challenge
    );

    console.log("  Response status:", authResponse.status);
    console.log("  Location:", authResponse.locationHeader?.substring(0, 80) + "...");

    // Extract code
    const params = new URL(authResponse.locationHeader!, "http://localhost:3001").searchParams;
    const code = params.get("code");
    console.log("  Code extracted:", code);
    console.log("  Code length:", code?.length, "\n");

    // Token exchange
    console.log("Step 4: Call /token");
    console.log("  Sending code:", code?.substring(0, 20) + "...");
    const tokenResponse = await axios.post(
      `${IDP_BASE_URL}/api/auth/token`,
      {
        grant_type: "authorization_code",
        client_id: clientId,
        redirect_uri: redirectUri,
        code,
        code_verifier: verifier,
      },
      { validateStatus: () => true }
    );

    console.log("  Response status:", tokenResponse.status);
    if (tokenResponse.status === 200) {
      console.log("  ✅ SUCCESS! Got tokens");
      console.log("  Access token:", tokenResponse.data.access_token?.substring(0, 20) + "...");
    } else {
      console.log("  ❌ FAILED");
      console.log("  Error:", tokenResponse.data.error);
      console.log("  Description:", tokenResponse.data.error_description);
    }
  } catch (error) {
    console.error("❌ Exception:", error);
  }

  process.exit(0);
}

quickTest();
