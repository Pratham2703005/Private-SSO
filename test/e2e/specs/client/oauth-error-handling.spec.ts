import { test, expect } from "@playwright/test";
import { loginViaUI } from "../../helpers/auth";
import testData from "../../fixtures/test-data.json";

test.describe("Client: OAuth Error Handling", () => {
  const { users, clients } = testData;
  const testUser = users[0];
  const client = clients[0];

  test("Invalid redirect_uri in callback fails", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);

    // Try OAuth with wrong redirect_uri
    const authUrl = new URL("http://localhost:3000/api/auth/authorize");
    authUrl.searchParams.set("client_id", client.clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", "http://evil.com/callback");
    authUrl.searchParams.set("state", "test");

    await page.goto(authUrl.toString());

    // Should NOT redirect to evil.com
    // Should show error or redirect to IDP login

    expect(page.url()).not.toContain("evil.com");
  });

  test("Missing state parameter is handled", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);

    // Authorize without state
    const authUrl = new URL("http://localhost:3000/api/auth/authorize");
    authUrl.searchParams.set("client_id", client.clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", client.redirectUri);
    // Missing: state

    await page.goto(authUrl.toString());

    // Should either reject or generate default state
    // Depending on implementation
  });

  test("Code exchange with missing client_id fails", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);

    // Get authorization code first
    const authUrl = new URL("http://localhost:3000/api/auth/authorize");
    authUrl.searchParams.set("client_id", client.clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", client.redirectUri);
    authUrl.searchParams.set("state", "state_123");

    await page.goto(authUrl.toString());

    const redirectUrl = page.url();
    const codeMatch = redirectUrl.match(/code=([^&]+)/);
    const code = codeMatch![1];

    // Try token exchange WITHOUT client_id
    const tokenResponse = await page.request.post(
      "http://localhost:3000/api/auth/token",
      {
        data: {
          grant_type: "authorization_code",
          code,
          // Missing client_id
        },
      }
    );

    expect(tokenResponse.status()).toBe(400);
  });

  test("Accessing /callback without code redirects to login", async ({
    page,
  }) => {
    // Direct access to /callback without authorization code
    await page.goto("http://localhost:3003/callback");

    // Should redirect to /login or show error
    expect(page.url()).toMatch(/login|error/);
  });

  test("Invalid state in callback is rejected", async ({ page }) => {
    // Simulate state mismatch in callback
    await page.goto("http://localhost:3003/callback?code=test123&state=wrong");

    // Should redirect to login or show error
    const url = page.url();
    expect(url).toMatch(/login|error|rejected/);

  });

  test("Expired authorization code cannot be reused", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);

    // Get code
    const authUrl = new URL("http://localhost:3000/api/auth/authorize");
    authUrl.searchParams.set("client_id", client.clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", client.redirectUri);

    await page.goto(authUrl.toString());

    const redirectUrl = page.url();
    const codeMatch = redirectUrl.match(/code=([^&]+)/);
    const code = codeMatch![1];

    // Exchange immediately - should work
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

    // Try to reuse same code - should fail
    const response2 = await page.request.post(
      "http://localhost:3000/api/auth/token",
      {
        data: {
          grant_type: "authorization_code",
          code,
          client_id: client.clientId,
        },
      }
    );

    expect(response2.status()).toBe(400);
    const error = await response2.json();
    expect(error.error).toBe("invalid_grant");
  });

  test("Non-existent client_id in authorization is rejected", async ({
    page,
  }) => {
    // Try to authorize non-existent client
    const authUrl = new URL("http://localhost:3000/api/auth/authorize");
    authUrl.searchParams.set("client_id", "non-existent-client");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", "http://localhost:3003/callback");

    await page.goto(authUrl.toString());

    // Should show error, not redirect
    expect(page.url()).not.toContain("callback");

    const url = page.url();
    const bodyText = (await page.textContent("body")) ?? "";

    expect(
    url.includes("error") ||
        url.includes("invalid") ||
        bodyText.includes("error") ||
        bodyText.includes("invalid")
    ).toBeTruthy();
  });
});

