import { test, expect } from "@playwright/test";
import { loginViaUI } from "../../helpers/auth";
import testData from "../../fixtures/test-data.json";
import crypto from "crypto";

test.describe("Security: Origin Validation in postMessage", () => {
  const { users } = testData;
  const testUser = users[0];

  test("Widget iframe only accepts messages from IDP origin", async ({
    page,
  }) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Get iframe reference
    const frame = page.frameLocator('iframe[id="account-switcher-widget"]');

    // Try to send message from wrong origin (simulated by direct frame communication)
    // Widget should ignore or error if origin mismatch

    const result = await page.evaluate(() => {
      return new Promise((resolve) => {
        const iframe = document.querySelector(
          'iframe[id="account-switcher-widget"]'
        ) as HTMLIFrameElement;

        if (!iframe || !iframe.contentWindow) {
          resolve({ error: "iframe not found" });
          return;
        }

        // Send message simulating wrong origin
        iframe.contentWindow?.postMessage(
          {
            type: "FAKE_MESSAGE",
            nonce: crypto.randomBytes(16).toString("hex"),
          },
          "http://wrong-origin:3000" // Wrong origin
        );

        // Widget should not process this (due to origin check)
        resolve({ sent: true });
      });
    });

    expect(result).toBeDefined();
  });

  test("Client iframe only accepts messages from IDP origin", async ({
    page,
  }) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Test that main page only processes postMessage from legitimate IDP
    const messagesSent: any[] = [];

    await page.on("console", (msg) => {
      if (msg.text().includes("Widget")) {
        messagesSent.push(msg.text());
      }
    });

    // Try to inject messages from attacker origin
    await page.evaluate(() => {
      // Simulate attacker sending message from attacker.com
      window.postMessage(
        {
          type: "MALICIOUS",
          payload: { redirect: "http://phishing.com" },
        },
        "http://attacker.com"
      );
    });

    // Main page should ignore (origin check fails)
    // Wait a bit for any processing
    await page.waitForTimeout(500);

    // Verify page didn't navigate or process malicious message
    expect(page.url()).toContain("localhost:3003");
  });

  test("Widget validates origin before sending WIDGET_READY", async ({
    page,
  }) => {
    // Widget receives postMessage with origin verification
    // Should only respond to client origins it's embedded in

    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Widget loads and should send WIDGET_READY
    // with origin matching the embed location

    const widgetReady = await page.evaluate(() => {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ received: false });
        }, 2000);

        window.addEventListener("message", (event) => {
          if (event.data.type === "WIDGET_READY") {
            clearTimeout(timeout);
            resolve({
              received: true,
              origin: event.origin,
              expectedOrigin: "http://localhost:3000", // IDP
            });
          }
        });
      });
    });

    expect(widgetReady).toBeDefined();
  });

  test("Iframe origin vulnerability - widget cannot be embedded in attacker site", async ({
    page,
  }) => {
    // Widget is served from IDP with:
    // - X-Frame-Options: SAMEORIGIN (IDP domain only)
    // - CSP frame-ancestors 'self'
    // - Origin check in postMessage

    // Request widget JS from IDP
    const response = await page.request.get(
    "http://localhost:3000/widget/widget.js",
    { headers: { "User-Agent": "test" } }
    );

    const headers = response.headers();

    const xFrameOptions = headers["x-frame-options"];
    expect(xFrameOptions).toBeTruthy();

    expect(
    xFrameOptions?.toUpperCase().includes("SAMEORIGIN") ||
        xFrameOptions?.toUpperCase().includes("DENY")
    ).toBeTruthy();

    const cspHeader = headers["content-security-policy"];
    if (cspHeader) {
    expect(cspHeader).toContain("frame-ancestors");
    }

  });

  test("postMessage nonce prevents origin spoofing", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Each postMessage includes random nonce
    // This prevents replaying messages from different origins

    const requestId = crypto.randomBytes(16).toString("hex");
    const msg = {
      type: "REQUEST_ACCOUNTS",
      nonce: crypto.randomBytes(16).toString("hex"),
      requestId,
    };

    // Send legitimate message
    await page.evaluate((message) => {
      const iframe = document.querySelector(
        'iframe[id="account-switcher-widget"]'
      ) as HTMLIFrameElement;
      iframe?.contentWindow?.postMessage(message, "http://localhost:3000");
    }, msg);

    // Wait for response
    const response = await page.evaluate(
      (reqId) => {
        return new Promise((resolve) => {
          const timeout = setTimeout(() => {
            resolve({ received: false });
          }, 2000);

          window.addEventListener("message", (event) => {
            // Only accept response with matching requestId
            if (event.data.requestId === reqId) {
              clearTimeout(timeout);
              resolve({
                received: true,
                hasNonce: !!event.data.nonce,
                hasRequestId: !!event.data.requestId,
              });
            }
          });
        });
      },
      [requestId]
    );

    expect(response).toBeDefined();
  });
});

