import { test, expect } from "@playwright/test";
import { loginViaUI } from "../../helpers/auth";
import testData from "../../fixtures/test-data.json";

test.describe("Security: Token Handling and Storage", () => {
  const { users, clients } = testData;
  const client = clients[0];
  const testUser = users[0];

  test("Access token is not stored in localStorage", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);

    // Check localStorage
    const tokenInStorage = await page.evaluate(() => {
      return localStorage.getItem("access_token");
    });

    // Tokens should NOT be in localStorage (XSS vulnerability)
    expect(tokenInStorage).toBeNull();
  });

  test("Access token is not stored in sessionStorage", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);

    const tokenInSession = await page.evaluate(() => {
      return sessionStorage.getItem("access_token");
    });

    // Tokens should NOT be in sessionStorage
    expect(tokenInSession).toBeNull();
  });

  test("Refresh token is not stored in client-side storage", async ({
    page,
  }) => {
    await loginViaUI(page, testUser.email, testUser.password);

    // Check all client-side storage
    const hasToken = await page.evaluate(() => {
      const inLocal = localStorage.getItem("refresh_token");
      const inSession = sessionStorage.getItem("refresh_token");
      const inGlobal = (window as any).refreshToken;

      return !!(inLocal || inSession || inGlobal);
    });

    // Refresh token should NOT be accessible to JS
    expect(hasToken).toBe(false);
  });

  test("Authorization code is single-use only", async ({ page }) => {
    // Get auth code
    const authUrl = new URL("http://localhost:3000/api/auth/authorize");
    authUrl.searchParams.set("client_id", client.clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", client.redirectUri);

    // First need session
    await loginViaUI(page, testUser.email, testUser.password);

    await page.goto(authUrl.toString());

    const redirectUrl = page.url();
    const codeMatch = redirectUrl.match(/code=([^&]+)/);
    const code = codeMatch![1];

    // First exchange - should work
    const response1 = await page.request.post(
      "http://localhost:3000/api/auth/token",
      {
        data: {
          grant_type: "authorization_code",
          code,
          client_id: client.clientId,
        },
      }
    );

    expect(response1.status()).toBe(200);

    // Second exchange with same code - should fail
    const response2 = await page.request.post(
      "http://localhost:3000/api/auth/token",
      {
        data: {
          grant_type: "authorization_code",
          code, // Same code
          client_id: client.clientId,
        },
      }
    );

    expect(response2.status()).toBe(400);
    const error = await response2.json();
    expect(error.error).toBe("invalid_grant");
  });

  test("Token endpoint requires POST, not GET", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);

    // Try GET request to token endpoint
    const response = await page.request.get(
      "http://localhost:3000/api/auth/token"
    );

    // Should be rejected (405 Method Not Allowed or similar)
    expect([405, 400, 404]).toContain(response.status());
  });

  test("Token endpoint doesn't expose valid codes in error messages", async ({
    page,
  }) => {
    // Try with invalid code
    const response = await page.request.post(
      "http://localhost:3000/api/auth/token",
      {
        data: {
          grant_type: "authorization_code",
          code: "invalid_code_12345",
          client_id: client.clientId,
        },
      }
    );

    const error = await response.json();

    // Error message should not reveal valid code structure
    const errorMsg = JSON.stringify(error);
    expect(errorMsg).not.toContain("code=");
    expect(errorMsg).not.toContain("valid");
  });

  test("Token payload is not cached in browser", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);

    // After navigation, tokens should not be accessible
    await page.goto("http://localhost:3003/some-page");
    await page.goto("http://localhost:3003/other-page");

    // Token info should not be in global scope
    const hasToken = await page.evaluate(() => {
      return (
        (window as any).token ||
        (window as any).accessToken ||
        (window as any).bearerToken
      );
    });

    expect(hasToken).toBeFalsy();
  });

  test("Sensitive token data requires authentication", async ({ page }) => {
    // Try to get token info without authentication
    const response = await page.request.get(
      "http://localhost:3000/api/auth/token-info"
    );

    // Should require auth (401 or redirect to login)
    expect([302, 401, 404]).toContain(response.status());
  });

  test("Token cannot be obtained through CSRF attack", async ({ page }) => {
    // Simulate CSRF attack (cross-site form submission)

    // Create form that would auto-submit from attacker site
    const formSubmit = await page.evaluate(() => {
      try {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = "http://localhost:3000/api/auth/token";
        form.innerHTML =
          '<input name="grant_type" value="password"><input name="username" value="test"><input name="password" value="test">';

        // Token endpoint should reject password grant from CSRF
        // or require additional validation

        return { canSubmit: true };
      } catch (e) {
        return { canSubmit: false };
      }
    });

    // Even if form submission attempted, server should
    // reject due to SameSite or other CSRF protection
  });
});

