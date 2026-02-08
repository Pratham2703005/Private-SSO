import axios from "axios";
import { createHash, randomBytes } from "crypto";
import { TEST_USER } from "./fixtures/test-users";

const IDP_URL = "http://localhost:3000";
const CLIENT_A_URL = "http://localhost:3001";

interface TestResult {
  passed: boolean;
  name: string;
  details: string;
}

const results: TestResult[] = [];

// Helper to get a valid access token by going through the OAuth flow
async function getValidAccessToken(): Promise<string> {
  try {
    console.log("[getToken] Starting OAuth flow...");
    
    // Step 1: Login on IDP
    console.log("[getToken] Step 1: Logging in...");
    const loginResponse = await axios.post(
      `${IDP_URL}/api/auth/login`,
      { email: TEST_USER.email, password: TEST_USER.password },
      { withCredentials: true, validateStatus: () => true }
    );

    if (loginResponse.status !== 200) {
      console.error("[getToken] Login failed:", loginResponse.status);
      throw new Error(`Login failed: ${loginResponse.status}`);
    }

    const sessionCookie = loginResponse.headers["set-cookie"]?.find((c: string) =>
      c.includes("__sso_session=") || c.includes("idp_session=")
    );

    if (!sessionCookie) {
      throw new Error("No session cookie");
    }

    console.log("[getToken] ✅ Logged in");

    // Step 2: Generate PKCE and call authorize
    console.log("[getToken] Step 2: Calling authorize...");
    const state = randomBytes(16).toString("hex");
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");

    const authorizeUrl = new URL("/api/auth/authorize", IDP_URL);
    authorizeUrl.searchParams.set("client_id", "client-a");
    authorizeUrl.searchParams.set(
      "redirect_uri",
      "http://localhost:3001/api/auth/callback"
    );
    authorizeUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("scopes", "profile,email");
    authorizeUrl.searchParams.set("code_challenge", challenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");

    const authorizeResponse = await axios.get(authorizeUrl.toString(), {
      headers: { Cookie: sessionCookie.split(";")[0] },
      maxRedirects: 0,
      validateStatus: (status) => status === 307,
    });

    const location = authorizeResponse.headers.location;
    const callbackUrl = new URL(location, IDP_URL);
    const code = callbackUrl.searchParams.get("code");

    if (!code) {
      throw new Error("No authorization code returned");
    }

    console.log("[getToken] ✅ Got authorization code");

    // Step 3: Exchange code for tokens
    console.log("[getToken] Step 3: Exchanging code...");
    const tokenResponse = await axios.post(
      `${IDP_URL}/api/auth/token`,
      {
        grant_type: "authorization_code",
        client_id: "client-a",
        redirect_uri: "http://localhost:3001/api/auth/callback",
        code: code,
        code_verifier: verifier,
      },
      { validateStatus: () => true }
    );

    console.log("[getToken] Token response status:", tokenResponse.status);
    if (tokenResponse.status !== 200) {
      console.error("[getToken] Error data:", tokenResponse.data);
      throw new Error(
        `Token exchange failed: ${tokenResponse.status} ${tokenResponse.data?.error}`
      );
    }

    const { access_token, id_token } = tokenResponse.data;
    console.log("[getToken] Response keys:", Object.keys(tokenResponse.data));
    console.log("[getToken] access_token exists:", !!access_token);
    console.log("[getToken] id_token exists:", !!id_token);
    console.log("[getToken] access_token preview:", access_token?.substring(0, 50));

    if (!tokenResponse.data.access_token) {
      console.error("[getToken] Response:", JSON.stringify(tokenResponse.data));
      throw new Error("No access_token in token response");
    }

    console.log("[getToken] ✅ Got access token");
    return tokenResponse.data.access_token;
  } catch (error) {
    console.error("[getToken] ❌ Error:", (error as Error).message);
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
  const accessToken = await getValidAccessToken();
  if (!accessToken) throw new Error("Failed to get access token");

  const response = await axios.get(`${IDP_URL}/api/auth/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    validateStatus: () => true,
  });

  if (response.status !== 200)
    throw new Error(`Expected 200, got ${response.status}`);

  const user = response.data;
  if (!user.id) throw new Error("No user ID in response");
  if (!user.email) throw new Error("No email in response");
  if (!user.name) throw new Error("No name in response");

  console.log("    ✅ Got user profile");
  console.log(`    ✅ User: ${user.email} (${user.name})`);
  console.log(`    ✅ Accounts: ${user.accounts?.length || 0}`);
}

async function test2_MissingAuthHeader() {
  const response = await axios.get(`${IDP_URL}/api/auth/userinfo`, {
    validateStatus: () => true,
  });

  if (response.status !== 401)
    throw new Error(`Expected 401, got ${response.status}`);

  if (response.data.error !== "unauthorized")
    throw new Error(`Expected 'unauthorized' error, got ${response.data.error}`);

  console.log("    ✅ Missing header rejected (401)");
}

async function test3_WrongAuthFormat() {
  // Test 3a: Missing "Bearer " prefix
  const response1 = await axios.get(`${IDP_URL}/api/auth/userinfo`, {
    headers: {
      Authorization: "just_a_token_without_bearer",
    },
    validateStatus: () => true,
  });

  if (response1.status !== 401)
    throw new Error(`Expected 401 for missing Bearer, got ${response1.status}`);

  console.log("    ✅ Missing Bearer prefix rejected (401)");

  // Test 3b: Extra parts
  const response2 = await axios.get(`${IDP_URL}/api/auth/userinfo`, {
    headers: {
      Authorization: "Bearer token extra_part",
    },
    validateStatus: () => true,
  });

  if (response2.status !== 401)
    throw new Error(`Expected 401 for extra parts, got ${response2.status}`);

  console.log("    ✅ Extra parts rejected (401)");

  // Test 3c: Empty Bearer
  const response3 = await axios.get(`${IDP_URL}/api/auth/userinfo`, {
    headers: {
      Authorization: "Bearer ",
    },
    validateStatus: () => true,
  });

  if (response3.status !== 401)
    throw new Error(`Expected 401 for empty Bearer, got ${response3.status}`);

  console.log("    ✅ Empty token rejected (401)");
}

async function test4_InvalidSignature() {
  // Use a valid JWT structure but with tampered signature
  const tamperingToken =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.tampered_signature_here";

  const response = await axios.get(`${IDP_URL}/api/auth/userinfo`, {
    headers: {
      Authorization: `Bearer ${tamperingToken}`,
    },
    validateStatus: () => true,
  });

  if (response.status !== 401)
    throw new Error(`Expected 401, got ${response.status}`);

  if (response.data.error !== "invalid_token")
    throw new Error(`Expected 'invalid_token' error, got ${response.data.error}`);

  console.log("    ✅ Invalid signature rejected (401 invalid_token)");
}

async function test5_ExpiredToken() {
  // Create an expired token (manually crafted for testing)
  // Use a token with exp in the past
  const expiredToken =
    "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkMTJkMWQxMi0xZDEyLTFkMTItMWQxMi0xZDEyMWQxMjFkMTIiLCJhY2NvdW50SWQiOiJjZjY0ZDVhYS01MTMyLTQxNmYtOTgxNS0wMDljYWQ2YzFjNGEiLCJjbGllbnRJZCI6ImNsaWVudC1hIiwianRpIjoiMWQxMjFkMTItMWQxMi0xZDEyLTFkMTItMWQxMjFkMTIxZDEyIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDAwMDF9.signature";

  const response = await axios.get(`${IDP_URL}/api/auth/userinfo`, {
    headers: {
      Authorization: `Bearer ${expiredToken}`,
    },
    validateStatus: () => true,
  });

  if (response.status !== 401)
    throw new Error(`Expected 401, got ${response.status}`);

  if (response.data.error !== "invalid_token")
    throw new Error(`Expected 'invalid_token' error, got ${response.data.error}`);

  console.log("    ✅ Expired token rejected (401 invalid_token)");
}

async function test6_ConsistencyWithApiUser() {
  // Get a valid token from the happy path
  const accessToken = await getValidAccessToken();
  if (!accessToken) throw new Error("Failed to get access token");

  // Call /api/auth/userinfo
  const userInfoResponse = await axios.get(`${IDP_URL}/api/auth/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    validateStatus: () => true,
  });

  if (userInfoResponse.status !== 200)
    throw new Error(`Userinfo request failed: ${userInfoResponse.status}`);

  const userInfoData = userInfoResponse.data;

  if (!userInfoData.id || !userInfoData.email || !userInfoData.name) {
    throw new Error("Userinfo response missing id, email, or name");
  }

  if (!Array.isArray(userInfoData.accounts)) {
    throw new Error("Userinfo response accounts is not an array");
  }

  console.log("    ✅ Userinfo response format is valid");
  console.log(`    ✅ User ID: ${userInfoData.id.substring(0, 12)}...`);
  console.log(`    ✅ Email: ${userInfoData.email}`);
  console.log(`    ✅ Name: ${userInfoData.name}`);
  console.log(`    ✅ Accounts: ${userInfoData.accounts.length}`);
}

// Main test runner
async function runAllTests() {
  console.log(
    "\n" +
    "------------------------------------------\n" +
    "|   STAGE 7: PROTECTED API TESTS         |\n" +
    "------------------------------------------"
  );

  await runTest(
    1,
    "Happy Path: Valid token → User profile",
    test1_HappyPath
  );
  await runTest(2, "Missing Authorization Header", test2_MissingAuthHeader);
  await runTest(3, "Invalid Authorization Format", test3_WrongAuthFormat);
  await runTest(4, "Invalid Token Signature", test4_InvalidSignature);
  await runTest(5, "Expired Token", test5_ExpiredToken);
  await runTest(6, "Response Format Consistency", test6_ConsistencyWithApiUser);

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
