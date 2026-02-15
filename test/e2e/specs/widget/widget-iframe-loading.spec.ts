import { test, expect } from "@playwright/test";
import { loginViaUI } from "../../helpers/auth";
import { waitForWidgetReady } from "../../helpers/widget";
import testData from "../../fixtures/test-data.json";

test.describe("Widget: iframe Loading & Initialization", () => {
  const { users } = testData;
  const testUser = users[0]; // Alice

  test.beforeEach(async ({ page }) => {
    // Login and navigate to client
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");
    // Wait for page to settle (don't require app_session_c - app may not set it yet)
    await page.waitForLoadState("networkidle").catch(() => {
      // OK if page never fully loads
    });
    await page.waitForTimeout(500);
  });

  test("Widget iframe embeds correctly on client page", async ({ page }) => {
    // Navigate to page with widget
    await page.goto("http://localhost:3003/dashboard");

    // Iframe element should exist
    const iframe = page.locator('iframe[id="account-switcher-widget"]');
    await expect(iframe).toBeVisible();

    // Iframe should have correct src
    const src = await iframe.getAttribute("src");
    expect(src).toContain("http://localhost:3000");
    expect(src).toContain("account-switcher");
  });

  test("Widget iframe has correct sandbox attributes", async ({ page }) => {
    await page.goto("http://localhost:3003/dashboard");

    const iframe = page.locator('iframe[id="account-switcher-widget"]');

    // Check sandbox attribute
    const sandbox = await iframe.getAttribute("sandbox");
    expect(sandbox).toContain("allow-same-origin");
    expect(sandbox).toContain("allow-scripts");
  });

  test("Widget loads and sends WIDGET_READY message on initialization", async ({
    page,
  }) => {
    // Widget should load and send WIDGET_READY
    const readyMsg = await waitForWidgetReady(page, 5000);

    expect(readyMsg.type).toBe("WIDGET_READY");
    expect(readyMsg.nonce).toBeTruthy();
    expect(readyMsg.requestId).toBeTruthy();
    expect(typeof readyMsg.nonce).toBe("string");
    expect(typeof readyMsg.requestId).toBe("string");
  });

  test("Widget iframe does not have allow-top-navigation", async ({
    page,
  }) => {
    await page.goto("http://localhost:3003/dashboard");

    const iframe = page.locator('iframe[id="account-switcher-widget"]');
    const sandbox = await iframe.getAttribute("sandbox");

    // Should NOT allow top navigation (prevents iframe from hijacking page)
    expect(sandbox).not.toContain("allow-top-navigation");
  });

  test("Widget iframe origin matches IDP server", async ({ page }) => {
    const iframe = page.locator('iframe[id="account-switcher-widget"]');
    const src = await iframe.getAttribute("src");

    // Should point to IDP domain
    expect(src).toContain("localhost:3000");
    expect(src).not.toContain("localhost:3003"); // Not client domain
  });

  test("Widget ready message includes valid nonce format", async ({
    page,
  }) => {
    const readyMsg = await waitForWidgetReady(page);

    // Nonce should be hex string (32 chars for 16 bytes)
    const isValidHex = /^[a-f0-9]{32}$/.test(readyMsg.nonce as string);
    expect(isValidHex).toBe(true);

    // RequestId also hex
    const isValidRequestId = /^[a-f0-9]{32}$/.test(readyMsg.requestId as string);
    expect(isValidRequestId).toBe(true);
  });
});

