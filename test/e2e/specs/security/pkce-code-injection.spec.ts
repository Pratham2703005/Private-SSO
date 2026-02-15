import { test, expect } from "@playwright/test";
import { loginViaUI } from "../../helpers/auth";
import testData from "../../fixtures/test-data.json";
import crypto from "crypto";

test.describe("Security: PKCE Code Injection Attack Prevention", () => {
  const { users, clients } = testData;
  const client = clients[0];
  const testUser = users[0];

  test("Authorization code cannot be reused with different code_verifier", async ({
    page,
  }) => {
    // Attacker scenario:
    // 1. Attacker intercepts authorization code
    // 2. Attacker tries to use code with their own code_verifier
    // 3. IDP should reject (code_challenge was hash of legitimate verifier)

    await loginViaUI(page, testUser.email, testUser.password);

    // Generate legitimate PKCE pair
    const legitimateVerifier = crypto.randomBytes(32).toString("base64url");
    const legitimateChallenge = crypto
      .createHash("sha256")
      .update(legitimateVerifier)
      .digest("base64url");

    // Request auth code with legitimate challenge
    const authUrl = new URL("http://localhost:3000/api/auth/authorize");
    authUrl.searchParams.set("client_id", client.clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", client.redirectUri);
    authUrl.searchParams.set("code_challenge", legitimateChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("state", "test_state_123");

    await page.goto(authUrl.toString());

    // IDP will redirect with code
    const redirectedUrl = page.url();
    const codeMatch = redirectedUrl.match(/code=([^&]+)/);
    expect(codeMatch).toBeTruthy();
    const code = codeMatch![1];

    // Attacker tries to exchange code with different verifier
    const attackVerifier = crypto.randomBytes(32).toString("base64url");

    // Try token exchange with wrong verifier
    const tokenResponse = await page.request.post(
      "http://localhost:3000/api/auth/token",
      {
        data: {
          grant_type: "authorization_code",
          code,
          client_id: client.clientId,
          code_verifier: attackVerifier,
        },
      }
    );

    // Should fail with 400 (invalid_grant)
    expect(tokenResponse.status()).toBe(400);
    const body = await tokenResponse.json();
    expect(body.error).toBe("invalid_grant");
  });

  test("Authorization code fails without code_verifier when PKCE required", async ({
    page,
  }) => {
    await loginViaUI(page, testUser.email, testUser.password);

    // Request code with PKCE challenge
    const verifier = crypto.randomBytes(32).toString("base64url");
    const challenge = crypto
      .createHash("sha256")
      .update(verifier)
      .digest("base64url");

    const authUrl = new URL("http://localhost:3000/api/auth/authorize");
    authUrl.searchParams.set("client_id", client.clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", client.redirectUri);
    authUrl.searchParams.set("code_challenge", challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    await page.goto(authUrl.toString());

    const redirectedUrl = page.url();
    const codeMatch = redirectedUrl.match(/code=([^&]+)/);
    const code = codeMatch![1];

    // Try exchange WITHOUT code_verifier
    const tokenResponse = await page.request.post(
      "http://localhost:3000/api/auth/token",
      {
        data: {
          grant_type: "authorization_code",
          code,
          client_id: client.clientId,
          // No code_verifier
        },
      }
    );

    // Should fail
    expect(tokenResponse.status()).toBe(400);
  });

  test("Code challenge mismatch prevents token exchange", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);

    // Request code with one challenge
    const validVerifier = crypto.randomBytes(32).toString("base64url");
    const validChallenge = crypto
      .createHash("sha256")
      .update(validVerifier)
      .digest("base64url");

    const authUrl = new URL("http://localhost:3000/api/auth/authorize");
    authUrl.searchParams.set("client_id", client.clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", client.redirectUri);
    authUrl.searchParams.set("code_challenge", validChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    await page.goto(authUrl.toString());

    const redirectedUrl = page.url();
    const codeMatch = redirectedUrl.match(/code=([^&]+)/);
    const code = codeMatch![1];

    // Exchange with DIFFERENT verifier (but same length, valid base64url)
    const wrongVerifier = crypto.randomBytes(32).toString("base64url");

    const tokenResponse = await page.request.post(
      "http://localhost:3000/api/auth/token",
      {
        data: {
          grant_type: "authorization_code",
          code,
          client_id: client.clientId,
          code_verifier: wrongVerifier,
        },
      }
    );

    expect(tokenResponse.status()).toBe(400);
    const body = await tokenResponse.json();
    expect(body.error).toBe("invalid_grant");
  });

  test("PKCE verifier length validation (too short/long)", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);

    // RFC 7636: code_verifier must be 43-128 characters
    const validVerifier = crypto.randomBytes(32).toString("base64url");
    const challenge = crypto
      .createHash("sha256")
      .update(validVerifier)
      .digest("base64url");

    const authUrl = new URL("http://localhost:3000/api/auth/authorize");
    authUrl.searchParams.set("client_id", client.clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", client.redirectUri);
    authUrl.searchParams.set("code_challenge", challenge);

    await page.goto(authUrl.toString());

    const redirectedUrl = page.url();
    const codeMatch = redirectedUrl.match(/code=([^&]+)/);
    const code = codeMatch![1];

    // Try with invalid length (too short)
    const tooShort = "short";

    const tokenResponse = await page.request.post(
      "http://localhost:3000/api/auth/token",
      {
        data: {
          grant_type: "authorization_code",
          code,
          client_id: client.clientId,
          code_verifier: tooShort,
        },
      }
    );

    expect([400, 401]).toContain(tokenResponse.status());
  });
});

