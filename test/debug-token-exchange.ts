import axios from "axios";
import { generatePKCE } from "./fixtures/pkce";
import { TestHttpClient } from "./utils/http-client";
import { TEST_USER } from "./fixtures/test-users";
import { OAUTH_CLIENTS, VALID_REDIRECT_URIS } from "./fixtures/oauth-clients";

const IDP_BASE_URL = "http://localhost:3000";

function parseQueryParams(url: string): Record<string, string> {
  try {
    const urlObj = new URL(url);
    const params: Record<string, string> = {};
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  } catch {
    return {};
  }
}

async function testTokenExchange() {
  console.log("=== Testing Token Exchange (Single Test) ===\n");

  try {
    const http = new TestHttpClient();

    // Step 1: Login
    console.log("Step 1: Logging in...");
    const loginResult = await http.loginWithCredentials(TEST_USER.email, TEST_USER.password);
    console.log("Login result:", loginResult);

    // Step 2: Generate PKCE
    console.log("\nStep 2: Generating PKCE...");
    const { verifier, challenge } = generatePKCE();
    console.log("Verifier length:", verifier.length);
    console.log("Challenge length:", challenge.length);
    console.log("Verifier:", verifier.substring(0, 30) + "...");
    console.log("Challenge:", challenge);

    // Step 3: Call authorize
    console.log("\nStep 3: Calling /authorize...");
    const clientId = OAUTH_CLIENTS.VALID_CLIENT_A.clientId;
    const redirectUri = VALID_REDIRECT_URIS.CLIENT_A;

    const authResponse = await http.authorizeWithSession(clientId, redirectUri, "test_state", challenge);
    console.log("Auth response status:", authResponse.status);
    console.log("Location header:", authResponse.locationHeader);

    // Step 4: Extract code
    const params = parseQueryParams(authResponse.locationHeader);
    const code = params.code;
    const state = params.state;

    console.log("\nStep 4: Extracted params");
    console.log("Code:", code);
    console.log("State:", state);

    if (!code) {
      console.log("ERROR: No code in response!");
      return;
    }

    // Step 5: Exchange for token
    console.log("\nStep 5: Exchanging code for tokens...");
    console.log("Request body:", {
      grant_type: "authorization_code",
      client_id: clientId,
      redirect_uri: redirectUri,
      code: code.substring(0, 20) + "...",
      code_verifier: verifier.substring(0, 20) + "...",
    });

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

    console.log("\nToken response status:", tokenResponse.status);
    console.log("Token response data:", tokenResponse.data);

    if (tokenResponse.status === 200) {
      console.log("\n✅ SUCCESS!");
      console.log("Access token:", tokenResponse.data.access_token ? "✅ present" : "❌ missing");
      console.log("ID token:", tokenResponse.data.id_token ? "✅ present" : "❌ missing");
    } else {
      console.log("\n❌ FAILED!");
      console.log("Error:", tokenResponse.data.error);
      console.log("Error description:", tokenResponse.data.error_description);
    }
  } catch (error: any) {
    console.error("Exception:", error.message);
  }
}

testTokenExchange();
