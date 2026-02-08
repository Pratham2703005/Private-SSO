// idp-server/scripts/run-migration-phase0.ts
// Runs Phase 0 schema migration on Supabase

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Error: Supabase credentials not configured");
  console.error("   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    console.log("📦 Phase 0 Schema Migration Runner");
    console.log("==================================\n");

    // Read the migration SQL file
    const migrationPath = path.join(
      __dirname,
      "../migrations/001_phase0_oauth_schema.sql"
    );

    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, "utf-8");

    console.log("📝 Executing migration SQL...\n");

    // Execute the migration
    const { error } = await supabase.rpc("exec", {
      sql_string: sql,
    });

    if (error) {
      console.error("❌ Migration failed:");
      console.error(error);
      process.exit(1);
    }

    console.log("✅ Migration completed successfully!\n");

    // Verify tables were created
    console.log("🔍 Verifying tables...\n");

    const tablesToCheck = [
      "oauth_clients",
      "authorization_codes",
      "grants",
      "refresh_tokens",
      "sessions",
    ];

    for (const table of tablesToCheck) {
      const { data, error: checkError } = await supabase
        .from(table)
        .select("count()", { count: "exact", head: true });

      if (checkError && checkError.code !== "PGRST116") {
        // PGRST116 = relation doesn't exist
        console.log(`   ⚠️  ${table}: ${checkError.message}`);
      } else {
        console.log(`   ✅ ${table}: exists`);
      }
    }

    console.log("\n📊 Schema Summary:");
    console.log("   - oauth_clients: Stores registered OAuth clients");
    console.log("   - authorization_codes: Temporary codes for auth flow");
    console.log("   - grants: User consent tracking");
    console.log("   - refresh_tokens: Long-lived tokens with rotation");
    console.log("   - sessions: Enhanced with OAuth tracking fields\n");

    console.log("⚡ Next steps:");
    console.log("   1. Verify tables in Supabase Dashboard");
    console.log("   2. Register test clients via /api/admin/clients");
    console.log("   3. Start Phase 1-2 (Authorization Code Flow)\n");
  } catch (error) {
    console.error("❌ Unexpected error during migration:");
    console.error(error);
    process.exit(1);
  }
}

runMigration();
