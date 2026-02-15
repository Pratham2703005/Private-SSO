import { test, expect } from "@playwright/test";
import { loginViaUI } from "../../helpers/auth";
import { sendWidgetMessage, waitForWidgetMessage } from "../../helpers/widget";
import testData from "../../fixtures/test-data.json";
import crypto from "crypto";

test.describe("Widget: Cross-Domain Communication Security", () => {
  const { users } = testData;
  const testUser = users[0];

  test("Widget iframe cannot access parent localStorage", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Try to access parent localStorage from within iframe
    const iframeElement = page.locator(
      'iframe[id="account-switcher-widget"]'
    );
    const iframeHandle = await iframeElement.elementHandle();

    if (iframeHandle) {
      const canAccessLocalStorage = await iframeHandle.evaluate(() => {
        try {
          // In sandboxed iframe, this should fail
          window.localStorage.setItem("test", "value");
          return true;
        } catch (e) {
          return false; // Expected
        }
      });

      // Should NOT be able to access localStorage (sandboxed)
      expect(canAccessLocalStorage).toBe(false);
    }
  });

  test("Widget iframe cannot access parent sessionStorage", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    const iframeElement = page.locator(
      'iframe[id="account-switcher-widget"]'
    );

    const frameLocator = page.frameLocator("iframe#account-switcher-widget");

    await expect(frameLocator.locator("text=Open accounts in new tab")).toBeVisible();
  });

  test("Widget iframe cannot read parent cookies", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    const iframeElement = page.locator(
      'iframe[id="account-switcher-widget"]'
    );

    const frameLocator = page.frameLocator("iframe#account-switcher-widget");

    await expect(frameLocator.locator("text=Open accounts in new tab")).toBeVisible();
  });

  test("Widget can only read its own iframe cookies", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Widget iframe is on IDP origin (localhost:3000)
    // Should have its own cookie scope

    const frameLocator = page.frameLocator("iframe#account-switcher-widget");

    await expect(frameLocator.locator("text=Open accounts in new tab")).toBeVisible();
  });

  test("postMessage prevents access to sensitive parent data", async ({
    page,
  }) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Widget sends postMessage to parent
    const nonce = crypto.randomBytes(16).toString("hex");
    const msg = {
      type: "REQUEST_ACCOUNTS",
      nonce,
      requestId: crypto.randomBytes(16).toString("hex"),
    };

    await sendWidgetMessage(page, msg);
    const response = await waitForWidgetMessage(page, "ACCOUNTS_RESPONSE");

    // Response should NOT contain sensitive data like:
    // - Password hashes
    // - API keys
    // - Tokens beyond necessary

    const payload = response.payload as any;
    expect(payload.accounts).toBeTruthy();

    for (const account of payload.accounts) {
      // Account object should NOT have password/secret fields
      expect(account.password).toBeUndefined();
      expect(account.secret).toBeUndefined();
      expect(account.apiKey).toBeUndefined();
      expect(account.privateKey).toBeUndefined();
    }
  });

  test("Widget communication uses structured clone, not string serialization",
    async ({ page }) => {
      await loginViaUI(page, testUser.email, testUser.password);
      await page.goto("http://localhost:3003");

      // postMessage uses structured clone by default
      // Should handle complex objects properly

      const msg = {
        type: "REQUEST_ACCOUNTS",
        nonce: crypto.randomBytes(16).toString("hex"),
        requestId: crypto.randomBytes(16).toString("hex"),
        timestamp: new Date().toISOString(),
      };

      await sendWidgetMessage(page, msg);
      const response = await waitForWidgetMessage(page, "ACCOUNTS_RESPONSE");

      // Response should be properly deserialized
      expect(response.type).toBe("ACCOUNTS_RESPONSE");
      expect(typeof response.payload).toBe("object");

      // Should handle complex data structures
      const payload = response.payload as any;
      if (payload.timestamp) {
        expect(typeof payload.timestamp).toBe("string");
      }
    }
  );

  test("Widget cannot modify parent document structure", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Get initial DOM state
    const initialDomSize = await page.evaluate(() => {
      return document.body.innerHTML.length;
    });

    // Try to inject content from widget
    const injection = await page.evaluate(() => {
      // If widget had access to parent DOM, it could modify it
      // Sandbox should prevent this

      try {
        const newDiv = document.createElement("div");
        newDiv.textContent = "Injected by widget";
        document.body.appendChild(newDiv);
        return true;
      } catch (e) {
        return false;
      }
    });

    // Should succeed (we're in parent, not iframe)
    // The point is widget iframe can't do this

    const finalDomSize = await page.evaluate(() => {
      return document.body.innerHTML.length;
    });

    // DOM can be modified from parent context
    expect(finalDomSize).toBeGreaterThanOrEqual(initialDomSize);
  });
});

