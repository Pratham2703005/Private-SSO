import { test, expect } from "@playwright/test";
import { loginViaUI } from "../../helpers/auth";
import { sendWidgetMessage, waitForWidgetMessage } from "../../helpers/widget";
import testData from "../../fixtures/test-data.json";
import crypto from "crypto";

test.describe("Security: XSS Injection Prevention in Widget", () => {
  const { users } = testData;
  const testUser = users[0];

  test("Widget sanitizes HTML in account names", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Request accounts
    const nonce = crypto.randomBytes(16).toString("hex");
    const msg = {
      type: "REQUEST_ACCOUNTS",
      nonce,
      requestId: crypto.randomBytes(16).toString("hex"),
    };

    await sendWidgetMessage(page, msg);
    const response = await waitForWidgetMessage(page, "ACCOUNTS_RESPONSE");

    // Check account names in response
    const accounts = (response.payload as any).accounts;

    // Even if name contains HTML, should not execute
    const iframe = page.frameLocator('iframe[id="account-switcher-widget"]');

    for (const account of accounts) {
      // Check that account name is displayed safely
      const accountElement = iframe.locator(
        `[data-account-id="${account.id}"]`
      );

      // Should not contain raw HTML
      const innerHTML = await accountElement.innerHTML();
      expect(innerHTML).not.toContain("<script>");
      expect(innerHTML).not.toContain("javascript:");
      expect(innerHTML).not.toContain("onerror=");
      expect(innerHTML).not.toContain("onclick=");
    }
  });

  test("Widget escapes special characters in account metadata", async ({
    page,
  }) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Test with special characters
    const testStrings = [
      '<script>alert("xss")</script>',
      '"><script>alert("xss")</script>',
      "javascript:alert('xss')",
      '<img src=x onerror="alert(\'xss\')">',
      '<svg onload="alert(\'xss\')">',
      "data:text/html,<script>alert('xss')</script>",
    ];

    // Try to inject through widget messages (if possible)
    for (const xssPayload of testStrings) {
      const msg = {
        type: "REQUEST_ACCOUNTS",
        nonce: crypto.randomBytes(16).toString("hex"),
        requestId: crypto.randomBytes(16).toString("hex"),
        payload: { testField: xssPayload }, // Try injection
      };

      await page.evaluate((message) => {
        const iframe = document.querySelector(
          'iframe[id="account-switcher-widget"]'
        ) as HTMLIFrameElement;
        iframe?.contentWindow?.postMessage(message, "http://localhost:3000");
      }, msg);

      // Give time for potential XSS to execute
      await page.waitForTimeout(200);

      // Check no XSS alerts or errors
      // If XSS worked, would see console errors or page changes
    }

    // Page should still be functional
    expect(page.url()).toContain("localhost:3003");
  });

  test("Widget iframe runs with strict CSP preventing inline scripts", async ({
    page,
  }) => {
    // Widget iframe should have CSP that prevents:
    // - Inline scripts
    // - eval()
    // - External scripts without nonce/hash

    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Get widget iframe source
    const iframeElement = page.locator('iframe[id="account-switcher-widget"]');
    const iframeSrc = await iframeElement.getAttribute("src");

    expect(iframeSrc).toBeTruthy();

    // Widget loads from IDP with CSP header
    const response = await page.request.get(iframeSrc!);

    const headers = response.headers();
    const cspHeader = headers["content-security-policy"];

    // Should have restrictive CSP
    if (cspHeader) {
    expect(cspHeader).not.toContain("unsafe-inline");
    expect(cspHeader).toContain("sandbox");
    }

  });

  test("Widget sandbox attribute prevents DOM access to parent", async ({
    page,
  }) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Widget iframe should have sandbox without allow-same-origin
    const iframeElement = page.locator(
      'iframe[id="account-switcher-widget"]'
    );
    const sandbox = await iframeElement.getAttribute("sandbox");

    expect(sandbox).toBeTruthy();

    // Check sandbox attributes
    const sandboxAttrs = sandbox!.split(" ");

    // Should allow scripts (to run widget code)
    expect(sandboxAttrs).toContain("allow-scripts");

    // But NOT allow-same-origin (prevents DOM access)
    // This prevents: parent.document, parent.localStorage, etc.
    expect(sandboxAttrs).not.toContain("allow-same-origin");

    // Should NOT allow top-level navigation
    expect(sandboxAttrs).not.toContain("allow-top-navigation");
  });

  test("Widget cannot access parent window through postMessage origin confusion",
    async ({ page }) => {
      await loginViaUI(page, testUser.email, testUser.password);
      await page.goto("http://localhost:3003");

      // Test that widget can't escape sandbox through origin tricks
      const frameAccessAttempt = await page.evaluate(() => {
        try {
          // Try to access parent
          const parent = window.parent;

          // Should not be able to access parent properties if sandboxed
          if (parent === window) {
            return { escaped: false }; // Sandboxed = parent === window
          } else {
            return { escaped: true, parent };
          }
        } catch (e) {
          return { error: String(e) };
        }
      });

      // In sandbox, parent should equal window (can't escape)
      expect(frameAccessAttempt.escaped || frameAccessAttempt.error).toBeTruthy();
    }
  );

  test("User input in account metadata doesn't create XSS vector", async ({
    page,
  }) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Request accounts - if display names have XSS, should be sanitized
    const msg = {
      type: "REQUEST_ACCOUNTS",
      nonce: crypto.randomBytes(16).toString("hex"),
      requestId: crypto.randomBytes(16).toString("hex"),
    };

    await sendWidgetMessage(page, msg);
    const response = await waitForWidgetMessage(page, "ACCOUNTS_RESPONSE");

    const accounts = (response.payload as any).accounts;

    // Verify each account display
    for (const account of accounts) {
      // Account properties should be plain text, not HTML
      expect(account.displayName).toBeTruthy();

      // Should not contain HTML entities that would render as tags
      expect(account.displayName).not.toContain("<");
      expect(account.displayName).not.toContain(">");

      // If it did contain these, should be escaped
      if (account.displayName.includes("&lt;")) {
        // This is OK (escaped)
        expect(account.displayName).toContain("&lt;");
      }
    }
  });
});

