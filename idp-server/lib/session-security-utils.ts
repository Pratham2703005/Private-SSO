import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * Session Binding Security
 * Prevents token theft by binding tokens to the device/browser that issued them
 */

/**
 * Compute session binding hash from User-Agent
 * Used to prevent stolen tokens from being used on different devices
 * 
 * @param userAgent User-Agent header from request
 * @returns SHA256 hash of user agent (can be stored in DB or included in token)
 */
export function computeSessionBindingHash(userAgent: string): string {
  return crypto
    .createHash("sha256")
    .update(userAgent || "")
    .digest("hex");
}

/**
 * Verify session binding matches current User-Agent
 * Called on every protected request
 * 
 * NOTE: UA can change legitimately (browser updates, mobile WebView changes, proxies, Brave, etc.)
 * So we treat this as a SOFT CHECK - log suspicious activity but allow
 * If you need stronger binding, use device_id cookie in addition to UA hash
 * 
 * @param storedBindingHash Hash stored in DB at token issue time
 * @param currentUserAgent Current request User-Agent
 * @returns { isValid: boolean, suspicious: boolean }
 */
export function verifySessionBinding(
  storedBindingHash: string,
  currentUserAgent: string
): { isValid: boolean; suspicious: boolean } {
  if (!storedBindingHash) {
    // Old tokens without binding - grandfathered in
    return { isValid: true, suspicious: false };
  }

  const currentHash = computeSessionBindingHash(currentUserAgent);
  const isValid = storedBindingHash === currentHash;

  if (!isValid) {
    // UA changed - could be legitimate (browser update) or could be theft
    // Log for monitoring but don't block
    console.warn("[SessionBinding] UA mismatch detected", {
      storedHash: storedBindingHash.substring(0, 16) + "...",
      currentHash: currentHash.substring(0, 16) + "...",
      timestamp: new Date().toISOString(),
    });
  }

  return { isValid, suspicious: !isValid };
}

/**
 * CSRF Protection: Set CSRF cookie in response
 * Used for double-submit CSRF prevention
 * 
 * @param response NextResponse to set cookie on
 * @param csrfToken Random token (sent in cookie, client includes in body)
 * @returns response with CSRF cookie set
 */
export function setCSRFCookie(response: NextResponse, csrfToken: string): NextResponse {
  const isProduction = process.env.NODE_ENV === "production";
  
  response.cookies.set({
    name: "__csrf",
    value: csrfToken,
    httpOnly: false, // JavaScript needs to read this for double-submit
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax", // IDP iframe needs this
    maxAge: 3600, // 1 hour
    path: "/",
  });
  
  return response;
}

/**
 * Generate random CSRF token
 * Send in Set-Cookie (browser auto-sends on next request)
 * Widget reads from cookie, includes in request body {_csrf: token}
 * Server validates cookie == body (double-submit)
 * 
 * @returns Random 32-byte hex string
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Validate CSRF protection (double-submit cookies only)
 * 
 * Flow:
 * 1. Browser has __csrf cookie (from previous Set-Cookie response)
 * 2. Widget reads the cookie value
 * 3. Widget includes in request body: { _csrf: "cookie-value" }
 * 4. Server validates: request.cookies.__csrf == request.body._csrf
 * 5. If match: CSRF is valid (cookie came from browser, body from legitimate client)
 * 6. If mismatch: CSRF invalid (body from attacker who couldn't read same-origin cookie)
 * 
 * NOTE: Uses ONLY double-submit cookies, not server-side token table
 * Pick ONE approach to avoid debugging complexity
 * 
 * @param req NextRequest with body containing _csrf field
 * @returns Object with isValid and token (or error message)
 */
export async function validateCSRFToken(req: NextRequest): Promise<{
  isValid: boolean;
  token?: string;
  error?: string;
}> {
  try {
    // Get CSRF token from cookie
    const cookieToken = req.cookies.get("__csrf")?.value;
    
    if (!cookieToken) {
      return { isValid: false, error: "CSRF cookie missing" };
    }

    // Get CSRF token from request body
    let bodyToken: string | undefined;
    try {
      const body = await req.clone().json();
      bodyToken = body._csrf;
    } catch {
      return { isValid: false, error: "Invalid request body" };
    }

    if (!bodyToken) {
      return { isValid: false, error: "CSRF token missing from body" };
    }

    // Validate they match (must be identical for CSRF check to pass)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(cookieToken),
      Buffer.from(bodyToken)
    );

    return {
      isValid,
      token: cookieToken,
      error: isValid ? undefined : "CSRF token mismatch",
    };
  } catch (error) {
    return { isValid: false, error: String(error) };
  }
}

/**
 * Validate Origin header (additional defense layer)
 * Should match one of allowed client origins
 * 
 * @param req NextRequest with Origin header
 * @param allowedOrigins List of allowed origin URLs
 * @returns true if Origin header matches allowlist
 */
export function validateOrigin(
  req: NextRequest,
  allowedOrigins: string[]
): boolean {
  const origin = req.headers.get("origin");
  
  if (!origin) {
    // Origin header missing (can happen in some cross-domain scenarios)
    // Allow if making request from same site (authenticated via cookies)
    return true;
  }

  return allowedOrigins.includes(origin);
}

/**
 * Validate access token expiration
 * Called before using an access token
 * 
 * @param expiresAt Expiration timestamp (seconds since epoch)
 * @returns true if token still valid, false if expired
 */
export function validateTokenExpiration(expiresAt: number): boolean {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return nowSeconds < expiresAt;
}

/**
 * Get client origin allowlist from config
 * Used to validate Origin header on state-changing requests
 * 
 * @returns Array of allowed origins
 */
export function getAllowedClientOrigins(): string[] {
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    // In production, use explicit allowlist
    return (process.env.ALLOWED_CLIENT_ORIGINS || "").split(",").filter(Boolean);
  }

  // In development, allow localhost with various ports
  return [
    "http://localhost:3003", // client-c
    "http://localhost:3002", // client-b
    "http://localhost:3001", // client-a
    "http://localhost:3000", // idp itself (for iframe)
    "https://pratham-sso.vercel.app"
  ];
}
