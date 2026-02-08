/**
 * Script to make code_challenge nullable in authorization_codes table
 * This allows authorization codes to be created without PKCE (backward compatibility)
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || "";

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase credentials");
  console.log("Required env vars:");
  console.log("  - NEXT_PUBLIC_SUPABASE_URL");
  console.log("  - SUPABASE_SERVICE_KEY");
  process.exit(1);
}

// Create admin client with service key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log("🔧 Attempting to modify code_challenge column...\n");

    // Try to directly execute SQL through Supabase admin API
    // This may not work depending on your Supabase setup

    // First, let's try to read current schema to confirm issue
    const { data, error } = await supabase
      .from("authorization_codes")
      .select("id", { count: "exact" })
      .limit(1);

    if (error && error.message.includes("code_challenge")) {
      console.log("✅ Issue confirmed: code_challenge column has NOT NULL constraint\n");
    }

    // Show manual instructions
    console.log("📋 To fix this, please run the following in Supabase SQL Editor:\n");
    console.log("=" .repeat(60));
    console.log(`
ALTER TABLE authorization_codes
ALTER COLUMN code_challenge DROP NOT NULL;
    `);
    console.log("=" .repeat(60));
    console.log("\n📍 Steps:");
    console.log("  1. Go to: https://app.supabase.com/project/[project]/sql/editor");
    console.log("  2. Copy and paste the SQL above");
    console.log("  3. Click 'Run'");
    console.log("  4. Re-run the tests\n");

    process.exit(0);
  } catch (error) {
    if(error instanceof Error) {
        console.error("Error:", error.message);
    }
    process.exit(1);
  }
}

runMigration();
