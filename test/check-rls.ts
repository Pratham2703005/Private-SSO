/**
 * Check and debug Supabase authorization_codes table access
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://uoqyupqhxtkluadhogin.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvcXl1cHFoeHRrbHVhZGhvZ2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NTY5NTEsImV4cCI6MjA4NTUzMjk1MX0.FergQHGoPx1Snvi3H98PR9kzEC9m-qkwuYboFKTdmFE";
const supabaseServiceKey = "sb_secret_anFeKxwHWOQjC0w9aqjkBg_4bKBC2TV";

async function checkAccess() {
  console.log("🔍 Checking authorization_codes table access...\n");

  // Test 1: Try with anon key
  console.log("Test 1: READ with ANON KEY");
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: anonData, error: anonError } = await anonClient
    .from("authorization_codes")
    .select("id, code")
    .limit(1);

  if (anonError) {
    console.log("  ❌ Error:", anonError.message);
    console.log("  Hint: RLS might be blocking reads\n");
  } else {
    console.log("  ✅ Success! Can read", anonData?.length || 0, "rows\n");
  }

  // Test 2: Try INSERT with anon key
  console.log("Test 2: INSERT with ANON KEY");
  const testCode = "test_" + Date.now();
  const { data: insertData, error: insertError } = await anonClient
    .from("authorization_codes")
    .insert([
      {
        code: testCode,
        client_id: "client-a",
        user_id: "00000000-0000-0000-0000-000000000001",
        redirect_uri: "http://localhost:3001/test",
        code_challenge: "test",
        state: "test",
        scopes: ["test"],
        expires_at: new Date(Date.now() + 600000).toISOString(),
        is_redeemed: false,
      },
    ])
    .select();

  if (insertError) {
    console.log("  ❌ Error:", insertError.message, "\n");
  } else {
    console.log("  ✅ Success! Inserted test code\n");

    // Test 3: Try to read it back immediately
    console.log("Test 3: READ BACK INSERTED CODE");
    const { data: readbackData, error: readbackError } = await anonClient
      .from("authorization_codes")
      .select("code")
      .eq("code", testCode);

    if (readbackError) {
      console.log("  ❌ Error:", readbackError.message);
      console.log("  PROBLEM: Can INSERT but cannot READ back!\n");
    } else {
      console.log("  ✅ Found:", readbackData?.length || 0, "rows");
      if (readbackData && readbackData.length > 0) {
        console.log("  Code:", readbackData[0].code, "\n");
      }
    }

    // Clean up
    await anonClient.from("authorization_codes").delete().eq("code", testCode);
  }

  // Test 4: Try with service key (admin)
  console.log("Test 4: READ with SERVICE KEY (admin)");
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);
  const { data: adminData, error: adminError } = await adminClient
    .from("authorization_codes")
    .select("id, code")
    .limit(1);

  if (adminError) {
    console.log("  ❌ Error:", adminError.message, "\n");
  } else {
    console.log("  ✅ Success! Admin can read", adminData?.length || 0, "rows\n");
  }

  console.log("=" .repeat(60));
  console.log("\n📋 SUMMARY:");
  console.log("  If Test 1 fails but Test 4 succeeds:");
  console.log("  → Problem: RLS policy blocks anon key SELECT");
  console.log("  → Solution: Disable RLS or allow anon SELECT in Supabase\n");
  console.log("  If Test 3 fails:");
  console.log("  → Problem: Write doesn't match read query");
  console.log("  → Solution: Check RLS policies for INSERT vs SELECT\n");
}

checkAccess().catch(console.error);
