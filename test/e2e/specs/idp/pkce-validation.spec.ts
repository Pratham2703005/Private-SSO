import { test, expect } from "@playwright/test";
import crypto from "crypto";

test.describe("IDP: PKCE Validation", () => {
  test("Valid PKCE pair: code_challenge = SHA256(code_verifier)", async ({
    page,
    request,
  }) => {
    // Generate valid PKCE pair
    const verifier = crypto.randomBytes(32).toString("hex");
    const challenge = crypto
      .createHash("sha256")
      .update(verifier)
      .digest("hex");

    // Get authorization code with challenge
    await page.goto(`http://localhost:3000/login`);
    await page.fill('input[name="email"]', "alice@test.com");
    await page.fill('input[name="password"]', "Password123!");
    await page.click('button[type="submit"]');

    await page.goto(
      "http://localhost:3000/api/auth/authorize?" +
        "client_id=client-c&" +
        "response_type=code&" +
        "redirect_uri=http://localhost:3003/callback&" +
        "state=test-state&" +
        `code_challenge=${challenge}&` +
        "code_challenge_method=S256"
    );

    await page.waitForURL(/code=/);
    const url = new URL(page.url());
    const code = url.searchParams.get("code");

    // Exchange with correct verifier
    const response = await request.post("http://localhost:3000/oauth/token", {
      data: {
        grant_type: "authorization_code",
        code,
        state: "test-state",
        client_id: "client-c",
        client_secret: "client-c-secret",
        redirect_uri: "http://localhost:3003/callback",
        code_verifier: verifier,
      },
    });

    expect(response.ok).toBe(true);
    const tokens = await response.json();
    expect(tokens.access_token).toBeTruthy();
  });

  test("Wrong code_verifier fails token exchange", async ({
    page,
    request,
  }) => {
    // Generate PKCE pair
    const verifier = crypto.randomBytes(32).toString("hex");
    const challenge = crypto
      .createHash("sha256")
      .update(verifier)
      .digest("hex");

    // Get code
    await page.goto(`http://localhost:3000/login`);
    await page.fill('input[name="email"]', "alice@test.com");
    await page.fill('input[name="password"]', "Password123!");
    await page.click('button[type="submit"]');

    await page.goto(
      "http://localhost:3000/api/auth/authorize?" +
        "client_id=client-c&" +
        "response_type=code&" +
        "redirect_uri=http://localhost:3003/callback&" +
        `code_challenge=${challenge}`
    );

    await page.waitForURL(/code=/);
    const url = new URL(page.url());
    const code = url.searchParams.get("code");

    // Exchange with WRONG verifier
    const wrongVerifier = crypto.randomBytes(32).toString("hex");
    const response = await request.post("http://localhost:3000/oauth/token", {
      data: {
        grant_type: "authorization_code",
        code,
        client_id: "client-c",
        client_secret: "client-c-secret",
        redirect_uri: "http://localhost:3003/callback",
        code_verifier: wrongVerifier, // Wrong!
      },
    });

    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error.error).toMatch(/invalid_grant|invalid_request/);
  });

  test("Missing code_verifier fails", async ({ page, request }) => {
    const verifier = crypto.randomBytes(32).toString("hex");
    const challenge = crypto
      .createHash("sha256")
      .update(verifier)
      .digest("hex");

    // Get code
    await page.goto(`http://localhost:3000/login`);
    await page.fill('input[name="email"]', "alice@test.com");
    await page.fill('input[name="password"]', "Password123!");
    await page.click('button[type="submit"]');

    await page.goto(
      "http://localhost:3000/api/auth/authorize?" +
        "client_id=client-c&" +
        "response_type=code&" +
        "redirect_uri=http://localhost:3003/callback&" +
        `code_challenge=${challenge}`
    );

    await page.waitForURL(/code=/);
    const url = new URL(page.url());
    const code = url.searchParams.get("code");

    // Try without code_verifier
    const response = await request.post("http://localhost:3000/oauth/token", {
      data: {
        grant_type: "authorization_code",
        code,
        client_id: "client-c",
        client_secret: "client-c-secret",
        redirect_uri: "http://localhost:3003/callback",
        // code_verifier missing!
      },
    });

    expect(response.status()).toBe(400);
  });
});

