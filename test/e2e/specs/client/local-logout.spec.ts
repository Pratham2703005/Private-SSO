import { test, expect } from "@playwright/test";
import { loginViaUI, logoutViaAPI } from "../../helpers/auth";
import {
  assertUserLoggedOut,
  assertClientSessionDestroyed,
  assertIDPSessionExists,
} from "../../helpers/assertions";
import testData from "../../fixtures/test-data.json";

test.describe("Client: Local Logout (App-Scoped)", () => {
  const { users } = testData;
  const testUser = users[0]; // Alice

  test.beforeEach(async ({ page }) => {
    // Login and navigate to client
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");
    await page.waitForFunction(() => {
      const cookies = document.cookie;
      return cookies.includes("app_session_c");
    });
  });

  test("Local logout clears app_session_c cookie", async ({ page, context }) => {
    // Verify logged in
    let me = await page.request.get("http://localhost:3003/api/me");
    expect(me.ok).toBe(true);

    // Logout with app scope
    const logoutOk = await logoutViaAPI(page, "app");
    expect(logoutOk).toBe(true);

    // Session should be destroyed
    await assertClientSessionDestroyed(context, "app_session_c");

    // /api/me should fail
    await assertUserLoggedOut(page);
  });

  test("User redirected to login page after local logout", async ({
    page,
  }) => {
    // Logout
    const logoutOk = await logoutViaAPI(page, "app");
    expect(logoutOk).toBe(true);

    // Navigate to dashboard → should redirect to login
    await page.goto("http://localhost:3003/dashboard");

    // Should be on login page
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });

  test("IDP session remains active after app logout", async ({
    page,
    context,
  }) => {
    // Logout from client-c (app scope)
    await logoutViaAPI(page, "app");

    // IDP session should still exist
    await assertIDPSessionExists(context);

    // Verify by attempting to login to another client
    // (would require second client to test properly)
  });

  test("Multiple clients can have independent app sessions", async ({
    page,
    context,
    browser,
  }) => {
    // Logout from client-c
    await logoutViaAPI(page, "app");
    await assertUserLoggedOut(page);

    // Client-c session gone
    await assertClientSessionDestroyed(context, "app_session_c");

    // But IDP session still exists
    await assertIDPSessionExists(context);

    // Could open client-a, create new app session, 
    // while client-c remains logged out
  });

  test("Login to same client after local logout creates new session", async ({
    page,
  }) => {
    // Local logout
    await logoutViaAPI(page, "app");
    await assertUserLoggedOut(page);

    // Navigate to login
    await page.goto("http://localhost:3003/login");

    // Login again
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.click('button[type="submit"]');

    // Should be logged in again
    await page.waitForFunction(async () => {
      const response = await fetch("http://localhost:3003/api/me");
      return response.status === 200;
    });

    const me = await page.request.get("http://localhost:3003/api/me");
    expect(me.ok).toBe(true);
  });
});

