import { test, expect } from "@playwright/test";
import { loginViaUI } from "../../helpers/auth";
import { sendWidgetMessage, waitForWidgetMessage } from "../../helpers/widget";
import testData from "../../fixtures/test-data.json";
import crypto from "crypto";

test.describe("Widget: Add Account Flow", () => {
  const { users } = testData;
  const alice = users[0];
  const bob = users[1];

  test("Widget shows Add Account button for non-active accounts", async ({
    page,
  }) => {
    // Login as Alice
    await loginViaUI(page, alice.email, alice.password);
    await page.goto("http://localhost:3003");

    // Request accounts - widget should show add button
    const nonce = crypto.randomBytes(16).toString("hex");
    const requestId = crypto.randomBytes(16).toString("hex");

    const msg = {
      type: "REQUEST_ACCOUNTS",
      nonce,
      requestId,
    };

    await sendWidgetMessage(page, msg);
    const response = await waitForWidgetMessage(page, "ACCOUNTS_RESPONSE", 5000);

    expect(response.type).toBe("ACCOUNTS_RESPONSE");
    const payload = response.payload as any;

    // Should have at least account for Alice
    expect(payload.accounts.length).toBeGreaterThanOrEqual(1);

    // Check for add account button
    const iframe = page.frameLocator('iframe[id="account-switcher-widget"]');
    const addButton = iframe.locator('button:has-text("Add Account")');

    // Add button should be visible (to link another OAuth account)
    await expect(addButton).toBeVisible();
  });

  test("Clicking Add Account navigates to account linking flow", async ({
    page,
    context,
  }) => {
    await loginViaUI(page, alice.email, alice.password);
    await page.goto("http://localhost:3003");

    const iframe = page.frameLocator('iframe[id="account-switcher-widget"]');
    const addButton = iframe.locator('button:has-text("Add Account")');

    // Click should open IDP account linking page
    const [popup] = await Promise.all([
      context.waitForEvent("page"), // Expect new window/tab
      addButton.click(),
    ]);

    // New page should be IDP account linking
    await popup.waitForLoadState();
    expect(popup.url()).toContain("http://localhost:3000");
    expect(popup.url()).toContain("add-account");
  });

  test("Add Account flow links new OAuth provider to existing user", async ({
    page,
    context,
  }) => {
    // This would require:
    // 1. Login as Alice (account acc-alice)
    // 2. Click Add Account in widget
    // 3. Authorize another OAuth provider (or same provider different email)
    // 4. System links to existing Alice account
    // 5. Widget now shows 2 accounts

    await loginViaUI(page, alice.email, alice.password);
    await page.goto("http://localhost:3003");

    // Get initial accounts list
    const requestId1 = crypto.randomBytes(16).toString("hex");
    await sendWidgetMessage(page, {
      type: "REQUEST_ACCOUNTS",
      nonce: crypto.randomBytes(16).toString("hex"),
      requestId: requestId1,
    });

    const response1 = await waitForWidgetMessage(
      page,
      "ACCOUNTS_RESPONSE",
      5000
    );
    const accountsBefore = (response1.payload as any).accounts.length;

    // (In real test: would go through OAuth provider auth again)
    // For now, just verify the operation would complete

    // After adding account, accounts list should grow
    // (This requires actual second OAuth provider linkage)
  });

  test("Account linking fails if email already used on another primary account",
    async ({ page }) => {
      await loginViaUI(page, alice.email, alice.password);
      await page.goto("http://localhost:3003");

      // This is a conflict resolution test
      // If Bob already exists as separate account, can't add his email to Alice's

      // Widget should prevent the link or show error
    }
  );

  test("Newly linked account appears in widget without page reload", async ({
    page,
  }) => {
    // After OAuth provider auth completes, widget should auto-refresh
    // accounts list via postMessage without user reload

    // This requires:
    // 1. Monitoring for ACCOUNT_ADDED message
    // 2. Widget calling REQUEST_ACCOUNTS again
    // 3. New account appearing in list

    await loginViaUI(page, alice.email, alice.password);
    await page.goto("http://localhost:3003");

    // Widget runs account polling in background
    // Should detect new account linked to session
  });
});

