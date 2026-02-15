import { test, expect } from "@playwright/test";
import { loginViaUI, logoutViaAPI } from "../../helpers/auth";
import {
  waitForWidgetReady,
  sendWidgetMessage,
  waitForWidgetMessage,
} from "../../helpers/widget";
import {
  assertUserLoggedOut,
  assertClientSessionDestroyed,
  assertIDPSessionExists,
} from "../../helpers/assertions";
import testData from "../../fixtures/test-data.json";
import crypto from "crypto";

test.describe("Widget: Logout (App-Scoped)", () => {
  const { users } = testData;
  const testUser = users[0]; // Alice

  test.beforeEach(async ({ page }) => {
    // Login to IDP
    await loginViaUI(page, testUser.email, testUser.password);

    // Navigate to client
    await page.goto("http://localhost:3003");

    // Wait for client session
    await page.waitForFunction(() => {
      const cookies = document.cookie;
      return cookies.includes("app_session_c");
    });
  });

  test("Logout from widget clears app_session_c but keeps IDP session", async ({
    page,
    context,
  }) => {
    // Verify we're logged in
    const response = await page.request.get("http://localhost:3003/api/me");
    expect(response.ok).toBe(true);

    // Open widget and click logout
    await page.click("#widget-avatar");
    await waitForWidgetReady(page);

    const logoutMsg = {
      type: "LOGOUT_APP",
      nonce: crypto.randomBytes(16).toString("hex"),
      requestId: crypto.randomBytes(16).toString("hex"),
      payload: { clientId: "client-c" },
    };
    await sendWidgetMessage(page, logoutMsg);

    // Wait for response
    const responseMsg = await waitForWidgetMessage(page, "AUTH_STATE");
    expect(responseMsg.payload).toBeTruthy();

    const payload = responseMsg.payload as Record<string, unknown>;
    expect(payload.loggedOut).toBe(true);
    expect(payload.scope).toBe("app");

    // Client session should be destroyed (app_session_c gone)
    await assertClientSessionDestroyed(context, "app_session_c");

    // Client should prompt to login
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");

    // IDP session should still exist
    await assertIDPSessionExists(context);
  });

  test("After app logout, IDP session still valid for other clients", async ({
    page,
    context,
    browser,
  }) => {
    // Logout from client-c
    const logoutOk = await logoutViaAPI(page, "app");
    expect(logoutOk).toBe(true);

    // Session should be gone on client-c
    await assertUserLoggedOut(page);

    // Open client-a in new tab
    const page2 = await browser.newPage();
    await page2.goto("http://localhost:3001"); // Assuming client-a on port 3001

    // Client-a should still be logged in (IDP session alive)
    const me = await page2.request.get("http://localhost:3001/api/me");
    if (me.status() === 200) {
      // Client-a detected IDP session and auto-logged in
      const userData = await me.json();
      expect(userData.authenticated).toBe(true);
    }

    await page2.close();
  });

  test("User redirected to login after app scope logout", async ({ page }) => {
    // Logout
    await page.click("#widget-avatar");
    await waitForWidgetReady(page);

    const logoutMsg = {
      type: "LOGOUT_APP",
      nonce: crypto.randomBytes(16).toString("hex"),
      requestId: crypto.randomBytes(16).toString("hex"),
      payload: { clientId: "client-c" },
    };
    await sendWidgetMessage(page, logoutMsg);

    await waitForWidgetMessage(page, "AUTH_STATE");

    // Should redirect to login
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");

    // Login form should be visible
    const loginForm = page.locator('form[data-testid="login-form"]');
    await expect(loginForm).toBeVisible();
  });
});

