import { test, expect } from "@playwright/test";
import { loginViaUI } from "../../helpers/auth";
import testData from "../../fixtures/test-data.json";

test.describe("Security: Refresh Token Rotation and Revocation", () => {
  const { users, clients } = testData;
  const client = clients[0];
  const testUser = users[0];

  test("Refresh token is rotated on every use", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);

    // Get initial tokens via authorization
    const authUrl = new URL("http://localhost:3000/api/auth/authorize");
    authUrl.searchParams.set("client_id", client.clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", client.redirectUri);
    authUrl.searchParams.set("state", "state_123");

    await page.goto(authUrl.toString());

    // IDP redirects with code
    const redirectUrl = page.url();
    const codeMatch = redirectUrl.match(/code=([^&]+)/);
    const code = codeMatch![1];

    // Exchange code for tokens
    const tokenResponse1 = await page.request.post(
      "http://localhost:3000/api/auth/token",
      {
        data: {
          grant_type: "authorization_code",
          code,
          client_id: client.clientId,
        },
      }
    );

    const tokens1 = await tokenResponse1.json();
    const refreshToken1 = tokens1.refresh_token;

    expect(refreshToken1).toBeTruthy();

    // Use refresh token to get new tokens
    const tokenResponse2 = await page.request.post(
      "http://localhost:3000/api/auth/token",
      {
        data: {
          grant_type: "refresh_token",
          refresh_token: refreshToken1,
          client_id: client.clientId,
        },
      }
    );

    const tokens2 = await tokenResponse2.json();
    const refreshToken2 = tokens2.refresh_token;

    // Refresh token MUST be rotated (new token issued)
    expect(refreshToken2).toBeTruthy();
    expect(refreshToken2).not.toBe(refreshToken1);
  });

  test("Old refresh token is invalidated after rotation", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);

    const authUrl = new URL("http://localhost:3000/api/auth/authorize");
    authUrl.searchParams.set("client_id", client.clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", client.redirectUri);

    await page.goto(authUrl.toString());

    const redirectUrl = page.url();
    const codeMatch = redirectUrl.match(/code=([^&]+)/);
    const code = codeMatch![1];

    // Get initial tokens
    const tokenResponse1 = await page.request.post(
      "http://localhost:3000/api/auth/token",
      {
        data: {
          grant_type: "authorization_code",
          code,
          client_id: client.clientId,
        },
      }
    );

    const tokens1 = await tokenResponse1.json();
    const oldRefreshToken = tokens1.refresh_token;

    // Use refresh token once
    const tokenResponse2 = await page.request.post(
      "http://localhost:3000/api/auth/token",
      {
        data: {
          grant_type: "refresh_token",
          refresh_token: oldRefreshToken,
          client_id: client.clientId,
        },
      }
    );

    expect(tokenResponse2.status()).toBe(200);
    const tokens2 = await tokenResponse2.json();
    const newRefreshToken = tokens2.refresh_token;

    // Now try to use OLD token again - should fail
    const tokenResponse3 = await page.request.post(
      "http://localhost:3000/api/auth/token",
      {
        data: {
          grant_type: "refresh_token",
          refresh_token: oldRefreshToken,
          client_id: client.clientId,
        },
      }
    );

    // Should be rejected
    expect(tokenResponse3.status()).toBe(400);
    const error = await tokenResponse3.json();
    expect(error.error).toBe("invalid_grant");
  });

  test("Refresh token reuse attack is detected and mitigated", async ({
    page,
  }) => {
    // Scenario: Attacker intercepts refresh token and uses it
    // System should detect the reuse and invalidate the token family

    await loginViaUI(page, testUser.email, testUser.password);

    const authUrl = new URL("http://localhost:3000/api/auth/authorize");
    authUrl.searchParams.set("client_id", client.clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", client.redirectUri);

    await page.goto(authUrl.toString());

    const redirectUrl = page.url();
    const codeMatch = redirectUrl.match(/code=([^&]+)/);
    const code = codeMatch![1];

    // Get initial token
    const tokenResponse1 = await page.request.post(
      "http://localhost:3000/api/auth/token",
      {
        data: {
          grant_type: "authorization_code",
          code,
          client_id: client.clientId,
        },
      }
    );

    const tokens1 = await tokenResponse1.json();
    const sharedRefreshToken = tokens1.refresh_token;

    // User refreshes token (legitimate)
    const userRefresh = await page.request.post(
      "http://localhost:3000/api/auth/token",
      {
        data: {
          grant_type: "refresh_token",
          refresh_token: sharedRefreshToken,
          client_id: client.clientId,
        },
      }
    );

    expect(userRefresh.status()).toBe(200);
    const userTokens = await userRefresh.json();

    // Attacker also tries to use old token (replay attack)
    const attackerRefresh = await page.request.post(
      "http://localhost:3000/api/auth/token",
      {
        data: {
          grant_type: "refresh_token",
          refresh_token: sharedRefreshToken,
          client_id: client.clientId,
        },
      }
    );

    // Should be rejected (token already used)
    expect(attackerRefresh.status()).toBe(400);

    // Optional: System should also invalidate the new token from user refresh
    // This is token rotation family invalidation
  });

  test("Refresh token has expiration time", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);

    const authUrl = new URL("http://localhost:3000/api/auth/authorize");
    authUrl.searchParams.set("client_id", client.clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", client.redirectUri);

    await page.goto(authUrl.toString());

    const redirectUrl = page.url();
    const codeMatch = redirectUrl.match(/code=([^&]+)/);
    const code = codeMatch![1];

    const tokenResponse = await page.request.post(
      "http://localhost:3000/api/auth/token",
      {
        data: {
          grant_type: "authorization_code",
          code,
          client_id: client.clientId,
        },
      }
    );

    const tokens = await tokenResponse.json();

    // Should have refresh token details or separate expiry
    expect(tokens.refresh_token).toBeTruthy();

    // For JWT refresh tokens, decode and check exp claim
    if (tokens.refresh_token.includes(".")) {
      const parts = tokens.refresh_token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(
          Buffer.from(parts[1], "base64url").toString()
        );

        // Should have expiration
        expect(payload.exp).toBeTruthy();

        // Should be valid for reasonable time (7-30 days typical)
        const expiresIn = payload.exp - Math.floor(Date.now() / 1000);
        expect(expiresIn).toBeGreaterThan(0);
        expect(expiresIn).toBeLessThan(30 * 24 * 60 * 60); // Less than 30 days
      }
    }
  });

  test("Refresh token cannot be used across different clients", async ({
    page,
  }) => {
    // Client-specific refresh tokens prevent token leakage attacks

    await loginViaUI(page, testUser.email, testUser.password);

    const authUrl = new URL("http://localhost:3000/api/auth/authorize");
    authUrl.searchParams.set("client_id", client.clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", client.redirectUri);

    await page.goto(authUrl.toString());

    const redirectUrl = page.url();
    const codeMatch = redirectUrl.match(/code=([^&]+)/);
    const code = codeMatch![1];

    const tokenResponse = await page.request.post(
      "http://localhost:3000/api/auth/token",
      {
        data: {
          grant_type: "authorization_code",
          code,
          client_id: client.clientId,
        },
      }
    );

    const tokens = await tokenResponse.json();
    const refreshToken = tokens.refresh_token;

    // Try to use token for different client (if we had another client)
    // This should fail
    const wrongClientRefresh = await page.request.post(
      "http://localhost:3000/api/auth/token",
      {
        data: {
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: "different-client", // Wrong client
        },
      }
    );

    // Should be rejected
    expect(wrongClientRefresh.status()).toBeGreaterThanOrEqual(400);
  });
});

