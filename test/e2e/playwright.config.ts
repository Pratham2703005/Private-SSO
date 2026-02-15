import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E Test Configuration
 *
 * Tests run against:
 * - IDP Server: http://localhost:3000
 * - Client C: http://localhost:3003
 *
 * All tests use REAL API endpoints (no mocking auth flows).
 * Tests validate CSRF token rotation, PKCE protection, and widget postMessage.
 */

export default defineConfig({
  testDir: "./specs",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4,
  globalSetup: "./global-setup.ts",
  reporter: [
    ["html"],
    ["json", { outputFile: "test-results.json" }],
    ["junit", { outputFile: "junit-results.xml" }],
  ],

  use: {
    baseURL: "http://localhost:3003", // Client app
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
  ],

  webServer: [
    {
      command: "cd ../.. && cd idp-server && npm run dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: "cd ../.. && cd client-c && npm run dev",
      url: "http://localhost:3003",
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
});
