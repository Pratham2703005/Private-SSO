import { test, expect } from "@playwright/test";
import { loginViaUI, logoutViaAPI } from "../../helpers/auth";
import testData from "../../fixtures/test-data.json";

test.describe("IDP: OAuth Authorization Code Flow", () => {
  const { users, clients } = testData;
  const testUser = users[0]; // Alice
  const client = clients[0]; // client-c

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await loginViaUI(page, testUser.email, testUser.password);
  });

  test("Unauthorized request redirects to login with state preserved", async ({
    page,
    context,
  }) => {
    // Logout first (clear session)
    await logoutViaAPI(page);

    // Try to access authorize without session
    const state = "test-state-123";
    const authorizeUrl = 
      "http://localhost:3000/api/auth/authorize?" +
      `client_id=${client.clientId}&` +
      "response_type=code&" +
      `redirect_uri=${client.redirectUri}&` +
      `state=${state}&` +
      "code_challenge=test-challenge";
      
    const response = await page.goto(authorizeUrl);
    
    // Log the actual URL after navigation to debug
    console.log("After goto authorize URL, page is at:", page.url());
    console.log("Response status:", response?.status());

    // Check if we're at login - if not, try waiting a bit
    if (!page.url().includes("/login")) {
      // Try waiting for login navigation
      try {
        await page.waitForURL(/\/login/, { timeout: 5000 });
      } catch {
        // If timeout, check what URL we actually got
        console.log("Failed to reach login URL. Currently at:", page.url());
      }
    }

    // Should be at login page now
    expect(page.url()).toContain("/login");

    // Login
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.click('button[type="submit"]');

    // After login, should return to authorize
    await page.waitForURL(/code=.*&state=/);
    const url = new URL(page.url());
    expect(url.searchParams.get("state")).toBe(state);
    expect(url.searchParams.has("code")).toBe(true);
  });

  test("Valid session returns authorization code", async ({ page }) => {
    const state = "valid-state-456";
    await page.goto(
      "http://localhost:3000/api/auth/authorize?" +
        `client_id=${client.clientId}&` +
        "response_type=code&" +
        `redirect_uri=${client.redirectUri}&` +
        `state=${state}&` +
        "code_challenge=test-challenge"
    );

    await page.waitForURL(/code=/);
    const url = new URL(page.url());
    expect(url.searchParams.has("code")).toBe(true);
    expect(url.searchParams.get("state")).toBe(state);
  });

  test("Invalid redirect_uri is rejected during authorization", async ({
    page,
  }) => {
    const invalidUri = "http://malicious.com/callback";
    await page.goto(
      "http://localhost:3000/api/auth/authorize?" +
        `client_id=${client.clientId}&` +
        "response_type=code&" +
        `redirect_uri=${invalidUri}&` +
        "state=test-state&" +
        "code_challenge=test-challenge"
    );

    // Should show error (not redirect to malicious URL)
    await page.waitForTimeout(1000);
    expect(page.url()).not.toContain(invalidUri);
  });

  test("Unknown client_id is rejected", async ({ page }) => {
    await page.goto(
      "http://localhost:3000/api/auth/authorize?" +
        "client_id=unknown-client-xyz&" +
        "response_type=code&" +
        "redirect_uri=http://localhost:3003/callback&" +
        "state=test-state&" +
        "code_challenge=test"
    );

    // Should show error
    await page.waitForTimeout(1000);
    const errorText = await page.textContent("body");
    expect(errorText).toMatch(/invalid|unknown|client/i);
  });

  test("Code is single-use only", async ({ page, request }) => {
    // Get authorization code
    const state = "one-time-state";
    await page.goto(
      "http://localhost:3000/api/auth/authorize?" +
        `client_id=${client.clientId}&` +
        "response_type=code&" +
        `redirect_uri=${client.redirectUri}&` +
        `state=${state}&` +
        "code_challenge=test-challenge"
    );

    await page.waitForURL(/code=/);
    const url = new URL(page.url());
    const code = url.searchParams.get("code");

    // Exchange code for token (success)
    const response1 = await request.post("http://localhost:3000/oauth/token", {
      data: {
        grant_type: "authorization_code",
        code,
        state,
        client_id: client.clientId,
        client_secret: client.clientSecret,
        redirect_uri: client.redirectUri,
        code_verifier: "test-verifier",
      },
    });
    expect(response1.ok).toBe(true);

    // Try to reuse same code (should fail)
    const response2 = await request.post("http://localhost:3000/oauth/token", {
      data: {
        grant_type: "authorization_code",
        code, // Reusing same code
        state,
        client_id: client.clientId,
        client_secret: client.clientSecret,
        redirect_uri: client.redirectUri,
        code_verifier: "test-verifier",
      },
    });
    expect(response2.status()).toBe(400);
  });
});

