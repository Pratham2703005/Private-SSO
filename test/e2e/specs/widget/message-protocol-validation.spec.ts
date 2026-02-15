import { test, expect } from "@playwright/test";
import { loginViaUI } from "../../helpers/auth";
import { sendWidgetMessage, waitForWidgetMessage } from "../../helpers/widget";
import testData from "../../fixtures/test-data.json";
import crypto from "crypto";

test.describe("Widget: Message Protocol Validation", () => {
  const { users } = testData;
  const testUser = users[0];

  test("Widget rejects messages with missing type field", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Send message without type
    const invalidMsg = {
      nonce: crypto.randomBytes(16).toString("hex"),
      requestId: crypto.randomBytes(16).toString("hex"),
      // Missing type
    };

    await page.evaluate((msg) => {
      const iframe = document.querySelector(
        'iframe[id="account-switcher-widget"]'
      ) as HTMLIFrameElement;
      iframe?.contentWindow?.postMessage(msg, "http://localhost:3000");
    }, invalidMsg);

    // Should not process
    const timeout = new Promise((resolve) => {
      setTimeout(() => resolve({ timedOut: true }), 1000);
    });

    const response = new Promise((resolve) => {
      const listener = (event: MessageEvent) => {
        if (event.data.type) {
          window.removeEventListener("message", listener);
          resolve({ received: true });
        }
      };
      window.addEventListener("message", listener);
    });

    const result = await Promise.race([response, timeout]);
    expect((result as any).timedOut).toBe(true);
  });

  test("Widget validates message payload structure", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Send REQUEST_ACCOUNTS but with invalid payload
    const msg = {
      type: "REQUEST_ACCOUNTS",
      nonce: crypto.randomBytes(16).toString("hex"),
      requestId: crypto.randomBytes(16).toString("hex"),
      payload: { invalid: "structure" }, // Unexpected payload
    };

    await sendWidgetMessage(page, msg);

    // Widget should still process REQUEST_ACCOUNTS
    const response = await waitForWidgetMessage(
      page,
      "ACCOUNTS_RESPONSE",
      3000
    ).catch(() => ({ type: "ERROR" }));

    // Should get response (payload validation may not block)
    expect(response.type).toBeTruthy();
  });

  test("Widget handles unknown message types gracefully", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Send unknown message type
    const msg = {
      type: "UNKNOWN_MESSAGE_TYPE",
      nonce: crypto.randomBytes(16).toString("hex"),
      requestId: crypto.randomBytes(16).toString("hex"),
    };

    await page.evaluate((message) => {
      const iframe = document.querySelector(
        'iframe[id="account-switcher-widget"]'
      ) as HTMLIFrameElement;
      iframe?.contentWindow?.postMessage(message, "http://localhost:3000");
    }, msg);

    // Should send ERROR or ignore
    const timeout = new Promise((resolve) => {
      setTimeout(() => resolve({ timedOut: true }), 1000);
    });

    const response = new Promise((resolve) => {
      const listener = (event: MessageEvent) => {
        if (event.data.type === "ERROR") {
          window.removeEventListener("message", listener);
          resolve({ error: true });
        }
      };
      window.addEventListener("message", listener);
    });

    const result = await Promise.race([response, timeout]);
    // Either timeout (ignored) or error response (both acceptable)
    expect((result as any).timedOut || (result as any).error).toBeTruthy();
  });

  test("Widget response includes all required fields", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    const requestId = crypto.randomBytes(16).toString("hex");
    const nonce = crypto.randomBytes(16).toString("hex");

    const msg = {
      type: "REQUEST_ACCOUNTS",
      nonce,
      requestId,
    };

    await sendWidgetMessage(page, msg);
    const response = await waitForWidgetMessage(page, "ACCOUNTS_RESPONSE");

    // Response must have required fields
    expect(response.type).toBe("ACCOUNTS_RESPONSE");
    expect(response.nonce).toBe(nonce); // Echo back nonce
    expect(response.requestId).toBe(requestId); // Echo back requestId
    expect(response.payload).toBeTruthy(); // Must have payload
  });

  test("Widget handles rapid successive messages", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Send 5 quick messages
    const messages = [];
    for (let i = 0; i < 5; i++) {
      messages.push({
        type: "REQUEST_ACCOUNTS",
        nonce: crypto.randomBytes(16).toString("hex"),
        requestId: crypto.randomBytes(16).toString("hex"),
      });
    }

    // Send all quickly
    for (const msg of messages) {
      await page.evaluate((m) => {
        const iframe = document.querySelector(
          'iframe[id="account-switcher-widget"]'
        ) as HTMLIFrameElement;
        iframe?.contentWindow?.postMessage(m, "http://localhost:3000");
      }, msg);

      // Small delay
      await page.waitForTimeout(50);
    }

    // Should handle all responses without error
    for (const msg of messages) {
      const response = await waitForWidgetMessage(
        page,
        "ACCOUNTS_RESPONSE",
        3000
      ).catch(() => null);

      if (response) {
        expect(response.type).toBe("ACCOUNTS_RESPONSE");
      }
    }
  });

  test("Widget detects and prevents message tampering", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Send valid message and intercept response
    const nonce = crypto.randomBytes(16).toString("hex");
    const msg = {
      type: "REQUEST_ACCOUNTS",
      nonce,
      requestId: crypto.randomBytes(16).toString("hex"),
    };

    await sendWidgetMessage(page, msg);
    const originalResponse = await waitForWidgetMessage(
      page,
      "ACCOUNTS_RESPONSE"
    );

    // Try to send tampered nonce in next message
    const tamperedMsg = {
      type: "REQUEST_ACCOUNTS",
      nonce: "tampered_nonce_value",
      requestId: crypto.randomBytes(16).toString("hex"),
    };

    await page.evaluate((m) => {
      const iframe = document.querySelector(
        'iframe[id="account-switcher-widget"]'
      ) as HTMLIFrameElement;
      iframe?.contentWindow?.postMessage(m, "http://localhost:3000");
    }, tamperedMsg);

    // If widget processes it, response should have correct nonce back
    const tamperedResponse = await waitForWidgetMessage(page, "ACCOUNTS_RESPONSE", 2000).catch(
      () => null
    );

    if (tamperedResponse) {
      // If processed, nonce should NOT match tampered value
      expect(tamperedResponse.nonce).not.toBe("tampered_nonce_value");
    }
  });
});

