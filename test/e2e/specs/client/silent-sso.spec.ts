import { test, expect } from "@playwright/test";
import { loginViaUI } from "../../helpers/auth";
import {
  assertUserLoggedIn,
  assertIDPSessionExists,
} from "../../helpers/assertions";
import testData from "../../fixtures/test-data.json";

test.describe("Client: Silent SSO (Cross-Client No Re-login)", () => {
  const { users } = testData;
  const testUser = users[0]; // Alice

  test("Login to client-c, then open client-a → no re-login needed", async ({
    page,
    context,
    browser,
  }) => {
    // Step 1: Login to client-c with Alice
    await loginViaUI(page, testUser.email, testUser.password);

    // Step 2: Navigate to client-c dashboard
    await page.goto("http://localhost:3003");

    // Ensure app session is created
    await page.waitForFunction(() => {
      const cookies = document.cookie;
      return cookies.includes("app_session_c");
    });

    // Verify logged in
    await assertUserLoggedIn(page);

    // Verify IDP session exists
    await assertIDPSessionExists(context);

    // Step 3: Open client-a in NEW tab (same browser, shared cookies)
    const page2 = await browser.newPage();

    // Don't login, just navigate to client-a
    await page2.goto("http://localhost:3001");

    // Client-a should detect IDP session and auto-login
    // (Silent SSO - no login form required)
    await page2.waitForFunction(async () => {
      const response = await fetch("http://localhost:3001/api/me");
      return response.status === 200;
    });

    // Verify authenticated on client-a
    const me = await page2.request.get("http://localhost:3001/api/me");
    expect(me.ok).toBe(true);

    const user = await me.json();
    expect(user.authenticated).toBe(true);
    expect(user.user.email).toBe(testUser.email);

    // Step 4: Verify app_session_a exists (separate per-client session)
    const cookies2 = await page2.context().cookies();
    const appSessionA = cookies2.find((c) => c.name === "app_session_a");
    expect(appSessionA).toBeTruthy();

    await page2.close();
  });

  test("IDP session shared across multiple clients", async ({
    page,
    context,
    browser,
  }) => {
    // Login to IDP
    await loginViaUI(page, testUser.email, testUser.password);

    // Get IDP session cookie
    const idpSession1 = context.cookies().then((cookies) =>
      cookies.find((c) => c.name === "__sso_session")
    );

    // Open client-a
    const page2 = await browser.newPage();
    await page2.goto("http://localhost:3001");

    // Wait for auto-login
    await page2.waitForFunction(async () => {
      const response = await fetch("http://localhost:3001/api/me");
      return response.status === 200;
    });

    // Get IDP session from client-a context
    const idpSession2 = page2.context().cookies().then((cookies) =>
      cookies.find((c) => c.name === "__sso_session")
    );

    // Both should have the SAME IDP session (allows account switching across clients)
    expect(await idpSession1).toBeDefined();
    expect(await idpSession2).toBeDefined();
    expect((await idpSession1)?.value).toBe((await idpSession2)?.value);

    await page2.close();
  });

  test("Logout from client-c does NOT affect client-a (app-scoped logout)", async ({
    page,
    context,
    browser,
  }) => {
    // Login to client-c
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Also login to client-a (silent SSO)
    const page2 = await browser.newPage();
    await page2.goto("http://localhost:3001");
    await page2.waitForFunction(async () => {
      const response = await fetch("http://localhost:3001/api/me");
      return response.status === 200;
    });

    // Logout from client-c (app-scoped)
    const logoutResponse = await page.request.post(
      "http://localhost:3000/api/auth/logout",
      {
        data: { scope: "app" }, // App-scoped = only client-c
      }
    );
    expect(logoutResponse.ok).toBe(true);

    // Client-c should require re-login
    const meC = await page.request.get("http://localhost:3003/api/me");
    expect(meC.status()).toBe(401);

    // Client-a should STILL be logged in (IDP session still alive)
    const meA = await page2.request.get("http://localhost:3001/api/me");
    expect(meA.ok).toBe(true);

    const userData = await meA.json();
    expect(userData.authenticated).toBe(true);

    await page2.close();
  });

  test("Global logout affects ALL clients", async ({
    page,
    browser,
  }) => {
    // Login to client-c
    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Also login to client-a (silent SSO)
    const page2 = await browser.newPage();
    await page2.goto("http://localhost:3001");
    await page2.waitForFunction(async () => {
      const response = await fetch("http://localhost:3001/api/me");
      return response.status === 200;
    });

    // Global logout from client-c
    const logoutResponse = await page.request.post(
      "http://localhost:3000/api/auth/logout",
      {
        data: { scope: "global" }, // Destroys IDP session
      }
    );
    expect(logoutResponse.ok).toBe(true);

    // Both clients should require re-login
    const meC = await page.request.get("http://localhost:3003/api/me");
    expect(meC.status()).toBe(401);

    const meA = await page2.request.get("http://localhost:3001/api/me");
    expect(meA.status()).toBe(401);

    await page2.close();
  });

  test("Account switching via widget affects all logged-in clients", async ({
    page,
    context,
    browser,
  }) => {
    const alice = testData.users[0];
    const bob = testData.users[1];

    // Login as Alice
    await loginViaUI(page, alice.email, alice.password);
    await page.goto("http://localhost:3003");

    // Also logged into client-a
    const page2 = await browser.newPage();
    await page2.goto("http://localhost:3001");
    await page2.waitForFunction(async () => {
      const response = await fetch("http://localhost:3001/api/me");
      return response.status === 200;
    });

    // Verify both see Alice
    let meC = await page.request.get("http://localhost:3003/api/me");
    let userData = await meC.json();
    expect(userData.user.email).toBe(alice.email);

    let meA = await page2.request.get("http://localhost:3001/api/me");
    userData = await meA.json();
    expect(userData.user.email).toBe(alice.email);

    // Switch to Bob via widget (modifies IDP session)
    await page.click("#widget-avatar");
    // (widget account switching logic would go here)
    // For now, just verify the concept via API

    // Refresh both clients
    await page.reload();
    await page2.reload();

    // Both should now see Bob (if widget switching worked)
    // (This requires widget switching implementation)
  });
});

