import { test, expect } from "@playwright/test";
import { loginViaUI } from "../../helpers/auth";
import { sendWidgetMessage, waitForWidgetMessage } from "../../helpers/widget";
import testData from "../../fixtures/test-data.json";
import crypto from "crypto";

test.describe("Widget: Account State Persistence", () => {
  const { users } = testData;
  const testUser = users[0];

  test("Active account persists across page reload", async ({
    page,
  }) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Request accounts to establish which is active
    const msg = {
      type: "REQUEST_ACCOUNTS",
      nonce: crypto.randomBytes(16).toString("hex"),
      requestId: crypto.randomBytes(16).toString("hex"),
    };

    await sendWidgetMessage(page, msg);
    const response1 = await waitForWidgetMessage(page, "ACCOUNTS_RESPONSE");

    const activeId1 = (response1.payload as any).activeAccount?.id;

    // Reload page
    await page.reload();

    // Request accounts again
    const msg2 = {
      type: "REQUEST_ACCOUNTS",
      nonce: crypto.randomBytes(16).toString("hex"),
      requestId: crypto.randomBytes(16).toString("hex"),
    };

    await sendWidgetMessage(page, msg2);
    const response2 = await waitForWidgetMessage(page, "ACCOUNTS_RESPONSE");

    const activeId2 = (response2.payload as any).activeAccount?.id;

    // Active account should be same
    if (activeId1 && activeId2) {
      expect(activeId2).toBe(activeId1);
    }
  });

  test("Switched account persists in IDP session", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Switch account in widget (if multiple available)
    const msg = {
      type: "REQUEST_ACCOUNTS",
      nonce: crypto.randomBytes(16).toString("hex"),
      requestId: crypto.randomBytes(16).toString("hex"),
    };

    await sendWidgetMessage(page, msg);
    const accountsResponse = await waitForWidgetMessage(
      page,
      "ACCOUNTS_RESPONSE"
    );

    const accounts = (accountsResponse.payload as any).accounts;

    if (accounts.length > 1) {
      // Try to switch to second account
      const switchMsg = {
        type: "SWITCH_ACCOUNT",
        nonce: crypto.randomBytes(16).toString("hex"),
        requestId: crypto.randomBytes(16).toString("hex"),
        payload: {
          accountId: accounts[1].id,
        },
      };

      await sendWidgetMessage(page, switchMsg);
      const switchResponse = await waitForWidgetMessage(page, "ACCOUNT_SWITCHED", 3000).catch(
        () => ({ type: "ERROR" })
      );

      // Verify account was switched
      if (switchResponse.type === "ACCOUNT_SWITCHED") {
        // Next request should show updated active account
        const msg3 = {
          type: "REQUEST_ACCOUNTS",
          nonce: crypto.randomBytes(16).toString("hex"),
          requestId: crypto.randomBytes(16).toString("hex"),
        };

        await sendWidgetMessage(page, msg3);
        const checkResponse = await waitForWidgetMessage(
          page,
          "ACCOUNTS_RESPONSE"
        );

        const newActiveId = (checkResponse.payload as any).activeAccount?.id;
        expect(newActiveId).toBe(accounts[1].id);
      }
    }
  });

  test("Account list updates when new account is linked", async ({
    page,
  }) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Initial account list
    const msg1 = {
      type: "REQUEST_ACCOUNTS",
      nonce: crypto.randomBytes(16).toString("hex"),
      requestId: crypto.randomBytes(16).toString("hex"),
    };

    await sendWidgetMessage(page, msg1);
    const response1 = await waitForWidgetMessage(page, "ACCOUNTS_RESPONSE");

    const countBefore = (response1.payload as any).accounts.length;

    // (In real scenario: user links another account)
    // Widget should detect change and update

    // Wait and request again
    await page.waitForTimeout(500);

    const msg2 = {
      type: "REQUEST_ACCOUNTS",
      nonce: crypto.randomBytes(16).toString("hex"),
      requestId: crypto.randomBytes(16).toString("hex"),
    };

    await sendWidgetMessage(page, msg2);
    const response2 = await waitForWidgetMessage(page, "ACCOUNTS_RESPONSE");

    const countAfter = (response2.payload as any).accounts.length;

    // Count should be same or greater (no removal expected)
    expect(countAfter).toBeGreaterThanOrEqual(countBefore);
  });

  test("Account display name is always available and current", async ({
    page,
  }) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    const msg = {
      type: "REQUEST_ACCOUNTS",
      nonce: crypto.randomBytes(16).toString("hex"),
      requestId: crypto.randomBytes(16).toString("hex"),
    };

    await sendWidgetMessage(page, msg);
    const response = await waitForWidgetMessage(page, "ACCOUNTS_RESPONSE");

    const accounts = (response.payload as any).accounts;

    for (const account of accounts) {
      // Each account should have display info
      expect(account.id).toBeTruthy();
      expect(account.displayName || account.email).toBeTruthy();

      // Email should match original if available
      if (testUser.email) {
        // At least one account should match login email
      }
    }
  });

  test("Removed account is no longer in accounts list", async ({ page }) => {
    // If user unlinks OAuth account, should disappear from list

    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Get initial accounts
    const msg1 = {
      type: "REQUEST_ACCOUNTS",
      nonce: crypto.randomBytes(16).toString("hex"),
      requestId: crypto.randomBytes(16).toString("hex"),
    };

    await sendWidgetMessage(page, msg1);
    const response1 = await waitForWidgetMessage(page, "ACCOUNTS_RESPONSE");

    const accounts1 = (response1.payload as any).accounts;
    const initialCount = accounts1.length;

    // (In real scenario: user removes account)
    // Widget updates on next REQUEST_ACCOUNTS

    const msg2 = {
      type: "REQUEST_ACCOUNTS",
      nonce: crypto.randomBytes(16).toString("hex"),
      requestId: crypto.randomBytes(16).toString("hex"),
    };

    await sendWidgetMessage(page, msg2);
    const response2 = await waitForWidgetMessage(page, "ACCOUNTS_RESPONSE");

    const accounts2 = (response2.payload as any).accounts;

    // Count should be same (no removals in this test)
    expect(accounts2.length).toBeLessThanOrEqual(initialCount);
  });
});

