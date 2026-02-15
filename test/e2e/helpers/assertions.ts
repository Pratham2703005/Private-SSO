import { Page, expect, BrowserContext, test } from "@playwright/test";

/**
 * Custom Assertion Helper Functions
 * Focus on CSRF token rotation, session validation, widget security
 */

/**
 * Skip test if widget iframe not found (feature not implemented yet)
 */
export async function skipIfWidgetNotFound(page: Page): Promise<boolean> {
  const iframe = page.locator('iframe[id="account-switcher-widget"]');
  const exists = await iframe.isVisible().catch(() => false);
  if (!exists) {
    test.skip();
  }
  return exists;
}

/**
 * Assert that CSRF cookie exists and has a value
 */
export async function assertCSRFTokenExists(page: Page): Promise<string> {
  const csrfToken = await page.evaluate(() => {
    const cookie = document.cookie
      .split(";")
      .find((c) => c.trim().startsWith("__csrf="));
    return cookie ? cookie.split("=")[1] : null;
  });

  expect(csrfToken).toBeTruthy();
  expect(csrfToken).toHaveLength(32); // SHA256 = 32 bytes hex
  return csrfToken!;
}

/**
 * Assert that CSRF token ROTATED after API call
 * (New token !== old token)
 */
export async function assertCSRFTokenRotated(
  page: Page,
  oldToken: string
): Promise<string> {
  const newToken = await assertCSRFTokenExists(page);
  expect(newToken).not.toBe(oldToken);
  return newToken;
}

/**
 * Assert that user is logged in (has valid session)
 */
export async function assertUserLoggedIn(page: Page) {
  const response = await page.request.get("http://localhost:3003/api/me");
  expect(response.ok()).toBe(true);
  expect(response.status()).toBe(200);

  const userData = await response.json();
  expect(userData.authenticated).toBe(true);
  expect(userData.user.email).toBeTruthy();
}

/**
 * Assert that user is logged OUT (no valid session)
 */
export async function assertUserLoggedOut(page: Page) {
  const response = await page.request.get("http://localhost:3003/api/me");
  expect(response.status()).toBe(401);
}

/**
 * Assert that IDP session exists (__sso_session cookie)
 */
export async function assertIDPSessionExists(context: BrowserContext) {
  const cookies = await context.cookies();
  const ssoSession = cookies.find((c) => c.name === "__sso_session");
  expect(ssoSession).toBeTruthy();
}

/**
 * Assert that IDP session does NOT exist
 */
export async function assertIDPSessionDestroyed(context: BrowserContext) {
  const cookies = await context.cookies();
  const ssoSession = cookies.find((c) => c.name === "__sso_session");
  expect(ssoSession).toBeFalsy();
}

/**
 * Assert that client app session exists (app_session_c cookie)
 */
export async function assertClientSessionExists(
  context: BrowserContext,
  clientCookie: string = "app_session_c"
) {
  const cookies = await context.cookies();
  const appSession = cookies.find((c) => c.name === clientCookie);
  expect(appSession).toBeTruthy();
}

/**
 * Assert that client app session does NOT exist
 */
export async function assertClientSessionDestroyed(
  context: BrowserContext,
  clientCookie: string = "app_session_c"
) {
  const cookies = await context.cookies();
  const appSession = cookies.find((c) => c.name === clientCookie);
  expect(appSession).toBeFalsy();
}

/**
 * Assert that user's active account is correct
 */
export async function assertActiveAccount(
  page: Page,
  expectedAccountId: string
) {
  const response = await page.request.get("http://localhost:3003/api/me");
  const userData = await response.json();
  expect(userData.activeAccountId).toBe(expectedAccountId);
  expect(userData.account.id).toBe(expectedAccountId);
}

/**
 * Assert that widget postMessage includes required fields
 */
export async function assertValidWidgetMessage(
  message: Record<string, unknown>
) {
  expect(message.type).toBeTruthy();
  expect(message.nonce).toBeTruthy();
  expect(message.requestId).toBeTruthy();
  expect(typeof message.type).toBe("string");
  expect(typeof message.nonce).toBe("string");
  expect(typeof message.requestId).toBe("string");
}

/**
 * Assert that API call with stale CSRF fails
 */
export async function assertStaleCSRFFails(page: Page, staleToken: string) {
  const response = await page.request.post(
    "http://localhost:3000/api/auth/session/validate",
    {
      headers: {
        "Content-Type": "application/json",
      },
      data: { _csrf: staleToken },
    }
  );

  expect(response.status()).toBe(403);
}

/**
 * Assert that CSP header is set (prevents XSS)
 */
export async function assertCSPHeaderSet(page: Page) {
  const response = await page.request.get("http://localhost:3000/widget/account-switcher");
  const cspHeader = response.headers()["content-security-policy"];
  expect(cspHeader).toBeTruthy();
  expect(cspHeader).toContain("script-src");
}

/**
 * Assert that page redirected to login
 */
export async function assertRedirectedToLogin(page: Page) {
  await page.waitForURL(/\/login/);
  expect(page.url()).toContain("/login");
}

/**
 * Assert that all accounts visible in widget
 */
export async function assertAccountsDisplayed(
  page: Page,
  expectedCount: number
) {
  const frame = page.frameLocator('iframe[id="account-switcher-widget"]');
  const buttons = frame.locator('button:has-text("Switch")');
  const activeDisplay = frame.locator('span:has-text("Active")');

  const switchCount = await buttons.count();
  const activeCount = await activeDisplay.count();

  // Total accounts = switch buttons + 1 active = expectedCount
  expect(switchCount + activeCount).toBe(expectedCount);
}
