import { test, expect } from "@playwright/test";
import { loginViaUI } from "../../helpers/auth";
import testData from "../../fixtures/test-data.json";

test.describe("IDP: Token Refresh Grant", () => {
  const { users } = testData;
  const testUser = users[0]; // Alice

  let refreshToken: string;
  let accessToken: string;

  test.beforeEach(async ({ page, request }) => {
    // Login and get tokens
    await loginViaUI(page, testUser.email, testUser.password);

    // Get authorization code
    await page.goto(
      "http://localhost:3000/api/auth/authorize?" +
        "client_id=client-c&" +
        "response_type=code&" +
        "redirect_uri=http://localhost:3003/callback&" +
        "state=test-state&" +
        "code_challenge=test"
    );

    await page.waitForURL(/code=/);
    const url = new URL(page.url());
    const code = url.searchParams.get("code");

    // Exchange for tokens
    const tokenResponse = await request.post(
      "http://localhost:3000/oauth/token",
      {
        data: {
          grant_type: "authorization_code",
          code,
          state: "test-state",
          client_id: "client-c",
          client_secret: "client-c-secret",
          redirect_uri: "http://localhost:3003/callback",
          code_verifier: "test",
        },
      }
    );

    const tokens = await tokenResponse.json();
    accessToken = tokens.access_token;
    refreshToken = tokens.refresh_token;
  });

  test("Refresh token grant returns new access token", async ({
    request,
  }) => {
    const response = await request.post("http://localhost:3000/oauth/token", {
      data: {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: "client-c",
        client_secret: "client-c-secret",
      },
    });

    expect(response.ok).toBe(true);
    const tokens = await response.json();
    expect(tokens.access_token).toBeTruthy();
    expect(tokens.access_token).not.toBe(accessToken); // New token
  });

  test("New refresh token issued on refresh", async ({ request }) => {
    const response = await request.post("http://localhost:3000/oauth/token", {
      data: {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: "client-c",
        client_secret: "client-c-secret",
      },
    });

    const tokens = await response.json();
    const newRefreshToken = tokens.refresh_token;

    // New refresh token should be different (rotation)
    expect(newRefreshToken).toBeTruthy();
    expect(newRefreshToken).not.toBe(refreshToken);

    // Old refresh token should no longer work
    const oldTokenResponse = await request.post(
      "http://localhost:3000/oauth/token",
      {
        data: {
          grant_type: "refresh_token",
          refresh_token: refreshToken, // Old token
          client_id: "client-c",
          client_secret: "client-c-secret",
        },
      }
    );

    expect(oldTokenResponse.status()).toBe(400);
  });

  test("Invalid refresh token rejected", async ({ request }) => {
    const response = await request.post("http://localhost:3000/oauth/token", {
      data: {
        grant_type: "refresh_token",
        refresh_token: "invalid-token-xyz",
        client_id: "client-c",
        client_secret: "client-c-secret",
      },
    });

    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error.error).toMatch(/invalid_grant|invalid_request/);
  });
});

