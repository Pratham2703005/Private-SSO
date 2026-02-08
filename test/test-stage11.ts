import axios from "axios";
import crypto from "crypto";
import { TEST_USER } from "./fixtures/test-users";

const IDP_SERVER = "http://localhost:3000";
const TEST_USER_2_EMAIL = "test2@example.com"; // Will use same password: "01234567890Pk"
const TEST_USER_PASSWORD = "01234Pk";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

/**
 * Helper: Extract cookie from Set-Cookie header by name
 */
function extractCookie(setCookieHeader: string | string[] | undefined, cookieName: string = "__sso_session"): string {
  if (!setCookieHeader) return "";
  
  const headers = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  const targetCookie = headers.find(h => h.includes(`${cookieName}=`));
  if (!targetCookie) return "";
  
  return targetCookie.split(";")[0];
}

/**
 * Helper: Create or get a second test user with a different account
 */
async function ensureTestUser2() {
  try {
    // Try to get existing user first
    const response = await axios.post(
      `${IDP_SERVER}/api/auth/login`,
      {
        email: TEST_USER_2_EMAIL,
        password: TEST_USER_PASSWORD,
      },
      { validateStatus: () => true }
    );
    return response.status === 200;
  } catch {
    // User doesn't exist, that's OK for this test
    return false;
  }
}

/**
 * Helper: Parse JWT payload (without verification, just for inspection)
 */
function parseJwt(token: string): any {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const decoded = Buffer.from(parts[1], "base64").toString("utf-8");
  return JSON.parse(decoded);
}

// ============================================================================
// Test 11.1: Login Account A, Login Account B → Both Logged In
// ============================================================================
async function testMultipleAccountLogin() {
  const testName = "Stage 11.1: Multiple Account Login";
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🧪 ${testName}`);
  console.log('='.repeat(70));

  try {
    let idpCookie = "";

    // Step 1: Login with Account A (TEST_USER)
    console.log("\n1️⃣  Logging in with Account A...");
    const loginA = await axios.post(
      `${IDP_SERVER}/api/auth/login`,
      {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
      { validateStatus: () => true }
    );

    if (loginA.status !== 200) {
      throw new Error(`Login A failed: ${loginA.status} - ${JSON.stringify(loginA.data)}`);
    }

    idpCookie = extractCookie(loginA.headers["set-cookie"]);
    const accountA = loginA.data.data.user.email;
    console.log(`   ✓ Account A logged in: ${accountA}`);

    // Step 2: Login with Account B (TEST_USER_2) - should reuse same IDP session
    console.log("\n2️⃣  Logging in with Account B (same IDP session)...");
    const loginB = await axios.post(
      `${IDP_SERVER}/api/auth/login`,
      {
        email: TEST_USER_2_EMAIL,
        password: TEST_USER_PASSWORD,
      },
      {
        headers: idpCookie ? { Cookie: idpCookie } : {},
        validateStatus: () => true,
      }
    );

    if (loginB.status !== 200) {
      throw new Error(`Login B failed: ${loginB.status} - ${JSON.stringify(loginB.data)}`);
    }

    // Cookie should be same (session reused)
    const idpCookieB = extractCookie(loginB.headers["set-cookie"]) || idpCookie;
    const accountB = loginB.data.data.user.email;
    console.log(`   ✓ Account B logged in: ${accountB}`);

    if (idpCookie !== idpCookieB && idpCookieB !== "") {
      throw new Error("IDP session should be reused for second login");
    }

    results.push({ name: testName, passed: true });
    console.log(`\n✅ ${testName} PASSED`);
  } catch (error: any) {
    results.push({ name: testName, passed: false, error: error.message });
    console.error(`\n❌ ${testName} FAILED:`, error.message);
  }
}

// ============================================================================
// Test 11.2: GET /api/auth/accounts → List Both Accounts
// ============================================================================
async function testAccountsList() {
  const testName = "Stage 11.2: Get Accounts List";
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🧪 ${testName}`);
  console.log('='.repeat(70));

  try {
    let idpCookie = "";

    // Step 1: Login Account A
    console.log("\n1️⃣  Setup: Login Account A...");
    const loginA = await axios.post(
      `${IDP_SERVER}/api/auth/login`,
      {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
      { validateStatus: () => true }
    );

    idpCookie = extractCookie(loginA.headers["set-cookie"]);

    // Step 2: Login Account B (reuse session)
    console.log("1️⃣  Setup: Login Account B...");
    await axios.post(
      `${IDP_SERVER}/api/auth/login`,
      {
        email: TEST_USER_2_EMAIL,
        password: TEST_USER_PASSWORD,
      },
      {
        headers: idpCookie ? { Cookie: idpCookie } : {},
        validateStatus: () => true,
      }
    );

    // Step 3: Get accounts list
    console.log("\n2️⃣  Getting accounts list...");
    const accountsRes = await axios.get(
      `${IDP_SERVER}/api/auth/accounts`,
      {
        headers: idpCookie ? { Cookie: idpCookie } : {},
        validateStatus: () => true,
      }
    );

    if (accountsRes.status !== 200) {
      throw new Error(`Get accounts failed: ${accountsRes.status}`);
    }

    const { accounts, activeAccountId } = accountsRes.data;

    if (!accounts || accounts.length < 2) {
      throw new Error(`Expected 2 accounts, got ${accounts?.length || 0}`);
    }

    console.log(`   ✓ Found ${accounts.length} accounts`);
    console.log(`   ✓ Active account: ${activeAccountId}`);
    console.log(`   ✓ Accounts: ${accounts.map((a: any) => a.email).join(", ")}`);

    results.push({ name: testName, passed: true });
    console.log(`\n✅ ${testName} PASSED`);
  } catch (error: any) {
    results.push({ name: testName, passed: false, error: error.message });
    console.error(`\n❌ ${testName} FAILED:`, error.message);
  }
}

// ============================================================================
// Test 11.3: Switch Account → New Access Token, No Refresh Token
// ============================================================================
async function testSwitchAccount() {
  const testName = "Stage 11.3: Switch Account";
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🧪 ${testName}`);
  console.log('='.repeat(70));

  try {
    let idpCookie = "";
    let accountAId = "";
    let accountBId = "";
    let accessTokenA = "";

    // Step 1: Login Account A
    console.log("\n1️⃣  Setup: Login Account A...");
    const loginA = await axios.post(
      `${IDP_SERVER}/api/auth/login`,
      {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
      { validateStatus: () => true }
    );

    idpCookie = extractCookie(loginA.headers["set-cookie"]);
    accountAId = loginA.data.data.accountId;
    accessTokenA = loginA.data.data.accessToken;
    const jwtA = parseJwt(accessTokenA);
    console.log(`   ✓ Account A: ${jwtA.email}, accountId: ${jwtA.accountId.substring(0, 8)}...`);

    // Step 2: Login Account B
    console.log("\n1️⃣  Setup: Login Account B...");
    const loginB = await axios.post(
      `${IDP_SERVER}/api/auth/login`,
      {
        email: TEST_USER_2_EMAIL,
        password: TEST_USER_PASSWORD,
      },
      {
        headers: idpCookie ? { Cookie: idpCookie } : {},
        validateStatus: () => true,
      }
    );

    accountBId = loginB.data.data.accountId;
    console.log(`   ✓ Account B logged in, accountId: ${accountBId.substring(0, 8)}...`);

    // Step 3: Switch to Account A
    console.log("\n2️⃣  Switching to Account A...");
    const switchRes = await axios.post(
      `${IDP_SERVER}/api/auth/switch-account`,
      { accountId: accountAId },
      {
        headers: idpCookie ? { Cookie: idpCookie } : {},
        validateStatus: () => true,
      }
    );

    if (switchRes.status !== 200) {
      throw new Error(`Switch failed: ${switchRes.status}`);
    }

    const { accessToken: newAccessToken, idToken, refreshToken } = switchRes.data;

    if (!newAccessToken || !idToken) {
      throw new Error("Missing accessToken or idToken in switch response");
    }

    if (refreshToken) {
      throw new Error("refreshToken should NOT be returned on account switch");
    }

    // Verify new access token has correct accountId
    const newJwt = parseJwt(newAccessToken);
    if (newJwt.accountId !== accountAId) {
      throw new Error("New token has wrong accountId");
    }

    console.log(`   ✓ Switched to Account A`);
    console.log(`   ✓ New access_token issued`);
    console.log(`   ✓ No refresh_token returned (correct)`);
    console.log(`   ✓ Token has correct accountId`);

    results.push({ name: testName, passed: true });
    console.log(`\n✅ ${testName} PASSED`);
  } catch (error: any) {
    results.push({ name: testName, passed: false, error: error.message });
    console.error(`\n❌ ${testName} FAILED:`, error.message);
  }
}

// ============================================================================
// Test 11.4: Account Logout → Revoke Only That Account's Tokens
// ============================================================================
async function testAccountLogout() {
  const testName = "Stage 11.4: Per-Account Logout";
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🧪 ${testName}`);
  console.log('='.repeat(70));

  try {
    let idpCookie = "";
    let refTokenA = "";
    let refTokenB = "";
    let accountAId = "";
    let accountBId = "";

    // Step 1: Login Account A
    console.log("\n1️⃣  Setup: Login Account A...");
    const loginA = await axios.post(
      `${IDP_SERVER}/api/auth/login`,
      {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
      {
        validateStatus: () => true,
        withCredentials: true,
      }
    );

    idpCookie = extractCookie(loginA.headers["set-cookie"]);
    accountAId = loginA.data.data.accountId;
    refTokenA = loginA.data.data.refreshToken || 
      loginA.headers["set-cookie"]?.find((h: string) => h.includes("sso_refresh_token"))?.split("sso_refresh_token=")[1]?.split(";")[0];
    
    console.log(`   ✓ Account A logged in`);

    // Step 2: Login Account B
    console.log("\n1️⃣  Setup: Login Account B...");
    const loginB = await axios.post(
      `${IDP_SERVER}/api/auth/login`,
      {
        email: TEST_USER_2_EMAIL,
        password: TEST_USER_PASSWORD,
      },
      {
        headers: idpCookie ? { Cookie: idpCookie } : {},
        validateStatus: () => true,
        withCredentials: true,
      }
    );

    accountBId = loginB.data.data.accountId;
    refTokenB = loginB.data.data.refreshToken ||
      loginB.headers["set-cookie"]?.find((h: string) => h.includes("sso_refresh_token"))?.split("sso_refresh_token=")[1]?.split(";")[0];
    
    console.log(`   ✓ Account B logged in`);

    // Step 3: Logout Account A
    console.log("\n2️⃣  Logging out Account A...");
    const logoutRes = await axios.post(
      `${IDP_SERVER}/api/auth/account-logout`,
      { accountId: accountAId },
      {
        headers: idpCookie ? { Cookie: idpCookie } : {},
        validateStatus: () => true,
      }
    );

    if (logoutRes.status !== 200) {
      throw new Error(`Logout failed: ${logoutRes.status}`);
    }

    console.log(`   ✓ Account A logged out`);

    // Step 4: Verify Account A's refresh token is revoked
    console.log("\n3️⃣  Verifying Account A's refresh token is revoked...");
    const refreshARes = await axios.post(
      `${IDP_SERVER}/api/auth/token`,
      {
        grant_type: "refresh_token",
        client_id: "idp",
        refresh_token: refTokenA,
      },
      { validateStatus: () => true }
    );

    if (refreshARes.status === 200) {
      throw new Error("Account A refresh should have failed after logout");
    }

    if (refreshARes.data.error !== "invalid_grant") {
      throw new Error(`Expected invalid_grant error, got ${refreshARes.data.error}`);
    }

    console.log(`   ✓ Account A refresh returns invalid_grant`);

    // Step 5: Verify Account B's refresh token still works
    console.log("\n4️⃣  Verifying Account B's refresh token still works...");
    const refreshBRes = await axios.post(
      `${IDP_SERVER}/api/auth/token`,
      {
        grant_type: "refresh_token",
        client_id: "idp",
        refresh_token: refTokenB,
      },
      { validateStatus: () => true }
    );

    if (refreshBRes.status !== 200) {
      throw new Error(`Account B refresh failed: ${refreshBRes.status} - ${JSON.stringify(refreshBRes.data)}`);
    }

    console.log(`   ✓ Account B refresh token still valid`);

    // Step 6: Verify Account B is now active
    console.log("\n5️⃣  Verifying Account B is now active...");
    const accountsRes = await axios.get(
      `${IDP_SERVER}/api/auth/accounts`,
      {
        headers: idpCookie ? { Cookie: idpCookie } : {},
        validateStatus: () => true,
      }
    );

    const { activeAccountId, accounts } = accountsRes.data;
    if (activeAccountId !== accountBId) {
      throw new Error(`Expected Account B to be active, but ${activeAccountId} is active`);
    }

    if (accounts.length !== 1) {
      throw new Error(`Expected 1 account remaining, got ${accounts.length}`);
    }

    console.log(`   ✓ Account B is now active`);
    console.log(`   ✓ Only Account B remains in session`);

    results.push({ name: testName, passed: true });
    console.log(`\n✅ ${testName} PASSED`);
  } catch (error: any) {
    results.push({ name: testName, passed: false, error: error.message });
    console.error(`\n❌ ${testName} FAILED:`, error.message);
  }
}

// ============================================================================
// Main Test Runner
// ============================================================================
async function runTests() {
  console.log("\n" + "█".repeat(70));
  console.log("█" + " ".repeat(68) + "█");
  console.log("█" + "  Stage 11: Account Switching (Multiple Simultaneous Logins)".padEnd(68) + "█");
  console.log("█" + " ".repeat(68) + "█");
  console.log("█".repeat(70));

  // Setup: Ensure test user 2 exists
  console.log("\n⚙️  Checking test accounts...");
  await ensureTestUser2();
  console.log("✓ Test accounts ready");

  // Run all tests
  await testMultipleAccountLogin();
  await testAccountsList();
  await testSwitchAccount();
  await testAccountLogout();

  // Print summary
  console.log("\n" + "═".repeat(70));
  console.log("█ TEST RESULTS SUMMARY".padEnd(70) + "█");
  console.log("═".repeat(70));

  results.forEach((result) => {
    const status = result.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} | ${result.name}`);
    if (result.error) {
      console.log(`      Error: ${result.error}`);
    }
  });

  console.log(
    "\n──────────────────────────────────────────────────────────────────────"
  );

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const passedEmoji = passed === total ? "✅✅✅✅" : "⚠️";

  console.log(`📊 Total: ${total} tests, ${passed} passed, ${total - passed} failed ${passedEmoji}`);
  console.log(
    "──────────────────────────────────────────────────────────────────────\n"
  );

  process.exit(passed === total ? 0 : 1);
}

// Run tests
runTests().catch((error) => {
  console.error("Test runner error:", error);
  process.exit(1);
});
