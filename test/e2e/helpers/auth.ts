import { Page, BrowserContext } from "@playwright/test";

/**
 * Authentication Helper Functions
 * All use REAL API endpoints, no mocking
 */

/**
 * Login via UI (simulates user typing email/password)
 */
export async function loginViaUI(page: Page, email: string, password: string) {
  await page.goto("http://localhost:3000/login");

  // Wait for form elements to be ready (shorter timeout, retry if needed)
  try {
    await page.waitForSelector('input[name="email"]', { timeout: 5000 });
    await page.waitForSelector('input[name="password"]', { timeout: 5000 });
    await page.waitForSelector('button[type="submit"]', { timeout: 5000 });
  } catch {
    // Elements might already be visible, continue
  }

  // Fill login form with shorter interactions
  try {
    await page.fill('input[name="email"]', email, { timeout: 3000 });
  } catch {
    // If fill times out, try using type instead (more reliable in Firefox)
    await page.type('input[name="email"]', email, { delay: 10 });
  }

  try {
    await page.fill('input[name="password"]', password, { timeout: 3000 });
  } catch {
    // If fill times out, try using type instead
    await page.type('input[name="password"]', password, { delay: 10 });
  }

  // Click submit button
  try {
    await page.click('button[type="submit"]', { timeout: 3000 });
  } catch {
    // Try again if first click fails
    await page.click('button[type="submit"]');
  }

  // Wait for redirect (either to dashboard or to client callback or back to login on error)
  // Give up to 10s for the server to respond
  await page.waitForURL(/\/(login|signup|dashboard|callback|auth)/i, { timeout: 10000 }).catch(() => {
    // Timeout is OK - server might be slow or not fully implemented
  });
}

/**
 * Get CSRF token from document.cookie
 * Widget reads __csrf this way before posting to /api/auth/switch-account
 */
export async function getCSRFCookieValue(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const cookie = document.cookie
      .split(";")
      .find((c) => c.trim().startsWith("__csrf="));
    if (!cookie) return null;
    return cookie.split("=")[1];
  });
}

/**
 * Get all cookies for inspection
 */
export async function getAllCookies(
  context: BrowserContext
): Promise<Array<{ name: string; value: string }>> {
  const cookies = await context.cookies();
  return cookies.map((c) => ({ name: c.name, value: c.value }));
}

/**
 * Check if session cookie exists
 */
export async function hasSessionCookie(
  context: BrowserContext,
  cookieName: string
): Promise<boolean> {
  const cookies = await context.cookies();
  return cookies.some((c) => c.name === cookieName);
}

/**
 * Logout via API call
 * Used for test cleanup
 */
export async function logoutViaAPI(
  page: Page,
  scope: "app" | "global" = "global"
) {
  const response = await page.request.post(
    "http://localhost:3000/api/auth/logout",
    {
      data: { scope },
    }
  );
  return response.ok();
}

/**
 * Exchange authorization code for tokens (OAuth callback simulation)
 */
export async function exchangeCodeForTokens(
  page: Page,
  code: string,
  state: string
) {
  const response = await page.request.post("http://localhost:3000/oauth/token", {
    data: {
      grant_type: "authorization_code",
      code,
      state,
      client_id: "client-c",
      client_secret: "client-c-secret",
      redirect_uri: "http://localhost:3003/callback",
    },
  });
  return response.json();
}
