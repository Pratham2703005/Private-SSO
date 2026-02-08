/**
 * Direct database test - create and lookup code
 * Run from: cd idp-server && NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npx tsx scripts/test-code-lookup.ts
 */

// Manually load env vars
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://uoqyupqhxtkluadhogin.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvcXl1cHFoeHRrbHVhZGhvZ2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NTY5NTEsImV4cCI6MjA4NTUzMjk1MX0.FergQHGoPx1Snvi3H98PR9kzEC9m-qkwuYboFKTdmFE";
process.env.SUPABASE_SERVICE_KEY = "sb_secret_anFeKxwHWOQjC0w9aqjkBg_4bKBC2TV";

import { getAuthorizationCode, createAuthorizationCode } from "../lib/db";

async function test() {
  console.log("🧪 Testing authorization code create → lookup\n");

  try {
    const userId = "88888888-8888-8888-8888-888888888888";
    const code = await createAuthorizationCode(
      userId,
      "client-a",
      "http://localhost:3001/api/auth/callback",
      "test_challenge_" + Date.now(),
      "test_state",
      ["profile", "email"],
      600
    );

    console.log("✅ Code created:", code?.substring(0, 20) + "...\n");

    console.log("Waiting 500ms...");
    await new Promise((r) => setTimeout(r, 500));

    console.log("Looking up code...");
    const found = await getAuthorizationCode(code!);

    if (found) {
      console.log("✅ FOUND! Code lookup works!\n");
    } else {
      console.log("❌ Code not found. This is the bug.\n");
    }
  } catch (error) {
    console.error("Error:", error);
  }

  process.exit(0);
}

test();
