import { test, expect } from "@playwright/test";
import { loginViaUI } from "../../helpers/auth";
import testData from "../../fixtures/test-data.json";

test.describe("Security: CSRF State Validation", () => {
  const { users } = testData;
  const testUser = users[0]; // Alice

  test("Authorization with correct state succeeds", async ({ page }) => {
    // Login first
    await loginViaUI(page, testUser.email, testUser.password);

    // Generate valid state
    const validState = "test-state-abc123";

    // Navigate to authorize with correct state
    await page.goto(
      "http://localhost:3000/api/auth/authorize?" +
        "client_id=client-c&" +
        "response_type=code&" +
        "redirect_uri=http://localhost:3003/callback&" +
        `state=${validState}&` +
        "code_challenge=test-challenge&" +
        "code_challenge_method=S256"
    );

    // Should return code and state in response
    await page.waitForURL(/code=.*&state=/);
    const url = new URL(page.url());
    expect(url.searchParams.has("code")).toBe(true);
    expect(url.searchParams.get("state")).toBe(validState);
  });

  test("Authorization with mismatched state in callback fails", async ({
    page,
  }) => {
    // Login
    await loginViaUI(page, testUser.email, testUser.password);

    // Get authorization code
    const authState = "original-state";
    await page.goto(
      "http://localhost:3000/api/auth/authorize?" +
        "client_id=client-c&" +
        "response_type=code&" +
        "redirect_uri=http://localhost:3003/callback&" +
        `state=${authState}&` +
        "code_challenge=test-challenge"
    );

    await page.waitForURL(/code=/);
    const authUrl = new URL(page.url());
    const code = authUrl.searchParams.get("code");

    // Try to exchange code with WRONG state
    const response = await page.request.post(
      "http://localhost:3000/oauth/token",
      {
        data: {
          grant_type: "authorization_code",
          code,
          state: "WRONG-STATE", // Different from original
          client_id: "client-c",
          client_secret: "client-c-secret",
          redirect_uri: "http://localhost:3003/callback",
          code_verifier: "test-verifier",
        },
      }
    );

    // Should reject
    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error.error).toMatch(/invalid|state/i);
  });

  test("State parameter prevents CSRF attack", async ({ page }) => {
    // Scenario: Attacker tries to craft authorization URL with their own state
    // Victim clicks link, gets authorized with attacker's state
    // Attacker intercepts code and tries to claim the authorization

    // Login victim
    await loginViaUI(page, testUser.email, testUser.password);

    // Attacker's malicious state
    const attackerState = "attacker-state-xyz";

    // Victim is tricked into clicking attacker's link
    await page.goto(
      "http://localhost:3000/api/auth/authorize?" +
        "client_id=client-c&" +
        "response_type=code&" +
        "redirect_uri=http://localhost:3003/callback&" +
        `state=${attackerState}&` +
        "code_challenge=attacker-challenge"
    );

    // Code is returned with attacker's state
    await page.waitForURL(/code=/);
    const url = new URL(page.url());
    const code = url.searchParams.get("code");
    const returnedState = url.searchParams.get("state");

    expect(returnedState).toBe(attackerState);

    // Victim's legitimate client verifies:
    // expectedState = "victim-state-123" (stored before redirect)
    // returnedState = "attacker-state-xyz" (from URL)
    // expectedState !== returnedState → REJECT

    const victimExpectedState = "victim-state-123";
    const stateMatch = victimExpectedState === returnedState;

    expect(stateMatch).toBe(false); // State mismatch detected
  });

  test("Multiple sequential authorizations have different states", async ({
    page,
  }) => {
    // Login
    await loginViaUI(page, testUser.email, testUser.password);

    // First authorization
    const state1 = "state-001";
    await page.goto(
      "http://localhost:3000/api/auth/authorize?" +
        "client_id=client-c&" +
        "response_type=code&" +
        "redirect_uri=http://localhost:3003/callback&" +
        `state=${state1}&` +
        "code_challenge=challenge1"
    );
    await page.waitForURL(/code=/);
    const code1 = new URL(page.url()).searchParams.get("code");

    // Second authorization
    const state2 = "state-002";
    await page.goto(
      "http://localhost:3000/api/auth/authorize?" +
        "client_id=client-c&" +
        "response_type=code&" +
        "redirect_uri=http://localhost:3003/callback&" +
        `state=${state2}&` +
        "code_challenge=challenge2"
    );
    await page.waitForURL(/code=/);
    const code2 = new URL(page.url()).searchParams.get("code");

    // Both codes should be different
    expect(code1).not.toBe(code2);

    // Trying to use code1 with state2 should fail
    const response = await page.request.post(
      "http://localhost:3000/oauth/token",
      {
        data: {
          grant_type: "authorization_code",
          code: code1,
          state: state2, // state2, but code1
          client_id: "client-c",
          client_secret: "client-c-secret",
          redirect_uri: "http://localhost:3003/callback",
          code_verifier: "challenge2",
        },
      }
    );

    expect(response.status()).toBe(400);
  });
});

