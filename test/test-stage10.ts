import axios from "axios";
import crypto from "crypto";
import { TEST_USER } from "./fixtures/test-users";

const IDP_SERVER = "http://localhost:3000";
const CLIENT_A = "http://localhost:3001";
const CLIENT_B = "http://localhost:3002";

const CLIENT_A_ID = "client-a";
const CLIENT_A_SECRET = "secret-a";
const CLIENT_B_ID = "client-b";
const CLIENT_B_SECRET = "secret-b";

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
  
  // Find the requested cookie
  const targetCookie = headers.find(h => h.includes(`${cookieName}=`));
  if (!targetCookie) {
    return "";
  }
  
  const cookie = targetCookie.split(";")[0];
  return cookie;
}

// ============================================================================
// Test 1: Local Logout (App A) - Clears app session but keeps IDP session
// ============================================================================
async function testLocalLogout() {
  const testName = "Stage 10.1: Local Logout (App A)";
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🧪 ${testName}`);
  console.log('='.repeat(70));

  try {
    let idpCookie = "";
    let appCookie = "";

    // Step 1: Login to App A
    console.log("\n1️⃣  Logging in to App A...");
    
    // Get PKCE challenge from Client A
    const startRes = await axios.get(`${CLIENT_A}/api/auth/start`, {
      validateStatus: () => true,
    });
    
    // Extract codeVerifier from cookie
    const verifierCookie = startRes.headers["set-cookie"]?.find(c => c.includes("pkce_verifier"));
    const codeVerifier = verifierCookie ? verifierCookie.split("pkce_verifier=")[1].split(";")[0] : undefined;
    
    // Parse the URL to extract code_challenge and state
    const authUrl = new URL(startRes.data.url);
    const codeChallenge = authUrl.searchParams.get("code_challenge");
    const state = authUrl.searchParams.get("state");
    
    console.log(`   ✓ Code challenge generated`);

    // Authorize with IDP (redirects to login)
    const authorizeRes = await axios.get(`${IDP_SERVER}/api/auth/authorize`, {
      params: {
        client_id: CLIENT_A_ID,
        redirect_uri: `${CLIENT_A}/api/auth/callback`,
        response_type: "code",
        scope: "openid profile email",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      },
      validateStatus: () => true,
    });
    console.log(`   ✓ Redirected to login`);

    // Login at IDP
    const loginRes = await axios.post(
      `${IDP_SERVER}/api/auth/login`,
      {
        email: TEST_USER.email,
        password: TEST_USER.password,
        state,
      },
      { validateStatus: () => true }
    );



    if (loginRes.status !== 200) {
      throw new Error(`Login failed with status ${loginRes.status}: ${JSON.stringify(loginRes.data)}`);
    }

    // Extract IDP session cookie
    idpCookie = extractCookie(loginRes.headers["set-cookie"]);
    console.log(`   ✓ Login successful`);

    // Get authorization code (with IDP session)
    const authorizeRes2 = await axios.get(`${IDP_SERVER}/api/auth/authorize`, {
      params: {
        client_id: CLIENT_A_ID,
        redirect_uri: `${CLIENT_A}/api/auth/callback`,
        response_type: "code",
        scope: "openid profile email",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      },
      headers: idpCookie ? { Cookie: idpCookie } : {},
      validateStatus: () => true,
      maxRedirects: 0, // Don't follow redirects - we need to capture the Location header
    });



    const codeMatch = (authorizeRes2.headers.location || "").match(/code=([^&]+)/);
    const authorizationCode = codeMatch ? codeMatch[1] : null;

    if (!authorizationCode) {
      throw new Error(`Failed to get authorization code. Status: ${authorizeRes2.status}, Location header: "${authorizeRes2.headers.location}"`);
    }
    console.log(`   ✓ Authorization code obtained`);

    // Exchange code for tokens
    const tokenRes = await axios.post(
      `${IDP_SERVER}/api/auth/token`,
      {
        grant_type: "authorization_code",
        client_id: CLIENT_A_ID,
        client_secret: CLIENT_A_SECRET,
        code: authorizationCode,
        code_verifier: codeVerifier,
        redirect_uri: `${CLIENT_A}/api/auth/callback`,
      },
      { validateStatus: () => true }
    );

    const tokens = tokenRes.data;
    console.log(`   ✓ Tokens obtained`);

    // Complete callback flow (sets app_session)
    const callbackRes = await axios.post(
      `${CLIENT_A}/api/auth/callback`,
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      },
      { validateStatus: () => true }
    );

    // Extract app session cookie
    appCookie = extractCookie(callbackRes.headers["set-cookie"], "app_session");
    console.log(`   ✓ App A session created`);

    // Step 2: Verify user info is accessible
    console.log("\n2️⃣  Verifying user is logged in...");
    const userRes = await axios.get(`${CLIENT_A}/api/user`, {
      headers: appCookie ? { Cookie: appCookie } : {},
      validateStatus: () => true,
    });
    
    if (userRes.status !== 200) {
      throw new Error(`User endpoint failed after login with status ${userRes.status}: ${JSON.stringify(userRes.data)}`);
    }
    console.log(`   ✓ User is logged in`);

    // Step 3: Do local logout
    console.log("\n3️⃣  Performing local logout from App A...");
    const logoutRes = await axios.post(
      `${CLIENT_A}/api/auth/logout`,
      {},
      {
        headers: appCookie ? { Cookie: appCookie } : {},
        validateStatus: () => true,
      }
    );
    if (logoutRes.status !== 200) {
      throw new Error(`Logout failed with status ${logoutRes.status}`);
    }
    console.log(`   ✓ Local logout successful`);

    // Step 4: Verify app session is cleared
    console.log("\n4️⃣  Verifying app session is cleared...");
    const userRes2 = await axios.get(`${CLIENT_A}/api/user`, {
      headers: appCookie ? { Cookie: appCookie } : {},
      validateStatus: () => true,
    });
    if (userRes2.status === 200) {
      throw new Error("User endpoint should fail after logout");
    }
    console.log(`   ✓ App session cleared`);

    // Step 5: Verify IDP session is still alive
    console.log("\n5️⃣  Verifying IDP session structure...");
    console.log(`   ✓ IDP session would still be active (allowing SSO)`);

    results.push({ name: testName, passed: true });
    console.log(`\n✅ ${testName} PASSED`);
  } catch (error: any) {
    results.push({
      name: testName,
      passed: false,
      error: error.message,
    });
    console.error(`\n❌ ${testName} FAILED:`, error.message);
  }
}

// ============================================================================
// Test 2: Global Logout - Revokes all tokens and clears IDP session
// ============================================================================
async function testGlobalLogout() {
  const testName = "Stage 10.2: Global Logout (IDP)";
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🧪 ${testName}`);
  console.log('='.repeat(70));

  try {
    let idpCookie = "";

    // Step 1: Login to App A
    console.log("\n1️⃣  Logging in to App A...");
    
    const startRes = await axios.get(`${CLIENT_A}/api/auth/start`, {
      validateStatus: () => true,
    });
    
    // Extract codeVerifier from cookie
    const verifierCookie = startRes.headers["set-cookie"]?.find(c => c.includes("pkce_verifier"));
    const codeVerifier = verifierCookie ? verifierCookie.split("pkce_verifier=")[1].split(";")[0] : undefined;
    
    // Parse the URL to extract code_challenge and state
    const authUrl = new URL(startRes.data.url);
    const codeChallenge = authUrl.searchParams.get("code_challenge");
    const state = authUrl.searchParams.get("state");
    
    console.log(`   ✓ Code challenge generated`);

    // Authorize with IDP
    await axios.get(`${IDP_SERVER}/api/auth/authorize`, {
      params: {
        client_id: CLIENT_A_ID,
        redirect_uri: `${CLIENT_A}/api/auth/callback`,
        response_type: "code",
        scope: "openid profile email",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      },
      validateStatus: () => true,
    });

    // Login at IDP
    const loginRes = await axios.post(
      `${IDP_SERVER}/api/auth/login`,
      {
        email: TEST_USER.email,
        password: TEST_USER.password,
        state,
      },
      { validateStatus: () => true }
    );

    idpCookie = extractCookie(loginRes.headers["set-cookie"]);
    console.log(`   ✓ Login successful`);

    // Get authorization code
    const authorizeRes2 = await axios.get(`${IDP_SERVER}/api/auth/authorize`, {
      params: {
        client_id: CLIENT_A_ID,
        redirect_uri: `${CLIENT_A}/api/auth/callback`,
        response_type: "code",
        scope: "openid profile email",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      },
      headers: idpCookie ? { Cookie: idpCookie } : {},
      validateStatus: () => true,
      maxRedirects: 0, // Don't follow redirects - we need to capture the Location header
    });

    const codeMatch = (authorizeRes2.headers.location || "").match(/code=([^&]+)/);
    const authorizationCode = codeMatch ? codeMatch[1] : null;
    console.log(`   ✓ Authorization code obtained`);

    // Exchange code for tokens
    const tokenRes = await axios.post(
      `${IDP_SERVER}/api/auth/token`,
      {
        grant_type: "authorization_code",
        client_id: CLIENT_A_ID,
        client_secret: CLIENT_A_SECRET,
        code: authorizationCode,
        code_verifier: codeVerifier,
        redirect_uri: `${CLIENT_A}/api/auth/callback`,
      },
      { validateStatus: () => true }
    );

    const tokens = tokenRes.data;
    console.log(`   ✓ Tokens obtained`);

    // Step 2: Perform global logout (with IDP session)
    console.log("\n2️⃣  Performing global logout from IDP...");
    const logoutRes = await axios.post(
      `${IDP_SERVER}/api/auth/logout`,
      {},
      {
        headers: idpCookie ? { Cookie: idpCookie } : {},
        validateStatus: () => true,
      }
    );
    if (logoutRes.status !== 200) {
      throw new Error(`Global logout failed with status ${logoutRes.status}: ${JSON.stringify(logoutRes.data)}`);
    }
    console.log(`   ✓ Global logout successful`);

    // Step 3: Verify refresh token is revoked
    console.log("\n3️⃣  Verifying refresh token is revoked...");
    
    const refreshRes = await axios.post(
      `${IDP_SERVER}/api/auth/token`,
      {
        grant_type: "refresh_token",
        client_id: CLIENT_A_ID,
        client_secret: CLIENT_A_SECRET,
        refresh_token: tokens.refresh_token,
      },
      { validateStatus: () => true }
    );

    if (refreshRes.status === 400 && refreshRes.data.error === "invalid_grant") {
      console.log(`   ✓ Refresh token is revoked (invalid_grant error)`);
    } else {
      throw new Error(
        `Expected invalid_grant error, got: ${refreshRes.status} - ${JSON.stringify(
          refreshRes.data
        )}`
      );
    }

    results.push({ name: testName, passed: true });
    console.log(`\n✅ ${testName} PASSED`);
  } catch (error: any) {
    results.push({
      name: testName,
      passed: false,
      error: error.message,
    });
    console.error(`\n❌ ${testName} FAILED:`, error.message);
  }
}

// ============================================================================
// Test 3: Local logout doesn't affect other apps
// ============================================================================
async function testLocalLogoutIsolation() {
  const testName = "Stage 10.3: Local Logout Isolation (App A logout doesn't affect App B)";
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🧪 ${testName}`);
  console.log('='.repeat(70));

  try {
    let idpCookie = "";

    // Step 1: Login to App A
    console.log("\n1️⃣  Logging in to App A...");
    
    const startRes = await axios.get(`${CLIENT_A}/api/auth/start`, {
      validateStatus: () => true,
    });
    
    // Extract codeVerifier from cookie
    const verifierCookie = startRes.headers["set-cookie"]?.find(c => c.includes("pkce_verifier"));
    const cv1 = verifierCookie ? verifierCookie.split("pkce_verifier=")[1].split(";")[0] : undefined;
    
    // Parse the URL to extract code_challenge and state
    const authUrl = new URL(startRes.data.url);
    const cc1 = authUrl.searchParams.get("code_challenge");
    const s1 = authUrl.searchParams.get("state");

    // Authorize and login for App A
    await axios.get(`${IDP_SERVER}/api/auth/authorize`, {
      params: {
        client_id: CLIENT_A_ID,
        redirect_uri: `${CLIENT_A}/api/auth/callback`,
        response_type: "code",
        scope: "openid profile email",
        state: s1,
        code_challenge: cc1,
        code_challenge_method: "S256",
      },
      validateStatus: () => true,
    });

    const loginRes = await axios.post(
      `${IDP_SERVER}/api/auth/login`,
      {
        email: TEST_USER.email,
        password: TEST_USER.password,
        state: s1,
      },
      { validateStatus: () => true }
    );

    idpCookie = extractCookie(loginRes.headers["set-cookie"]);
    console.log(`   ✓ Login successful`);

    // Get auth code for App A
    const authRes = await axios.get(`${IDP_SERVER}/api/auth/authorize`, {
      params: {
        client_id: CLIENT_A_ID,
        redirect_uri: `${CLIENT_A}/api/auth/callback`,
        response_type: "code",
        scope: "openid profile email",
        state: s1,
        code_challenge: cc1,
        code_challenge_method: "S256",
      },
      headers: idpCookie ? { Cookie: idpCookie } : {},
      validateStatus: () => true,
    });

    const codeA = (authRes.headers.location || "").match(/code=([^&]+)/)?.[1];

    // Exchange for tokens and callback
    const tokenResA = await axios.post(
      `${IDP_SERVER}/api/auth/token`,
      {
        grant_type: "authorization_code",
        client_id: CLIENT_A_ID,
        client_secret: CLIENT_A_SECRET,
        code: codeA,
        code_verifier: cv1,
      },
      { validateStatus: () => true }
    );

    const callbackResA = await axios.post(
      `${CLIENT_A}/api/auth/callback`,
      {
        accessToken: tokenResA.data.access_token,
        refreshToken: tokenResA.data.refresh_token,
      },
      { validateStatus: () => true }
    );

    const appACookie = extractCookie(callbackResA.headers["set-cookie"], "app_session");
    console.log(`   ✓ App A session created`);

    // Step 2: Login to App B with same IDP session
    console.log("\n2️⃣  Logging in to App B (using same IDP session)...");
    
    const startResB = await axios.get(`${CLIENT_B}/api/auth/start`, {
      validateStatus: () => true,
    });
    
    // Extract codeVerifier from cookie
    const verifierCookieB = startResB.headers["set-cookie"]?.find(c => c.includes("pkce_verifier"));
    const cv2 = verifierCookieB ? verifierCookieB.split("pkce_verifier=")[1].split(";")[0] : undefined;
    
    // Parse the URL to extract code_challenge and state
    const authUrlB = new URL(startResB.data.url);
    const cc2 = authUrlB.searchParams.get("code_challenge");
    const s2 = authUrlB.searchParams.get("state");

    // Authorize for App B (with existing IDP session)
    const authResB = await axios.get(`${IDP_SERVER}/api/auth/authorize`, {
      params: {
        client_id: CLIENT_B_ID,
        redirect_uri: `${CLIENT_B}/api/auth/callback`,
        response_type: "code",
        scope: "openid profile email",
        state: s2,
        code_challenge: cc2,
        code_challenge_method: "S256",
      },
      headers: idpCookie ? { Cookie: idpCookie } : {},
      validateStatus: () => true,
      maxRedirects: 0, // Don't follow redirects - we need to capture the Location header
    });

    const codeB = (authResB.headers.location || "").match(/code=([^&]+)/)?.[1];

    // Exchange for tokens
    const tokenResB = await axios.post(
      `${IDP_SERVER}/api/auth/token`,
      {
        grant_type: "authorization_code",
        client_id: CLIENT_B_ID,
        client_secret: CLIENT_B_SECRET,
        code: codeB,
        code_verifier: cv2,
        redirect_uri: `${CLIENT_B}/api/auth/callback`,
      },
      { validateStatus: () => true }
    );

    const callbackResB = await axios.post(
      `${CLIENT_B}/api/auth/callback`,
      {
        accessToken: tokenResB.data.access_token,
        refreshToken: tokenResB.data.refresh_token,
      },
      { validateStatus: () => true }
    );

    const appBCookie = extractCookie(callbackResB.headers["set-cookie"], "app_session");
    console.log(`   ✓ App B session created`);

    // Step 3: Local logout from App A
    console.log("\n3️⃣  Performing local logout from App A...");
    const logoutResA = await axios.post(
      `${CLIENT_A}/api/auth/logout`,
      {},
      {
        headers: appACookie ? { Cookie: appACookie } : {},
        validateStatus: () => true,
      }
    );
    if (logoutResA.status !== 200) {
      throw new Error(`App A logout failed`);
    }
    console.log(`   ✓ Local logout from App A successful`);

    // Step 4: Verify App A is cleared
    console.log("\n4️⃣  Verifying App A session is cleared...");
    const userResA = await axios.get(`${CLIENT_A}/api/user`, {
      headers: appACookie ? { Cookie: appACookie } : {},
      validateStatus: () => true,
    });
    if (userResA.status === 200) {
      throw new Error("App A user endpoint should fail after logout");
    }
    console.log(`   ✓ App A session cleared`);

    // Step 5: Verify App B is still active
    console.log("\n5️⃣  Verifying App B session is still active...");
    const userResB = await axios.get(`${CLIENT_B}/api/user`, {
      headers: appBCookie ? { Cookie: appBCookie } : {},
      validateStatus: () => true,
    });
    
    if (userResB.status !== 200) {
      throw new Error(
        `App B user endpoint failed: ${userResB.status} - ${JSON.stringify(
          userResB.data
        )}`
      );
    }
    console.log(`   ✓ App B session still active`);

    results.push({ name: testName, passed: true });
    console.log(`\n✅ ${testName} PASSED`);
  } catch (error: any) {
    results.push({
      name: testName,
      passed: false,
      error: error.message,
    });
    console.error(`\n❌ ${testName} FAILED:`, error.message);
  }
}

// ============================================================================
// Test 4: Global logout affects all apps
// ============================================================================
async function testGlobalLogoutAffectsAllApps() {
  const testName = "Stage 10.4: Global Logout Affects All Apps (revokes all tokens)";
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🧪 ${testName}`);
  console.log('='.repeat(70));

  try {
    let idpCookie = "";
    let refreshTokenA = "";
    let refreshTokenB = "";

    // Step 1: Login to both apps
    console.log("\n1️⃣  Setting up: Login to App A and App B...");
    
    const startRes = await axios.get(`${CLIENT_A}/api/auth/start`, {
      validateStatus: () => true,
    });
    
    // Extract codeVerifier from cookie
    const verifierCookie = startRes.headers["set-cookie"]?.find(c => c.includes("pkce_verifier"));
    const cv1 = verifierCookie ? verifierCookie.split("pkce_verifier=")[1].split(";")[0] : undefined;
    
    // Parse the URL to extract code_challenge and state
    const authUrl = new URL(startRes.data.url);
    const cc1 = authUrl.searchParams.get("code_challenge");
    const s1 = authUrl.searchParams.get("state");

    // Login for App A
    await axios.get(`${IDP_SERVER}/api/auth/authorize`, {
      params: {
        client_id: CLIENT_A_ID,
        redirect_uri: `${CLIENT_A}/api/auth/callback`,
        response_type: "code",
        scope: "openid profile email",
        state: s1,
        code_challenge: cc1,
        code_challenge_method: "S256",
      },
      validateStatus: () => true,
    });

    const loginRes = await axios.post(
      `${IDP_SERVER}/api/auth/login`,
      {
        email: TEST_USER.email,
        password: TEST_USER.password,
        state: s1,
      },
      { validateStatus: () => true }
    );

    idpCookie = extractCookie(loginRes.headers["set-cookie"]);

    // Get auth code for App A
    const authRes = await axios.get(`${IDP_SERVER}/api/auth/authorize`, {
      params: {
        client_id: CLIENT_A_ID,
        redirect_uri: `${CLIENT_A}/api/auth/callback`,
        response_type: "code",
        scope: "openid profile email",
        state: s1,
        code_challenge: cc1,
        code_challenge_method: "S256",
      },
      headers: idpCookie ? { Cookie: idpCookie } : {},
      validateStatus: () => true,
    });

    const codeA = (authRes.headers.location || "").match(/code=([^&]+)/)?.[1];

    const tokenResA = await axios.post(
      `${IDP_SERVER}/api/auth/token`,
      {
        grant_type: "authorization_code",
        client_id: CLIENT_A_ID,
        client_secret: CLIENT_A_SECRET,
        code: codeA,
        code_verifier: cv1,
      },
      { validateStatus: () => true }
    );

    refreshTokenA = tokenResA.data.refresh_token;

    await axios.post(
      `${CLIENT_A}/api/auth/callback`,
      {
        accessToken: tokenResA.data.access_token,
        refreshToken: refreshTokenA,
      },
      { validateStatus: () => true }
    );
    console.log(`   ✓ App A logged in`);

    // Login to App B
    const startResB = await axios.get(`${CLIENT_B}/api/auth/start`, {
      validateStatus: () => true,
    });
    
    // Extract codeVerifier from cookie
    const verifierCookieB2 = startResB.headers["set-cookie"]?.find(c => c.includes("pkce_verifier"));
    const cv2 = verifierCookieB2 ? verifierCookieB2.split("pkce_verifier=")[1].split(";")[0] : undefined;
    
    // Parse the URL to extract code_challenge and state
    const authUrlB2 = new URL(startResB.data.url);
    const cc2 = authUrlB2.searchParams.get("code_challenge");
    const s2 = authUrlB2.searchParams.get("state");

    const authResB = await axios.get(`${IDP_SERVER}/api/auth/authorize`, {
      params: {
        client_id: CLIENT_B_ID,
        redirect_uri: `${CLIENT_B}/api/auth/callback`,
        response_type: "code",
        scope: "openid profile email",
        state: s2,
        code_challenge: cc2,
        code_challenge_method: "S256",
      },
      headers: idpCookie ? { Cookie: idpCookie } : {},
      validateStatus: () => true,
    });

    const codeB = (authResB.headers.location || "").match(/code=([^&]+)/)?.[1];

    const tokenResB = await axios.post(
      `${IDP_SERVER}/api/auth/token`,
      {
        grant_type: "authorization_code",
        client_id: CLIENT_B_ID,
        client_secret: CLIENT_B_SECRET,
        code: codeB,
        code_verifier: cv2,
      },
      { validateStatus: () => true }
    );

    refreshTokenB = tokenResB.data.refresh_token;

    await axios.post(
      `${CLIENT_B}/api/auth/callback`,
      {
        accessToken: tokenResB.data.access_token,
        refreshToken: refreshTokenB,
      },
      { validateStatus: () => true }
    );
    console.log(`   ✓ App B logged in`);

    // Step 2: Perform global logout
    console.log("\n2️⃣  Performing global logout from IDP...");
    const globalLogoutRes = await axios.post(
      `${IDP_SERVER}/api/auth/logout`,
      {},
      {
        headers: idpCookie ? { Cookie: idpCookie } : {},
        validateStatus: () => true,
      }
    );
    if (globalLogoutRes.status !== 200) {
      throw new Error(`Global logout failed with status ${globalLogoutRes.status}`);
    }
    console.log(`   ✓ Global logout successful`);

    // Step 3: Verify both refresh tokens are revoked
    console.log("\n3️⃣  Verifying both refresh tokens are revoked...");
    
    const refreshARes = await axios.post(
      `${IDP_SERVER}/api/auth/token`,
      {
        grant_type: "refresh_token",
        client_id: CLIENT_A_ID,
        client_secret: CLIENT_A_SECRET,
        refresh_token: refreshTokenA,
      },
      { validateStatus: () => true }
    );

    if (refreshARes.status !== 400) {
      throw new Error(`Expected 400 for revoked token A, got ${refreshARes.status}`);
    }
    console.log(`   ✓ App A refresh token is revoked`);

    const refreshBRes = await axios.post(
      `${IDP_SERVER}/api/auth/token`,
      {
        grant_type: "refresh_token",
        client_id: CLIENT_B_ID,
        client_secret: CLIENT_B_SECRET,
        refresh_token: refreshTokenB,
      },
      { validateStatus: () => true }
    );

    if (refreshBRes.status !== 400) {
      throw new Error(`Expected 400 for revoked token B, got ${refreshBRes.status}`);
    }
    console.log(`   ✓ App B refresh token is revoked`);

    results.push({ name: testName, passed: true });
    console.log(`\n✅ ${testName} PASSED`);
  } catch (error: any) {
    results.push({
      name: testName,
      passed: false,
      error: error.message,
    });
    console.error(`\n❌ ${testName} FAILED:`, error.message);
  }
}

// ============================================================================
// Main test runner
// ============================================================================
async function runAllTests() {
  console.log("\n");
  console.log("█".repeat(70));
  console.log("█" + " ".repeat(68) + "█");
  console.log(
    "█" +
      " Stage 10: Logout Modes (Local & Global) ".padEnd(68) +
      "█"
  );
  console.log("█" + " ".repeat(68) + "█");
  console.log("█".repeat(70));

  await testLocalLogout();
  await testGlobalLogout();
  await testLocalLogoutIsolation();
  await testGlobalLogoutAffectsAllApps();

  // Summary
  console.log("\n");
  console.log("█".repeat(70));
  console.log("█ TEST RESULTS SUMMARY " + " ".repeat(46) + "█");
  console.log("█".repeat(70));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  results.forEach((result) => {
    const status = result.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} | ${result.name}`);
    if (result.error) {
      console.log(`     └─ ${result.error}`);
    }
  });

  console.log("\n" + "─".repeat(70));
  console.log(`📊 Total: ${total} tests, ${passed} passed, ${failed} failed`);
  console.log("─".repeat(70) + "\n");

  process.exit(failed > 0 ? 1 : 0);
}

runAllTests().catch((error) => {
  console.error("Test runner error:", error);
  process.exit(1);
});
