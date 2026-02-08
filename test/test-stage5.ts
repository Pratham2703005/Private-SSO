import axios, { AxiosError } from "axios";
import { TestHttpClient } from "./utils/http-client";
import { TEST_USER } from "./fixtures/test-users";
import { OAUTH_CLIENTS, VALID_REDIRECT_URIS } from "./fixtures/oauth-clients";
import { generatePKCE } from "./fixtures/pkce";

const IDP_BASE_URL = "http://localhost:3000";

interface TokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
}

interface ErrorResponse {
  error: string;
  error_description: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function test1_HappyPath(): Promise<boolean> {
  console.log("\n[Test 1] Happy Path: Login → Authorize → Token Exchange");

  try {
    const http = new TestHttpClient();

    // Step 1: Login
    console.log("  • Logging in...");
    await http.loginWithCredentials(TEST_USER.email, TEST_USER.password);

    // Step 2: Generate PKCE challenge
    const { verifier, challenge } = generatePKCE();
    console.log("  • PKCE generated (challenge length:", challenge.length + ")");

    // Step 3: Hit authorize endpoint
    console.log("  • Hitting /authorize endpoint...");
    const clientId = OAUTH_CLIENTS.VALID_CLIENT_A.clientId;
    const redirectUri = VALID_REDIRECT_URIS.CLIENT_A;

    const authResponse = await http.authorizeWithSession(clientId, redirectUri, "test_state", challenge);

    if (!authResponse.locationHeader) {
      console.log("  ❌ No Location header in authorize response");
      return false;
    }

    console.log("  • Redirected successfully");

    // Step 4: Extract code from redirect
    const params = parseQueryParams(authResponse.locationHeader);
    const code = params.code;
    const state = params.state;

    if (!code || !state) {
      console.log("  ❌ Code or state missing in redirect");
      return false;
    }

    console.log("  • Code extracted (length:", code.length + ")");
    console.log("  • State preserved:", state === "test_state");

    // Step 5: Exchange code for tokens
    console.log("  • Exchanging code for tokens...");
    const tokenResponse = await axios.post<TokenResponse>(
      `${IDP_BASE_URL}/api/auth/token`,
      {
        grant_type: "authorization_code",
        client_id: clientId,
        redirect_uri: redirectUri,
        code,
        code_verifier: verifier,
      }
    );

    // Step 6: Verify response
    if (tokenResponse.status !== 200) {
      console.log("  ❌ Expected status 200, got", tokenResponse.status);
      return false;
    }

    const { access_token, id_token, token_type, expires_in } = tokenResponse.data;

    if (!access_token) {
      console.log("  ❌ access_token missing");
      return false;
    }

    if (!id_token) {
      console.log("  ❌ id_token missing");
      return false;
    }

    if (token_type !== "Bearer") {
      console.log("  ❌ token_type should be Bearer, got", token_type);
      return false;
    }

    if (!expires_in || expires_in !== 86400) {
      console.log("  ❌ expires_in should be 86400, got", expires_in);
      return false;
    }

    console.log("  ✅ Status 200");
    console.log("  ✅ access_token exists (length:", access_token.length + ")");
    console.log("  ✅ id_token exists (length:", id_token.length + ")");
    console.log("  ✅ token_type is Bearer");
    console.log("  ✅ expires_in is 86400");

    return true;
  } catch (error) {
    const err = error as AxiosError<ErrorResponse>;
    console.log("  ❌ Error:", err.message);
    if (err.response?.data) {
      console.log("     Error code:", err.response.data.error);
    }
    return false;
  }
}

async function test2_InvalidCode(): Promise<boolean> {
  console.log("\n[Test 2] Invalid Code");

  try {
    const http = new TestHttpClient();

    // Login first
    await http.loginWithCredentials(TEST_USER.email, TEST_USER.password);

    const { verifier } = generatePKCE();
    const clientId = OAUTH_CLIENTS.VALID_CLIENT_A.clientId;
    const redirectUri = VALID_REDIRECT_URIS.CLIENT_A;

    // Try exchanging invalid code
    console.log("  • Attempting token exchange with invalid code...");
    const response = await axios.post<ErrorResponse>(
      `${IDP_BASE_URL}/api/auth/token`,
      {
        grant_type: "authorization_code",
        client_id: clientId,
        redirect_uri: redirectUri,
        code: "invalid_code_12345",
        code_verifier: verifier,
      },
      { validateStatus: () => true }
    );

    if (response.status !== 400) {
      console.log("  ❌ Expected status 400, got", response.status);
      return false;
    }

    if (response.data.error !== "invalid_grant") {
      console.log("  ❌ Expected error invalid_grant, got", response.data.error);
      return false;
    }

    console.log("  ✅ Status 400");
    console.log("  ✅ Error is invalid_grant");

    return true;
  } catch (error) {
    const err = error as AxiosError<ErrorResponse>;
    console.log("  ❌ Error:", err.message);
    return false;
  }
}

async function test3_CodeReuse(): Promise<boolean> {
  console.log("\n[Test 3] Code Reuse (Single-Use Enforcement)");

  try {
    const http = new TestHttpClient();

    // Step 1: Login
    await http.loginWithCredentials(TEST_USER.email, TEST_USER.password);

    // Step 2: Generate PKCE and get code
    const { verifier, challenge } = generatePKCE();
    const clientId = OAUTH_CLIENTS.VALID_CLIENT_A.clientId;
    const redirectUri = VALID_REDIRECT_URIS.CLIENT_A;

    const authResponse = await http.authorizeWithSession(clientId, redirectUri, "test_state", challenge);

    if (!authResponse.locationHeader) {
      console.log("  ❌ Failed to get authorization response");
      return false;
    }

    const params = parseQueryParams(authResponse.locationHeader);
    const code = params.code;

    if (!code) {
      console.log("  ❌ Failed to get authorization code");
      return false;
    }

    console.log("  • Code obtained (length:", code.length + ")");

    // Step 3: First exchange - should succeed
    console.log("  • First exchange attempt...");
    const firstExchange = await axios.post<TokenResponse>(
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

    if (firstExchange.status !== 200) {
      console.log("  ❌ First exchange failed with status", firstExchange.status);
      return false;
    }

    console.log("  ✅ First exchange successful");

    // Step 4: Second exchange with same code - should fail
    console.log("  • Attempting code reuse...");
    const secondExchange = await axios.post<ErrorResponse>(
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

    if (secondExchange.status !== 400) {
      console.log("  ❌ Expected status 400, got", secondExchange.status);
      return false;
    }

    if (secondExchange.data.error !== "invalid_grant") {
      console.log("  ❌ Expected error invalid_grant, got", secondExchange.data.error);
      return false;
    }

    console.log("  ✅ Status 400");
    console.log("  ✅ Error is invalid_grant (code reuse prevented)");

    return true;
  } catch (error) {
    const err = error as AxiosError<ErrorResponse>;
    console.log("  ❌ Error:", err.message);
    return false;
  }
}

async function test4_WrongVerifier(): Promise<boolean> {
  console.log("\n[Test 4] PKCE Mismatch: Wrong Verifier");

  try {
    const http = new TestHttpClient();

    // Step 1: Login
    await http.loginWithCredentials(TEST_USER.email, TEST_USER.password);

    // Step 2: Generate TWO sets of PKCE - one for authorize, one wrong for token
    const { verifier: correctVerifier, challenge } = generatePKCE();
    const { verifier: wrongVerifier } = generatePKCE();

    console.log("  • Created two different PKCE pairs (verifiers are different)");

    const clientId = OAUTH_CLIENTS.VALID_CLIENT_A.clientId;
    const redirectUri = VALID_REDIRECT_URIS.CLIENT_A;

    // Step 3: Authorize with first challenge
    const authResponse = await http.authorizeWithSession(clientId, redirectUri, "test_state", challenge);

    if (!authResponse.locationHeader) {
      console.log("  ❌ Failed to get authorization response");
      return false;
    }

    const params = parseQueryParams(authResponse.locationHeader);
    const code = params.code;

    if (!code) {
      console.log("  ❌ Failed to get authorization code");
      return false;
    }

    console.log("  • Code obtained");

    // Step 4: Try to exchange with WRONG verifier
    console.log("  • Attempting token exchange with wrong verifier...");
    const tokenExchange = await axios.post<ErrorResponse>(
      `${IDP_BASE_URL}/api/auth/token`,
      {
        grant_type: "authorization_code",
        client_id: clientId,
        redirect_uri: redirectUri,
        code,
        code_verifier: wrongVerifier, // WRONG - doesn't match challenge
      },
      { validateStatus: () => true }
    );

    if (tokenExchange.status !== 400) {
      console.log("  ❌ Expected status 400, got", tokenExchange.status);
      return false;
    }

    if (tokenExchange.data.error !== "invalid_grant") {
      console.log("  ❌ Expected error invalid_grant, got", tokenExchange.data.error);
      return false;
    }

    console.log("  ✅ Status 400");
    console.log("  ✅ Error is invalid_grant (PKCE validation failed)");

    return true;
  } catch (error) {
    const err = error as AxiosError<ErrorResponse>;
    console.log("  ❌ Error:", err.message);
    return false;
  }
}

async function test5_MissingVerifier(): Promise<boolean> {
  console.log("\n[Test 5] Missing Code Verifier");

  try {
    const http = new TestHttpClient();

    // Login first
    await http.loginWithCredentials(TEST_USER.email, TEST_USER.password);

    const { challenge } = generatePKCE();
    const clientId = OAUTH_CLIENTS.VALID_CLIENT_A.clientId;
    const redirectUri = VALID_REDIRECT_URIS.CLIENT_A;

    const authResponse = await http.authorizeWithSession(clientId, redirectUri, "test_state", challenge);

    if (!authResponse.locationHeader) {
      console.log("  ❌ Failed to get authorization response");
      return false;
    }

    const params = parseQueryParams(authResponse.locationHeader);
    const code = params.code;

    if (!code) {
      console.log("  ❌ Failed to get authorization code");
      return false;
    }

    // Try exchanging WITHOUT code_verifier
    console.log("  • Attempting token exchange without code_verifier...");
    const tokenExchange = await axios.post<ErrorResponse>(
      `${IDP_BASE_URL}/api/auth/token`,
      {
        grant_type: "authorization_code",
        client_id: clientId,
        redirect_uri: redirectUri,
        code,
        // code_verifier: MISSING
      },
      { validateStatus: () => true }
    );

    if (tokenExchange.status !== 400) {
      console.log("  ❌ Expected status 400, got", tokenExchange.status);
      return false;
    }

    if (tokenExchange.data.error !== "invalid_request") {
      console.log("  ❌ Expected error invalid_request, got", tokenExchange.data.error);
      return false;
    }

    console.log("  ✅ Status 400");
    console.log("  ✅ Error is invalid_request");

    return true;
  } catch (error) {
    const err = error as AxiosError<ErrorResponse>;
    console.log("  ❌ Error:", err.message);
    return false;
  }
}

async function test6_WrongRedirectUri(): Promise<boolean> {
  console.log("\n[Test 6] Wrong Redirect URI");

  try {
    const http = new TestHttpClient();

    // Login first
    await http.loginWithCredentials(TEST_USER.email, TEST_USER.password);

    const { verifier, challenge } = generatePKCE();
    const clientId = OAUTH_CLIENTS.VALID_CLIENT_A.clientId;
    const redirectUri = VALID_REDIRECT_URIS.CLIENT_A;

    // Authorize with correct redirect_uri
    const authResponse = await http.authorizeWithSession(clientId, redirectUri, "test_state", challenge);

    if (!authResponse.locationHeader) {
      console.log("  ❌ Failed to get authorization response");
      return false;
    }

    const params = parseQueryParams(authResponse.locationHeader);
    const code = params.code;

    if (!code) {
      console.log("  ❌ Failed to get authorization code");
      return false;
    }

    // Try to exchange with WRONG redirect_uri
    console.log("  • Attempting token exchange with wrong redirect_uri...");
    const tokenExchange = await axios.post<ErrorResponse>(
      `${IDP_BASE_URL}/api/auth/token`,
      {
        grant_type: "authorization_code",
        client_id: clientId,
        redirect_uri: "http://localhost:9999/wrong/uri", // WRONG
        code,
        code_verifier: verifier,
      },
      { validateStatus: () => true }
    );

    if (tokenExchange.status !== 400) {
      console.log("  ❌ Expected status 400, got", tokenExchange.status);
      return false;
    }

    if (tokenExchange.data.error !== "invalid_grant") {
      console.log("  ❌ Expected error invalid_grant, got", tokenExchange.data.error);
      return false;
    }

    console.log("  ✅ Status 400");
    console.log("  ✅ Error is invalid_grant");

    return true;
  } catch (error) {
    const err = error as AxiosError<ErrorResponse>;
    console.log("  ❌ Error:", err.message);
    return false;
  }
}

async function test7_MissingParams(): Promise<boolean> {
  console.log("\n[Test 7] Missing Required Parameters");

  try {
    // Try minimal request - missing everything important
    console.log("  • Attempting token exchange with minimal body...");
    const tokenExchange = await axios.post<ErrorResponse>(
      `${IDP_BASE_URL}/api/auth/token`,
      {
        // Missing: grant_type, client_id, redirect_uri, code, code_verifier
      },
      { validateStatus: () => true }
    );

    if (tokenExchange.status !== 400) {
      console.log("  ❌ Expected status 400, got", tokenExchange.status);
      return false;
    }

    if (tokenExchange.data.error !== "invalid_request") {
      console.log("  ❌ Expected error invalid_request, got", tokenExchange.data.error);
      return false;
    }

    console.log("  ✅ Status 400");
    console.log("  ✅ Error is invalid_request");

    return true;
  } catch (error) {
    const err = error as AxiosError<ErrorResponse>;
    console.log("  ❌ Error:", err.message);
    return false;
  }
}

async function test8_ExpiredCode(): Promise<boolean> {
  console.log("\n[Test 8] Expired Authorization Code (TTL enforcement)");
  console.log("⚠️  This test requires 5 second TTL for the authorization code");

  try {
    const http = new TestHttpClient();

    // Step 1: Login
    await http.loginWithCredentials(TEST_USER.email, TEST_USER.password);

    // Step 2: Get authorization code with 5-second TTL
    const { verifier, challenge } = generatePKCE();
    const clientId = OAUTH_CLIENTS.VALID_CLIENT_A.clientId;
    const redirectUri = VALID_REDIRECT_URIS.CLIENT_A;

    // Use ttl_seconds query param to set 5-second expiry for testing
    const authResponse = await http.authorizeWithSession(clientId, redirectUri, "test_state", challenge, 5);

    if (!authResponse.locationHeader) {
      console.log("  ❌ Failed to get authorization response");
      return false;
    }

    const params = parseQueryParams(authResponse.locationHeader);
    const code = params.code;

    if (!code) {
      console.log("  ❌ Failed to get authorization code");
      return false;
    }

    console.log("  • Code obtained (TTL: 5 seconds)");

    // Step 3: Wait for code to expire (5 sec TTL + safety margin)
    console.log("  • Waiting 6 seconds for code to expire...");
    await sleep(6000);

    // Step 4: Try to use expired code
    console.log("  • Attempting token exchange with expired code...");
    const tokenExchange = await axios.post<ErrorResponse>(
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

    if (tokenExchange.status !== 400) {
      console.log("  ❌ Expected status 400, got", tokenExchange.status);
      return false;
    }

    if (tokenExchange.data.error !== "invalid_grant") {
      console.log("  ❌ Expected error invalid_grant, got", tokenExchange.data.error);
      return false;
    }

    console.log("  ✅ Status 400");
    console.log("  ✅ Error is invalid_grant (code expired)");

    return true;
  } catch (error) {
    const err = error as AxiosError<ErrorResponse>;
    console.log("  ❌ Error:", err.message);
    return false;
  }
}

async function runTests(): Promise<void> {
  console.log("-".repeat(42));
  console.log("|     STAGE 5: TOKEN EXCHANGE TESTS      |");
  console.log("-".repeat(42));

  const startTime = Date.now();

  // Run tests sequentially instead of in parallel to avoid DB conflicts
  const results = [
    await test1_HappyPath(),
    await test2_InvalidCode(),
    await test3_CodeReuse(),
    await test4_WrongVerifier(),
    await test5_MissingVerifier(),
    await test6_WrongRedirectUri(),
    await test7_MissingParams(),
    await test8_ExpiredCode(),
  ];

  const passed = results.filter((r) => r).length;
  const failed = results.length - passed;
  const totalTime = Date.now() - startTime;

  console.log("\n" + "-".repeat(42));
  console.log(`| TOTAL: ${passed}/${results.length} PASSED ${passed === results.length ? "✅" : "❌"}        |`);
  console.log(`| Execution Time: ${totalTime}ms`);
  console.log("-".repeat(42));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
