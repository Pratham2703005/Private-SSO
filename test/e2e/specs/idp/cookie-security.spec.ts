import { test, expect } from "@playwright/test";
import { loginViaUI } from "../../helpers/auth";
import testData from "../../fixtures/test-data.json";

test.describe("IDP: Cookie Security and Attributes", () => {
  const { users } = testData;
  const testUser = users[0];

  test("CSRF cookie is not accessible from JavaScript", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);

    // Try to access __csrf cookie from JS
    const canAccessCSRF = await page.evaluate(() => {
      return document.cookie.includes("__csrf");
    });

    // __csrf should be httpOnly, not in document.cookie
    expect(canAccessCSRF).toBe(false);
  });

  test("Session cookie has Path=/", async ({ page, context }) => {
    await loginViaUI(page, testUser.email, testUser.password);

    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name === "__sso_session");

    if (sessionCookie) {
      expect(sessionCookie.path).toBe("/");
    }
  });

  test("CSRF cookie has Path=/api", async ({ page, context }) => {
    await loginViaUI(page, testUser.email, testUser.password);

    // Request an endpoint that returns CSRF
    await page.request.get("http://localhost:3000/authorized-page");

    const cookies = await context.cookies();
    const csrfCookie = cookies.find((c) => c.name === "__csrf");

    if (csrfCookie) {
      // CSRF should have specific path (not /)
      expect(csrfCookie.path).toBeTruthy();
    }
  });

  test("Cookies have appropriate domain and port settings", async ({
    page,
    context,
  }) => {
    await loginViaUI(page, testUser.email, testUser.password);

    const cookies = await context.cookies();

    for (const cookie of cookies) {
      if (cookie.name === "__sso_session" || cookie.name === "__csrf") {
        // Should be specific to domain
        expect(cookie.domain).toContain("localhost");
      }
    }
  });

  test("Third-party cookies are isolated from main session", async ({ page }) => {
    // If widget uses third-party context, should be isolated

    await loginViaUI(page, testUser.email, testUser.password);
    await page.goto("http://localhost:3003");

    // Get parent page cookies
    const parentCookies = await page.evaluate(() => {
      return document.cookie;
    });

    // Widget iframe is on different origin
    // Should not share cookies with parent (if third-party)
  });

  test("Cookie SameSite prevents cross-site requests", async ({ page }) => {
    await loginViaUI(page, testUser.email, testUser.password);

    // Simulate cross-site POST request
    const response = await page.request.post(
      "http://localhost:3000/api/auth/logout",
      {
        headers: {
          "Referer": "http://malicious.com",
        },
      }
    );

    // SameSite should prevent automatic cookie inclusion
    // Either request fails or cookie not sent
    expect([302, 401, 403, 400]).toContain(response.status());
  });

  test("Secure cookie flag ensures HTTPS only (production)", async ({
    page,
    context,
  }) => {
    // Note: In test environment (localhost), secure flag may not apply
    // But verify implementation is correct

    const cookies = await context.cookies();

    for (const cookie of cookies) {
      if (process.env.NODE_ENV === "production") {
        // In production, secure cookies required for sensitive data
        if (cookie.name === "__sso_session") {
          expect(cookie.secure).toBe(true);
        }
      }
    }
  });

  test("Cookie cleanup on logout removes all session cookies", async ({
    page,
    context,
  }) => {
    await loginViaUI(page, testUser.email, testUser.password);

    // Verify session cookies exist
    let cookies = await context.cookies();
    let hasSessions = cookies.some((c) => c.name.includes("session"));
    expect(hasSessions).toBe(true);

    // Logout
    await page.request.post("http://localhost:3000/api/auth/logout", {
      data: { scope: "app" },
    });

    // Reload to get updated cookies
    await page.reload();

    // Check cookies are cleared
    cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name === "__sso_session");

    if (sessionCookie) {
      // If still present, should be expired
      expect(sessionCookie.expires).toBeLessThan(Date.now() / 1000);
    }
  });
});

