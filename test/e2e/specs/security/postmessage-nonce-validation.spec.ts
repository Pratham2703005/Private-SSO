import { test, expect } from "@playwright/test";
import { loginViaUI } from "../../helpers/auth";
import { sendWidgetMessage, waitForWidgetMessage } from "../../helpers/widget";
import testData from "../../fixtures/test-data.json";
import crypto from "crypto";

test.describe("Security: postMessage Nonce Validation (Replay Attack Prevention)", () => {
  const { users } = testData;
  const testUser = users[0];

  test("Widget rejects messages without nonce", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Send message WITHOUT nonce
    const invalidMsg = {
      type: "REQUEST_ACCOUNTS",
      requestId: crypto.randomBytes(16).toString("hex"),
      // Missing nonce
    };

    await page.evaluate((msg) => {
      const iframe = document.querySelector(
        'iframe[id="account-switcher-widget"]'
      ) as HTMLIFrameElement;
      iframe?.contentWindow?.postMessage(msg, "http://localhost:3000");
    }, invalidMsg);

    // Widget should either ignore or send error
    // Wait to verify no ACCOUNTS_RESPONSE comes
    const timeout = new Promise((resolve) => {
      setTimeout(() => resolve({ timedOut: true }), 1000);
    });

    const response = new Promise((resolve) => {
      const listener = (event: MessageEvent) => {
        if (event.data.type === "ACCOUNTS_RESPONSE") {
          window.removeEventListener("message", listener);
          resolve({ received: true });
        }
      };
      window.addEventListener("message", listener);
    });

    const result = await Promise.race([response, timeout]);
    // Should NOT receive response without nonce
    expect((result as any).timedOut).toBe(true);
  });

  test("Widget rejects messages with invalid nonce format", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Send with non-hex nonce
    const invalidMsg = {
      type: "REQUEST_ACCOUNTS",
      nonce: "not-hex-format!!!",
      requestId: crypto.randomBytes(16).toString("hex"),
    };

    await page.evaluate((msg) => {
      const iframe = document.querySelector(
        'iframe[id="account-switcher-widget"]'
      ) as HTMLIFrameElement;
      iframe?.contentWindow?.postMessage(msg, "http://localhost:3000");
    }, invalidMsg);

    // Should timeout (no response)
    const timeout = new Promise((resolve) => {
      setTimeout(() => resolve({ timedOut: true }), 1000);
    });

    const response = new Promise((resolve) => {
      const listener = (event: MessageEvent) => {
        if (event.data.type === "ACCOUNTS_RESPONSE") {
          window.removeEventListener("message", listener);
          resolve({ received: true });
        }
      };
      window.addEventListener("message", listener);
    });

    const result = await Promise.race([response, timeout]);
    expect((result as any).timedOut).toBe(true);
  });

  test("Widget rejects replayed messages with old nonce", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    const nonce1 = crypto.randomBytes(16).toString("hex");
    const requestId1 = crypto.randomBytes(16).toString("hex");

    // Send first valid message
    const msg1 = {
      type: "REQUEST_ACCOUNTS",
      nonce: nonce1,
      requestId: requestId1,
    };

    await sendWidgetMessage(page, msg1);
    const response1 = await waitForWidgetMessage(page, "ACCOUNTS_RESPONSE");
    expect(response1.nonce).toBe(nonce1);

    // Attacker tries to replay same message with same nonce
    // Send exact same message again
    await sendWidgetMessage(page, msg1);

    // Widget should reject (nonce already used)
    const timeout = new Promise((resolve) => {
      setTimeout(() => resolve({ timedOut: true }), 1000);
    });

    const delayedResponse = new Promise((resolve) => {
      const listener = (event: MessageEvent) => {
        if (event.data.type === "ACCOUNTS_RESPONSE" && event.data.nonce === nonce1) {
          window.removeEventListener("message", listener);
          resolve({ received: true });
        }
      };
      window.addEventListener("message", listener);
    });

    const result = await Promise.race([delayedResponse, timeout]);

    // Widget should NOT respond to replayed nonce
    // (Either timeout or send ERROR)
    expect((result as any).timedOut || (result as any).error).toBeTruthy();
  });

  test("Widget accepts messages with unique nonces", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Send 3 different messages with different nonces
    const nonces = [];
    for (let i = 0; i < 3; i++) {
      const nonce = crypto.randomBytes(16).toString("hex");
      nonces.push(nonce);

      const msg = {
        type: "REQUEST_ACCOUNTS",
        nonce,
        requestId: crypto.randomBytes(16).toString("hex"),
      };

      await sendWidgetMessage(page, msg);
      const response = await waitForWidgetMessage(
        page,
        "ACCOUNTS_RESPONSE",
        3000
      );

      // Should accept each unique nonce
      expect(response.nonce).toBe(nonce);
    }

    // All 3 should have succeeded
    expect(nonces.length).toBe(3);
  });

  test("Nonce format must be 32-character hex (16 bytes)", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Test various invalid nonce formats
    const invalidNonces = [
      "short", // Too short
      "0123456789abcdef0123456789abcdefg", // Invalid char 'g'
      "0123456789ABCDEF0123456789ABCDEF", // Valid format, uppercase OK
      "", // Empty
    ];

    for (const nonce of invalidNonces) {
      const msg = {
        type: "REQUEST_ACCOUNTS",
        nonce,
        requestId: crypto.randomBytes(16).toString("hex"),
      };

      await page.evaluate((message) => {
        const iframe = document.querySelector(
          'iframe[id="account-switcher-widget"]'
        ) as HTMLIFrameElement;
        iframe?.contentWindow?.postMessage(message, "http://localhost:3000");
      }, msg);

      const timeout = new Promise((resolve) => {
        setTimeout(() => resolve({ invalid: true }), 500);
      });

      const response = new Promise((resolve) => {
        const listener = (event: MessageEvent) => {
          if (event.data.type === "ACCOUNTS_RESPONSE" || event.data.type === "ERROR") {
            window.removeEventListener("message", listener);
            resolve({ received: true });
          }
        };
        window.addEventListener("message", listener);
      });

      const result = await Promise.race([response, timeout]);

      // Invalid nonces should not get valid response
      if (!nonce.match(/^[0-9a-fA-F]{32}$/)) {
        expect((result as any).invalid || (result as any).error).toBeTruthy();
      }
    }
  });

  test("requestId must be present and unique per request", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Message without requestId
    const msgNoRequestId = {
      type: "REQUEST_ACCOUNTS",
      nonce: crypto.randomBytes(16).toString("hex"),
      // Missing requestId
    };

    await page.evaluate((msg) => {
      const iframe = document.querySelector(
        'iframe[id="account-switcher-widget"]'
      ) as HTMLIFrameElement;
      iframe?.contentWindow?.postMessage(msg, "http://localhost:3000");
    }, msgNoRequestId);

    // Should not get valid response
    const timeout = new Promise((resolve) => {
      setTimeout(() => resolve({ timedOut: true }), 1000);
    });

    const response = new Promise((resolve) => {
      const listener = (event: MessageEvent) => {
        if (event.data.type === "ACCOUNTS_RESPONSE") {
          window.removeEventListener("message", listener);
          resolve({ received: true });
        }
      };
      window.addEventListener("message", listener);
    });

    const result = await Promise.race([response, timeout]);
    expect((result as any).timedOut).toBe(true);
  });
});

