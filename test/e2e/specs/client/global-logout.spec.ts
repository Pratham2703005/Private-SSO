import { test, expect } from "@playwright/test";
import { loginViaUI, logoutViaAPI } from "../../helpers/auth";
import {
  assertUserLoggedOut,
  assertIDPSessionDestroyed,
  assertClientSessionDestroyed,
} from "../../helpers/assertions";
import testData from "../../fixtures/test-data.json";

test.describe("Client: Global Logout", () => {
  const { users } = testData;
  const testUser = users[0]; // Test1

  test.beforeEach(async ({ page }) => {
    // Login and navigate to client
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");
    await page.waitForFunction(() => {
      const cookies = document.cookie;
      return cookies.includes("app_session_c");
    });
  });

  test("Global logout destroys __sso_session cookie", async ({
    page,
    context,
  }) => {
    // Logout with global scope
    const logoutOk = await logoutViaAPI(page, "global");
    expect(logoutOk).toBe(true);

    // IDP session should be destroyed
    await assertIDPSessionDestroyed(context);

    // App session also destroyed
    await assertClientSessionDestroyed(context, "app_session_c");
  });

  test("User redirected to login after global logout", async ({ page }) => {
    // Logout
    const logoutOk = await logoutViaAPI(page, "global");
    expect(logoutOk).toBe(true);

    // Navigate to protected page → redirects to login
    await page.goto("http://localhost:3003/dashboard");
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });

  test("All clients require re-login after global logout", async ({
    page,
    browser,
  }) => {
    // Global logout from client-c
    const logoutOk = await logoutViaAPI(page, "global");
    expect(logoutOk).toBe(true);

    // Verify client-c logged out
    await assertUserLoggedOut(page);

    // Try to access client-a (if available)
    const page2 = await browser.newPage();
    await page2.goto("http://localhost:3001");

    // Client-a should also require login
    const meResponse = await page2.request.get("http://localhost:3001/api/me");
    expect(meResponse.status()).toBe(401);

    await page2.close();
  });

  test("Cannot use stale tokens after global logout", async ({
    page,
    request,
  }) => {
    // Get a fresh access token before logout
    let me = await page.request.get("http://localhost:3003/api/me");
    const userData = await me.json();
    const accessToken = userData.accessToken;

    // Global logout
    await logoutViaAPI(page, "global");

    // Try to use old token
    if (accessToken) {
      const response = await request.get("http://localhost:3003/api/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.status()).toBe(401);
    }
  });

  test("After global logout, login creates fresh session", async ({
    page,
  }) => {
    // Logout
    await logoutViaAPI(page, "global");

    // Wait for redirect to login
    await page.waitForURL(/\/login/);

    // Login again
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.click('button[type="submit"]');

    // Should have new session
    await page.waitForFunction(async () => {
      const response = await fetch("http://localhost:3003/api/me");
      return response.status === 200;
    });

    const me = await page.request.get("http://localhost:3003/api/me");
    expect(me.ok).toBe(true);

    const userData = await me.json();
    expect(userData.authenticated).toBe(true);
  });
});

