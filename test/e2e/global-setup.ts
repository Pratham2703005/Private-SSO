import { chromium, FullConfig } from "@playwright/test";
import testData from "./fixtures/test-data.json";

/**
 * Global setup runs once before all tests
 * Seeds OAuth clients and test users into the database
 */
async function globalSetup(config: FullConfig) {
  const { idpBaseUrl } = testData;
  const baseUrl = `http://localhost:3000`;

  // Wait for IDP server to be ready
  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`${baseUrl}/login`, { method: "GET" });
      if (response.ok || response.status === 404) {
        console.log("✅ IDP Server is ready");
        break;
      }
    } catch (error) {
      attempts++;
      if (attempts < maxAttempts) {
        console.log(`⏳ Waiting for IDP server... (${attempts}/${maxAttempts})`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else {
        console.error("❌ IDP Server did not become ready in time");
        throw error;
      }
    }
  }

  // Seed OAuth clients
  console.log("\n📊 Seeding OAuth clients...");
  try {
    const seedResponse = await fetch(`${baseUrl}/api/setup/seed-oauth-clients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clients: testData.clients }),
    });

    if (!seedResponse.ok) {
      const errorText = await seedResponse.text();
      console.warn(
        `⚠️  OAuth seeding returned ${seedResponse.status}: ${errorText.substring(0, 200)}`
      );
    } else {
      const result = await seedResponse.json();
      console.log("✅ OAuth clients seeded successfully");
      console.log(
        `   Registered clients: ${result.seededClients?.map((c: any) => c.clientId).join(", ") || "unknown"}`
      );
    }
  } catch (error) {
    console.warn("⚠️  Could not seed OAuth clients:", error);
    // Don't fail tests if seeding fails - endpoint might not be implemented
  }

  // Verify client can reach the authorize endpoint
  console.log("\n🔍 Verifying OAuth authorize endpoint...");
  try {
    const authTestResponse = await fetch(
      `${baseUrl}/api/auth/authorize?client_id=client-c&response_type=code&redirect_uri=http://localhost:3003/callback&state=test-verify`,
      {
        method: "GET",
        redirect: "manual", // Don't follow redirects automatically
      }
    );

    console.log(`   Authorize endpoint status: ${authTestResponse.status}`);
    if (authTestResponse.status === 302 || authTestResponse.status === 307) {
      const location = authTestResponse.headers.get("location");
      console.log(`   ✅ Endpoint redirects to: ${location?.substring(0, 100)}`);
    } else if (authTestResponse.status === 400) {
      console.log(`   ⚠️  Client not found or redirect_uri not whitelisted`);
    } else {
      console.log(`   ℹ️  Unexpected status (but may be OK): ${authTestResponse.status}`);
    }
  } catch (error) {
    console.warn("⚠️  Could not verify authorize endpoint:", error);
  }

  console.log("\n✨ Global setup complete\n");
}

export default globalSetup;
