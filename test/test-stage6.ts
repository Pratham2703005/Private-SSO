import axios from "axios";
import { createHash, randomBytes } from "crypto";
import { TEST_USER } from "./fixtures/test-users";

const IDP_URL = "http://localhost:3000";
const CLIENT_A_URL = "http://localhost:3001";
const CLIENT_ID = "client-a";
const REDIRECT_URI = `${CLIENT_A_URL}/api/auth/callback`;

// Helper to log test results
interface TestResult {
  passed: boolean;
  name: string;
  details: string;
}

const results: TestResult[] = [];

// Generate random 32-byte state and code_verifier for PKCE
function generateState(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Helper to ensure user exists and login
async function loginOnIDP(): Promise<string> {
  try {
    // Login with test credentials
    const response = await axios.post(
      `${IDP_URL}/api/auth/login`,
      { 
        email: TEST_USER.email, 
        password: TEST_USER.password 
      },
      { 
        withCredentials: true,
        validateStatus: () => true // Don't throw on 4xx/5xx
      }
    );

    if (response.status !== 200) {
      throw new Error(`Login failed: ${response.status} ${response.data?.error}`);
    }

    const cookieHeader = response.headers["set-cookie"];
    if (!cookieHeader || cookieHeader.length === 0) {
      throw new Error("No set-cookie headers in response");
    }

    // Look for master SSO session cookie (__sso_session or idp_session)
    const sessionCookie = cookieHeader.find((c: string) =>
      c.includes("__sso_session=") || c.includes("idp_session=")
    );
    
    if (!sessionCookie) {
      throw new Error("No master session cookie");
    }
    
    return sessionCookie.split(";")[0];
  } catch (error: any) {
    console.error("❌ Failed to login on IDP:", error.message);
    return "";
  }
}

// Test helper
async function runTest(
  testNum: number,
  testName: string,
  testFn: () => Promise<void>
) {
  try {
    console.log(`\n[Test ${testNum}] ${testName}`);
    await testFn();
    results.push({ passed: true, name: testName, details: "✅ Passed" });
    console.log("  ✅ PASSED");
  } catch (error) {
    results.push({
      passed: false,
      name: testName,
      details: `❌ ${(error as Error).message}`,
    });
    console.log(`  ❌ FAILED: ${(error as Error).message}`);
  }
}

// Tests
async function test1_HappyPath() {
  // Login on IDP
  const idpCookie = await loginOnIDP();
  if (!idpCookie) throw new Error("Failed to login on IDP");

  // Start authorization (get authorize URL with PKCE)
  const startResponse = await axios.get(`${CLIENT_A_URL}/api/auth/start`, {
    withCredentials: true,
  });
  const authorizeUrl = startResponse.data.url;
  const pkceVerifierCookie = startResponse.headers["set-cookie"]
    ?.find((c: string) => c.includes("pkce_verifier="))
    ?.split(";")[0];

  if (!pkceVerifierCookie) throw new Error("No PKCE verifier cookie set");

  // Extract PKCE challenge from URL
  const urlObj = new URL(authorizeUrl);
  const challenge = urlObj.searchParams.get("code_challenge");
  const state = urlObj.searchParams.get("state");

  if (!challenge || !state) throw new Error("Missing challenge or state in URL");

  // Simulate: Get authorization code from IDP
  const idpAuthResponse = await axios.get(
    `${IDP_URL}/api/auth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
      REDIRECT_URI
    )}&state=${state}&scopes=profile,email&code_challenge=${challenge}&code_challenge_method=S256`,
    {
      headers: { Cookie: idpCookie },
      maxRedirects: 0,
      validateStatus: (status) => status === 307,
    }
  );

  const location = idpAuthResponse.headers.location;
  const callbackUrl = new URL(location, REDIRECT_URI);
  const code = callbackUrl.searchParams.get("code");

  if (!code) throw new Error("No code in callback URL");

  // Call client callback with code + state
  const callbackResponse = await axios.get(
    `${CLIENT_A_URL}/api/auth/callback?code=${code}&state=${state}`,
    {
      headers: { Cookie: pkceVerifierCookie },
      maxRedirects: 0,
      validateStatus: (status) => status === 307,
    }
  );

  if (callbackResponse.status !== 307)
    throw new Error(
      `Expected 307 redirect, got ${callbackResponse.status}`
    );

  const redirectLocation = callbackResponse.headers.location;
  if (!redirectLocation.includes("/dashboard"))
    throw new Error(
      `Expected redirect to /dashboard, got ${redirectLocation}`
    );

  // Verify session cookie was set
  const sessionCookie = callbackResponse.headers["set-cookie"]?.find((c: string) =>
    c.includes("app_session=")
  );
  if (!sessionCookie) throw new Error("No app_session cookie set");

  console.log("    ✅ Code exchanged successfully");
  console.log("    ✅ Session cookie created");
  console.log("    ✅ Redirected to /dashboard");
}

async function test2_InvalidState() {
  // Login on IDP
  const idpCookie = await loginOnIDP();
  if (!idpCookie) throw new Error("Failed to login on IDP");

  // Start authorization
  const startResponse = await axios.get(`${CLIENT_A_URL}/api/auth/start`, {
    withCredentials: true,
  });
  const authorizeUrl = startResponse.data.url;
  const pkceVerifierCookie = startResponse.headers["set-cookie"]?.find((c: string) =>
    c.includes("pkce_verifier=")
  );

  // Get code with valid state
  const urlObj = new URL(authorizeUrl);
  const challenge = urlObj.searchParams.get("code_challenge");
  const validState = urlObj.searchParams.get("state");

  const idpAuthResponse = await axios.get(
    `${IDP_URL}/api/auth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
      REDIRECT_URI
    )}&state=${validState}&scopes=profile,email&code_challenge=${challenge}&code_challenge_method=S256`,
    {
      headers: { Cookie: idpCookie },
      maxRedirects: 0,
      validateStatus: (status) => status === 307,
    }
  );

  const location = idpAuthResponse.headers.location;
  const callbackUrl = new URL(location, REDIRECT_URI);
  const code = callbackUrl.searchParams.get("code");

  // Call callback with TAMPERED state
  const fakeState = "invalid_state_123";
  const callbackResponse = await axios.get(
    `${CLIENT_A_URL}/api/auth/callback?code=${code}&state=${fakeState}`,
    {
      headers: { Cookie: pkceVerifierCookie },
      maxRedirects: 0,
      validateStatus: (status) => status === 307,
    }
  );

  if (callbackResponse.status !== 307)
    throw new Error(`Expected 307, got ${callbackResponse.status}`);

  const redirect = callbackResponse.headers.location;
  if (!redirect.includes("csrf_validation_failed"))
    throw new Error(`Expected CSRF error, got redirect to ${redirect}`);

  console.log(
    "    ✅ CSRF validation prevented state tampering"
  );
}

async function test3_MissingState() {
  // Start authorization
  const startResponse = await axios.get(`${CLIENT_A_URL}/api/auth/start`, {
    withCredentials: true,
  });
  const pkceVerifierCookie = startResponse.headers["set-cookie"]?.find((c: string) =>
    c.includes("pkce_verifier=")
  );

  // Call callback WITHOUT state
  const callbackResponse = await axios.get(
    `${CLIENT_A_URL}/api/auth/callback?code=some_code`,
    {
      headers: { Cookie: pkceVerifierCookie },
      maxRedirects: 0,
      validateStatus: (status) => status === 307,
    }
  );

  if (callbackResponse.status !== 307)
    throw new Error(`Expected 307, got ${callbackResponse.status}`);

  const redirect = callbackResponse.headers.location;
  if (!redirect.includes("csrf_validation_failed"))
    throw new Error(`Expected state validation error, got ${redirect}`);

  console.log("    ✅ Missing state rejected");
}

async function test4_MissingCode() {
  // Start authorization (generates state)
  const startResponse = await axios.get(`${CLIENT_A_URL}/api/auth/start`, {
    withCredentials: true,
  });
  const authorizeUrl = startResponse.data.url;
  const pkceVerifierCookie = startResponse.headers["set-cookie"]?.find((c: string) =>
    c.includes("pkce_verifier=")
  );

  // Extract state from URL
  const urlObj = new URL(authorizeUrl);
  const state = urlObj.searchParams.get("state");

  // Call callback WITHOUT code
  const callbackResponse = await axios.get(
    `${CLIENT_A_URL}/api/auth/callback?state=${state}`,
    {
      headers: { Cookie: pkceVerifierCookie },
      maxRedirects: 0,
      validateStatus: (status) => status === 307,
    }
  );

  if (callbackResponse.status !== 307)
    throw new Error(`Expected 307, got ${callbackResponse.status}`);

  const redirect = callbackResponse.headers.location;
  if (!redirect.includes("missing_code"))
    throw new Error(`Expected missing_code error, got ${redirect}`);

  console.log("    ✅ Missing code rejected");
}

async function test5_CodeExchangeFails() {
  // Start authorization
  const startResponse = await axios.get(`${CLIENT_A_URL}/api/auth/start`, {
    withCredentials: true,
  });
  const authorizeUrl = startResponse.data.url;
  const pkceVerifierCookie = startResponse.headers["set-cookie"]?.find((c: string) =>
    c.includes("pkce_verifier=")
  );

  // Extract state from URL
  const urlObj = new URL(authorizeUrl);
  const state = urlObj.searchParams.get("state");

  // Use invalid code
  const invalidCode = "invalid-code-123";

  // Call callback with invalid code
  const callbackResponse = await axios.get(
    `${CLIENT_A_URL}/api/auth/callback?code=${invalidCode}&state=${state}`,
    {
      headers: { Cookie: pkceVerifierCookie },
      maxRedirects: 0,
      validateStatus: (status) => status === 307,
    }
  );

  if (callbackResponse.status !== 307)
    throw new Error(`Expected 307, got ${callbackResponse.status}`);

  const redirect = callbackResponse.headers.location;
  if (!redirect.includes("invalid_grant") && !redirect.includes("invalid_request"))
    throw new Error(`Expected error, got redirect to ${redirect}`);

  console.log("    ✅ Invalid code exchange rejected");
}

async function test6_MissingCodeVerifier() {
  // Start authorization
  const startResponse = await axios.get(`${CLIENT_A_URL}/api/auth/start`, {
    withCredentials: true,
  });
  const authorizeUrl = startResponse.data.url;

  // Get valid code
  const idpCookie = await loginOnIDP();
  const urlObj = new URL(authorizeUrl);
  const challenge = urlObj.searchParams.get("code_challenge");
  const state = urlObj.searchParams.get("state");

  const idpAuthResponse = await axios.get(
    `${IDP_URL}/api/auth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
      REDIRECT_URI
    )}&state=${state}&scopes=profile,email&code_challenge=${challenge}&code_challenge_method=S256`,
    {
      headers: { Cookie: idpCookie },
      maxRedirects: 0,
      validateStatus: (status) => status === 307,
    }
  );

  const location = idpAuthResponse.headers.location;
  const callbackUrl = new URL(location, REDIRECT_URI);
  const code = callbackUrl.searchParams.get("code");

  // Call callback WITHOUT pkce_verifier cookie
  const callbackResponse = await axios.get(
    `${CLIENT_A_URL}/api/auth/callback?code=${code}&state=${state}`,
    {
      maxRedirects: 0,
      validateStatus: (status) => status === 307,
    }
  );

  if (callbackResponse.status !== 307)
    throw new Error(`Expected 307, got ${callbackResponse.status}`);

  const redirect = callbackResponse.headers.location;
  if (!redirect.includes("missing_verifier") && !redirect.includes("invalid_grant"))
    throw new Error(`Expected verifier error, got ${redirect}`);

  console.log("    ✅ Missing code_verifier rejected");
}

async function test7_PKCEMismatch() {
  // Login on IDP
  const idpCookie = await loginOnIDP();
  if (!idpCookie) throw new Error("Failed to login on IDP");

  // Start authorization with one PKCE pair
  const startResponse = await axios.get(`${CLIENT_A_URL}/api/auth/start`, {
    withCredentials: true,
  });
  const authorizeUrl = startResponse.data.url;
  const pkceVerifierCookie = startResponse.headers["set-cookie"]?.find((c: string) =>
    c.includes("pkce_verifier=")
  );

  // Get code with original challenge
  const urlObj = new URL(authorizeUrl);
  const challenge = urlObj.searchParams.get("code_challenge");
  const state = urlObj.searchParams.get("state");

  const idpAuthResponse = await axios.get(
    `${IDP_URL}/api/auth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
      REDIRECT_URI
    )}&state=${state}&scopes=profile,email&code_challenge=${challenge}&code_challenge_method=S256`,
    {
      headers: { Cookie: idpCookie },
      maxRedirects: 0,
      validateStatus: (status) => status === 307,
    }
  );

  const location = idpAuthResponse.headers.location;
  const callbackUrl = new URL(location, REDIRECT_URI);
  const code = callbackUrl.searchParams.get("code");

  // Manually create wrong verifier
  const wrongVerifier = randomBytes(32).toString("base64url");

  // Manually set a different verifier cookie and call callback
  const callbackResponse = await axios.get(
    `${CLIENT_A_URL}/api/auth/callback?code=${code}&state=${state}`,
    {
      headers: {
        Cookie: `pkce_verifier=${wrongVerifier}; path=/`,
      },
      maxRedirects: 0,
      validateStatus: (status) => status === 307,
    }
  );

  if (callbackResponse.status !== 307)
    throw new Error(`Expected 307, got ${callbackResponse.status}`);

  const redirect = callbackResponse.headers.location;
  if (!redirect.includes("invalid_grant"))
    throw new Error(`Expected PKCE validation error, got ${redirect}`);

  console.log("    ✅ PKCE mismatch prevented token exchange");
}

async function test8_UserEndpointWithSession() {
  // Complete happy path first
  const idpCookie = await loginOnIDP();
  if (!idpCookie) throw new Error("Failed to login on IDP");

  const startResponse = await axios.get(`${CLIENT_A_URL}/api/auth/start`, {
    withCredentials: true,
  });
  const authorizeUrl = startResponse.data.url;
  const pkceVerifierCookie = startResponse.headers["set-cookie"]?.find((c: string) =>
    c.includes("pkce_verifier=")
  );

  const urlObj = new URL(authorizeUrl);
  const challenge = urlObj.searchParams.get("code_challenge");
  const state = urlObj.searchParams.get("state");

  const idpAuthResponse = await axios.get(
    `${IDP_URL}/api/auth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
      REDIRECT_URI
    )}&state=${state}&scopes=profile,email&code_challenge=${challenge}&code_challenge_method=S256`,
    {
      headers: { Cookie: idpCookie },
      maxRedirects: 0,
      validateStatus: (status) => status === 307,
    }
  );

  const location = idpAuthResponse.headers.location;
  const callbackUrl = new URL(location, REDIRECT_URI);
  const code = callbackUrl.searchParams.get("code");

  const callbackResponse = await axios.get(
    `${CLIENT_A_URL}/api/auth/callback?code=${code}&state=${state}`,
    {
      headers: { Cookie: pkceVerifierCookie },
      maxRedirects: 0,
      validateStatus: (status) => status === 307,
    }
  );

  const sessionCookie = callbackResponse.headers["set-cookie"]?.find((c: string) =>
    c.includes("app_session=")
  );

  if (!sessionCookie) throw new Error("No app_session cookie");

  // Now call user endpoint with session cookie
  const userResponse = await axios.get(`${CLIENT_A_URL}/api/user`, {
    headers: { Cookie: sessionCookie.split(";")[0] },
  });

  if (userResponse.status !== 200)
    throw new Error(`Expected 200, got ${userResponse.status}`);

  const user = userResponse.data.data;
  if (!user || !user.id)
    throw new Error("No user data returned from /api/user");

  console.log("    ✅ User endpoint returned user profile");
  console.log(`    ✅ User ID: ${user.id.substring(0, 12)}...`);
}

// Main test runner
async function runAllTests() {
  console.log(
    "\n" +
    "------------------------------------------\n" +
    "|    STAGE 6: CLIENT A CALLBACK TESTS    |\n" +
    "------------------------------------------"
  );

  await runTest(1, "Happy Path: Login → Code Exchange → Session", test1_HappyPath);
  await runTest(2, "Invalid/Tampered State", test2_InvalidState);
  await runTest(3, "Missing State Parameter", test3_MissingState);
  await runTest(4, "Missing Code Parameter", test4_MissingCode);
  await runTest(5, "Code Exchange Fails (Invalid Code)", test5_CodeExchangeFails);
  await runTest(6, "Missing PKCE Verifier Cookie", test6_MissingCodeVerifier);
  await runTest(7, "PKCE Mismatch (Wrong Verifier)", test7_PKCEMismatch);
  await runTest(8, "User Endpoint With Session", test8_UserEndpointWithSession);

  // Summary
  console.log(
    "\n" +
    "------------------------------------------"
  );

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  console.log(`| TOTAL: ${passed}/${total} PASSED ${passed === total ? "✅" : "❌"}`);
  console.log("------------------------------------------\n");

  if (passed < total) {
    console.log("Failed tests:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  ❌ ${r.name}: ${r.details}`);
      });
    process.exit(1);
  }
}

runAllTests().catch((error) => {
  console.error("❌ Test suite error:", error);
  process.exit(1);
});
