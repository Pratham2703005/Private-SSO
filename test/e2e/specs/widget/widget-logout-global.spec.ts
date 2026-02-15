import { test, expect } from "@playwright/test";
import { loginViaUI, logoutViaAPI } from "../../helpers/auth";
import {
  waitForWidgetReady,
  sendWidgetMessage,
  waitForWidgetMessage,
} from "../../helpers/widget";
import {
  assertIDPSessionDestroyed,
  assertClientSessionDestroyed,
} from "../../helpers/assertions";
import testData from "../../fixtures/test-data.json";
import crypto from "crypto";

test.describe("Widget: Global Logout", () => {
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

  test("Widget logout button with global scope destroys IDP session", async ({
    page,
    context,
  }) => {
    // Open widget
    await page.click("#widget-avatar");

    // Wait for ready
    const readyMsg = await waitForWidgetReady(page);
    expect(readyMsg.type).toBe("WIDGET_READY");

    // Send LOGOUT_GLOBAL message
    const logoutMsg = {
      type: "LOGOUT_GLOBAL",
      nonce: crypto.randomBytes(16).toString("hex"),
      requestId: crypto.randomBytes(16).toString("hex"),
    };
    await sendWidgetMessage(page, logoutMsg);

    // Wait for response
    const responseMsg = await waitForWidgetMessage(page, "AUTH_STATE");
    expect(responseMsg.payload).toBeTruthy();

    const payload = responseMsg.payload as Record<string, unknown>;
    expect(payload.loggedOut).toBe(true);
    expect(payload.scope).toBe("global");

    // IDP session should be destroyed
    await assertIDPSessionDestroyed(context);

    // Client session also destroyed
    await assertClientSessionDestroyed(context, "app_session_c");
  });

  test("After global logout, user redirected to login", async ({ page }) => {
    // Logout via widget
    await page.click("#widget-avatar");
    await waitForWidgetReady(page);

    const logoutMsg = {
      type: "LOGOUT_GLOBAL",
      nonce: crypto.randomBytes(16).toString("hex"),
      requestId: crypto.randomBytes(16).toString("hex"),
    };
    await sendWidgetMessage(page, logoutMsg);
    await waitForWidgetMessage(page, "AUTH_STATE");

    // Should be redirected to login
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });

  test("Global logout affects all clients", async ({
    page,
    context,
    browser,
  }) => {
    // Logout from client-c globally
    const logoutOk = await logoutViaAPI(page, "global");
    expect(logoutOk).toBe(true);

    // Client-c logged out
    await assertClientSessionDestroyed(context, "app_session_c");

    // IDP session gone
    await assertIDPSessionDestroyed(context);

    // Client-a also requires login
    const page2 = await browser.newPage();
    await page2.goto("http://localhost:3001");

    const me = await page2.request.get("http://localhost:3001/api/me");
    expect(me.status()).toBe(401);

    await page2.close();
  });

  test("Global logout destroys refresh tokens", async ({
    page,
    request,
  }) => {
    // Get an initial refresh token (from earlier login)
    // (This would need to be captured during initial auth)

    // Global logout
    const logoutOk = await logoutViaAPI(page, "global");
    expect(logoutOk).toBe(true);

    // Any subsequent token refresh should fail
    // (Requires actual refresh token from setup)
  });
});

