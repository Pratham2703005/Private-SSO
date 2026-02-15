import { test, expect } from "@playwright/test";
import { loginViaUI } from "../../helpers/auth";
import testData from "../../fixtures/test-data.json";

test.describe("IDP: Account Management and Linking", () => {
  const { users } = testData;
  const alice = users[0];
  const bob = users[1];

  test("User can view all linked accounts", async ({ page }) => {
    await loginViaUI(page, alice.email, alice.password);

    // Get account list
    const response = await page.request.get(
      "http://localhost:3000/api/auth/accounts"
    );

    expect(response.status()).toBe(200);

    const accounts = await response.json();
    expect(Array.isArray(accounts)).toBe(true);

    if (accounts.length > 0) {
      // Each account should have required fields
      for (const account of accounts) {
        expect(account.id).toBeTruthy();
        expect(account.provider || account.email).toBeTruthy();
      }
    }
  });

  test("Primary account cannot be unlinked if only account", async ({
    page,
  }) => {
    await loginViaUI(page, alice.email, alice.password);

    // Get accounts
    const listResponse = await page.request.get(
      "http://localhost:3000/api/auth/accounts"
    );

    const accounts = await listResponse.json();

    if (accounts.length === 1) {
      // Try to unlink the only account
      const unlinkResponse = await page.request.post(
        "http://localhost:3000/api/auth/unlink-account",
        {
          data: {
            accountId: accounts[0].id,
          },
        }
      );

      // Should be rejected
      expect([400, 403]).toContain(unlinkResponse.status());
    }
  });

  test("Account metadata is consistent across requests", async ({ page }) => {
    await loginViaUI(page, alice.email, alice.password);

    // Request 1
    const response1 = await page.request.get(
      "http://localhost:3000/api/auth/accounts"
    );
    const accounts1 = await response1.json();

    // Request 2
    const response2 = await page.request.get(
      "http://localhost:3000/api/auth/accounts"
    );
    const accounts2 = await response2.json();

    // Should be identical
    expect(accounts2.length).toBe(accounts1.length);

    if (accounts1.length > 0) {
      expect(accounts2[0].id).toBe(accounts1[0].id);
    }
  });

  test("Account switching endpoint validates accountId", async ({ page }) => {
    await loginViaUI(page, alice.email, alice.password);

    // Try to switch to non-existent account
    const response = await page.request.post(
      "http://localhost:3000/api/auth/switch-account",
      {
        data: {
          accountId: "non-existent-id",
        },
      }
    );

    // Should fail
    expect([400, 404]).toContain(response.status());
  });

  test("Account linking requires OAuth provider authentication", async ({
    page,
  }) => {
    await loginViaUI(page, alice.email, alice.password);

    // Try to manually link account without OAuth flow
    const response = await page.request.post(
      "http://localhost:3000/api/auth/link-account",
      {
        data: {
          provider: "google",
          providerId: "fake_google_id",
        },
      }
    );

    // Should fail - requires OAuth verification
    expect([400, 403, 401]).toContain(response.status());
  });

  test("User cannot link account that belongs to another user", async ({
    page,
    context,
  }) => {
    // Scenario: Bob tries to claim Alice's account

    // Login as Bob
    await loginViaUI(page, bob.email, bob.password);

    // Try to add Alice's email as account
    const response = await page.request.post(
      "http://localhost:3000/api/auth/link-account",
      {
        data: {
          email: alice.email, // Alice's email
        },
      }
    );

    // Should fail - email already associated with Alice
    expect([400, 403, 409]).toContain(response.status());
  });

  test("Active account is tracked in session", async ({ page }) => {
    await loginViaUI(page, alice.email, alice.password);

    // Get session info
    const response = await page.request.get(
      "http://localhost:3000/api/auth/session/validate"
    );

    expect(response.status()).toBe(200);

    const session = await response.json();

    // Should have active account reference
    expect(session.account || session.activeAccount).toBeTruthy();

    const activeAccount = session.account || session.activeAccount;
    if (activeAccount) {
      expect(activeAccount.id).toBeTruthy();
    }
  });
});

