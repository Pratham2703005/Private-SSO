import { test, expect } from "@playwright/test";
import { loginViaUI } from "../../helpers/auth";
import testData from "../../fixtures/test-data.json";

test.describe("Client: OAuth Callback (Code Exchange)", () => {
  const { users, clients } = testData;
  const testUser = users[0]; // Alice
  const client = clients[0]; // client-c

  test("Callback endpoint exchanges code for session", async ({ page }) => {
    // Login to IDP
    await loginViaUI(page, testUser.email, testUser.password);

    // Get authorization code
    await page.goto(
      "http://localhost:3000/api/auth/authorize?" +
        `client_id=${client.clientId}&` +
        "response_type=code&" +
        `redirect_uri=${client.redirectUri}&` +
        "state=test-state&" +
        "code_challenge=test"
    );

    await page.waitForURL(/code=/);
    const url = new URL(page.url());
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    // Navigate to callback manually (simulates redirect from IDP)
    await page.goto(
      `${client.redirectUri}?code=${code}&state=${state}`
    );

    // Client backend should exchange code for tokens
    await page.waitForURL(
      /dashboard|login/
    );

    // If exchange succeeded, user is logged in
    const me = await page.request.get("http://localhost:3003/api/me");
    expect(me.ok).toBe(true);

    const userData = await me.json();
    expect(userData.authenticated).toBe(true);
    expect(userData.user.email).toBe(testUser.email);
  });

  test("Callback with invalid state rejects token exchange", async ({
    page,
  }) => {
    // Login to IDP
    await loginViaUI(page, testUser.email, testUser.password);

    // Get authorization code
    await page.goto(
      "http://localhost:3000/api/auth/authorize?" +
        `client_id=${client.clientId}&` +
        "response_type=code&" +
        `redirect_uri=${client.redirectUri}&` +
        "state=test-state&" +
        "code_challenge=test"
    );

    await page.waitForURL(/code=/);
    const url = new URL(page.url());
    const code = url.searchParams.get("code");

    // Callback with WRONG state
    await page.goto(
      `${client.redirectUri}?code=${code}&state=WRONG-STATE`
    );

    // Should either redirect to login or show error
    await page.waitForTimeout(2000);

    // Verify NOT logged in (state mismatch rejected)
    const me = await page.request.get("http://localhost:3003/api/me");
    expect(me.status()).toBe(401);
  });

  test("Callback with invalid code fails", async ({ page }) => {
    // Try to exchange invalid code
    await page.goto(
      `http://localhost:3003/callback?code=invalid-code-xyz&state=test-state`
    );

    // Should not be logged in
    await page.waitForTimeout(2000);
    const me = await page.request.get("http://localhost:3003/api/me");
    expect(me.status()).toBe(401);
  });

  test("After callback, client session cookie is set", async ({
    page,
    context,
  }) => {
    // Login to IDP and get code
    await loginViaUI(page, testUser.email, testUser.password);

    await page.goto(
      "http://localhost:3000/api/auth/authorize?" +
        `client_id=${client.clientId}&` +
        "response_type=code&" +
        `redirect_uri=${client.redirectUri}&` +
        "state=test-state&" +
        "code_challenge=test"
    );

    await page.waitForURL(/code=/);
    const url = new URL(page.url());
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    // Navigate to callback
    await page.goto(`${client.redirectUri}?code=${code}&state=${state}`);

    // Verify app_session_c cookie exists
    const cookies = await context.cookies();
    const appSessionCookie = cookies.find((c) => c.name === "app_session_c");
    expect(appSessionCookie).toBeTruthy();
  });
});

