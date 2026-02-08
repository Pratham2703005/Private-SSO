import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in environment");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAuthorizationCodesTable() {
  console.log("Testing authorization_codes table...\n");

  // Test 1: Check if table exists by querying it
  console.log("Test 1: Checking if table exists...");
  const { data, error } = await supabase
    .from("authorization_codes")
    .select("*")
    .limit(1);

  if (error) {
    console.error("❌ Error querying authorization_codes table:");
    console.error("  Error code:", error.code);
    console.error("  Message:", error.message);
    return;
  }

  console.log("✅ Table exists and is readable");
  console.log("   Sample record count:", data?.length || 0);

  // Test 2: Insert a test record
  console.log("\nTest 2: Inserting test authorization code...");
  const testCode = "test-" + Date.now();
  const { data: insertData, error: insertError } = await supabase
    .from("authorization_codes")
    .insert([
      {
        code: testCode,
        client_id: "client-a",
        user_id: "b4d84b05-0df6-42e1-b41f-db1e270451df", // Test user ID
        redirect_uri: "http://localhost:3001/api/auth/callback",
        code_challenge: "test-challenge-" + Date.now(),
        code_challenge_method: "S256",
        state: "test-state",
        scopes: ["profile", "email"],
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        is_redeemed: false,
      },
    ])
    .select();

  if (insertError) {
    console.error("❌ Error inserting test code:");
    console.error("  Error code:", insertError.code);
    console.error("  Message:", insertError.message);
    console.error("  Details:", insertError.details);
    return;
  }

  console.log("✅ Insert successful");
  console.log("   Inserted code:", insertData?.[0]?.code?.substring(0, 20) + "...");

  // Test 3: Query the test record
  console.log("\nTest 3: Retrieving test code...");
  const { data: queryData, error: queryError } = await supabase
    .from("authorization_codes")
    .select("*")
    .eq("code", testCode)
    .single();

  if (queryError) {
    console.error("❌ Error querying test code:");
    console.error("  Error code:", queryError.code);
    console.error("  Message:", queryError.message);
    return;
  }

  console.log("✅ Query successful");
  console.log("   Code found:", queryData?.code?.substring(0, 20) + "...");

  // Test 4: Clean up
  console.log("\nTest 4: Deleting test code...");
  const { error: deleteError } = await supabase
    .from("authorization_codes")
    .delete()
    .eq("code", testCode);

  if (deleteError) {
    console.error("❌ Error deleting test code:");
    console.error("  Message:", deleteError.message);
    return;
  }

  console.log("✅ Delete successful");

  console.log("\n✅ All tests passed! authorization_codes table is working correctly.");
}

testAuthorizationCodesTable().catch(console.error);
