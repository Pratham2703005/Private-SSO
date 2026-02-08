// idp-server/scripts/run-migration-stage11.ts
// Runs Stage 11 schema migration on Supabase

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
    console.log("📦 Stage 11: Account Switching Schema Migration");
    console.log("==============================================\n");

    // Read the migration SQL file
    const migrationPath = path.join(
      __dirname,
      "../migrations/004_stage11_account_switching.sql"
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
    console.log("📋 Changes applied:");
    console.log("   - Added active_account_id column to sessions table");
    console.log("   - Created session_logons table for multi-account tracking");
    console.log("   - Added session_id column to refresh_tokens table");
    console.log("   - Created performance indexes for account lookups");
    console.log("\n🎉 Stage 11 migration ready for testing!\n");
  } catch (error) {
    console.error("❌ Error running migration:", error);
    process.exit(1);
  }
}

runMigration();
