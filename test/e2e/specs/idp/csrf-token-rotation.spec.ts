import { test, expect } from "@playwright/test";
import { loginViaUI, getCSRFCookieValue } from "../../helpers/auth";
import {
  assertCSRFTokenExists,
  assertCSRFTokenRotated,
  assertStaleCSRFFails,
} from "../../helpers/assertions";
import testData from "../../fixtures/test-data.json";

test.describe("IDP: CSRF Token Rotation", () => {
  const { users } = testData;
  const testUser = users[0]; // Alice

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await loginViaUI(page, testUser.email, testUser.password);
  });

  test("GET /authorize returns __csrf cookie", async ({ page }) => {
    // Navigate to OAuth authorize endpoint
    await page.goto(
      "http://localhost:3000/api/auth/authorize?" +
        "client_id=client-c&" +
        "response_type=code&" +
        "redirect_uri=http://localhost:3003/callback&" +
        "state=test-state-123&" +
        "code_challenge=test-challenge"
    );

    // Check that __csrf cookie exists
    const csrfToken = await assertCSRFTokenExists(page);
    expect(csrfToken).toHaveLength(32); // SHA256 hex = 32 chars
  });

  test("POST /api/auth/session/validate returns new __csrf in Set-Cookie", async ({
    page,
    context,
    request,
  }) => {
    // Get initial CSRF token
    const csrfBefore = await assertCSRFTokenExists(page);

    // Get auth cookie
    const cookies = await context.cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    // Call validate endpoint
    const response = await request.post(
      "http://localhost:3000/api/auth/session/validate",
      {
        headers: { Cookie: cookieHeader },
        data: { _csrf: csrfBefore },
      }
    );

    expect(response.ok).toBe(true);

    // Get response headers to check for Set-Cookie with new CSRF
    const setCookieHeader = response.headers()["set-cookie"] || "";
    expect(setCookieHeader).toContain("__csrf");

    // The new token should be different from the old one
    const csrfAfter = await assertCSRFTokenExists(page);
    expect(csrfAfter).not.toBe(csrfBefore);
  });

  test("Widget must re-read CSRF cookie after each validate call", async ({
    page,
    context,
  }) => {
    // Simulate widget behavior: read, validate, read again

    // Step 1: Read initial CSRF
    const csrf1 = await assertCSRFTokenExists(page);

    // Step 2: Make validation call
    const cookies = await context.cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const response1 = await page.request.post(
      "http://localhost:3000/api/auth/session/validate",
      {
        headers: { Cookie: cookieHeader },
        data: { _csrf: csrf1 },
      }
    );
    expect(response1.ok).toBe(true);

    // Step 3: Read CSRF again (should be new token)
    const csrf2 = await assertCSRFTokenRotated(page, csrf1);

    // Step 4: Make another validation call with new token
    const cookies2 = await context.cookies();
    const cookieHeader2 = cookies2.map((c) => `${c.name}=${c.value}`).join("; ");

    const response2 = await page.request.post(
      "http://localhost:3000/api/auth/session/validate",
      {
        headers: { Cookie: cookieHeader2 },
        data: { _csrf: csrf2 },
      }
    );
    expect(response2.ok).toBe(true);

    // Step 5: Read CSRF again (should be different from csrf2)
    const csrf3 = await assertCSRFTokenRotated(page, csrf2);
    expect(csrf3).not.toBe(csrf1);
    expect(csrf3).not.toBe(csrf2);
  });

  test("Stale CSRF token is rejected with 403", async ({
    page,
    context,
  }) => {
    // Get and save initial CSRF
    const staleCSRF = await assertCSRFTokenExists(page);

    // Make first validation call (rotates token)
    const cookies = await context.cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const response1 = await page.request.post(
      "http://localhost:3000/api/auth/session/validate",
      {
        headers: { Cookie: cookieHeader },
        data: { _csrf: staleCSRF },
      }
    );
    expect(response1.ok).toBe(true);

    // Get fresh cookies (includes rotated CSRF)
    const freshCookies = await context.cookies();
    const freshCookieHeader = freshCookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    // Try to use OLD stale CSRF token
    const response2 = await page.request.post(
      "http://localhost:3000/api/auth/session/validate",
      {
        headers: { Cookie: freshCookieHeader },
        data: { _csrf: staleCSRF }, // Using OLD token with NEW cookies
      }
    );

    // Should be rejected (403 Forbidden)
    expect(response2.status()).toBe(403);
  });

  test("Switching account also rotates CSRF token", async ({
    page,
    context,
  }) => {
    // Get initial CSRF
    const csrfBefore = await assertCSRFTokenExists(page);

    const cookies = await context.cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    // Call switch-account API
    const response = await page.request.post(
      "http://localhost:3000/api/auth/switch-account",
      {
        headers: { Cookie: cookieHeader },
        data: {
          accountId: testData.users[1].accountId, // Switch to Bob
          _csrf: csrfBefore,
        },
      }
    );

    expect(response.ok).toBe(true);

    // CSRF should be rotated
    const csrfAfter = await assertCSRFTokenRotated(page, csrfBefore);
    expect(csrfAfter).not.toBe(csrfBefore);
  });

  test("Missing CSRF token in request fails", async ({ page, context }) => {
    const cookies = await context.cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    // Call validate WITHOUT _csrf in body
    const response = await page.request.post(
      "http://localhost:3000/api/auth/session/validate",
      {
        headers: { Cookie: cookieHeader },
        data: {}, // No _csrf field
      }
    );

    // Should be rejected
    expect(response.status()).toBe(403);
  });
});

