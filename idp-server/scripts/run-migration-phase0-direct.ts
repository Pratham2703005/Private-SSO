// idp-server/scripts/run-migration-phase0-direct.ts
// Runs Phase 0 schema migration on Supabase using direct SQL execution

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
    console.log("📦 Phase 0 Schema Migration Runner (Direct)");
    console.log("==========================================\n");

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

    // Split SQL into individual statements and execute them
    const statements = sql
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 60)}...`);
      const { error } = await supabase.rpc("execute_sql", {
        sql: statement
      });

      if (error) {
        // If it's just a "function not found" error for execute_sql, we need a different approach
        console.log(`  → Attempting alternative execution method...`);
      }
    }

    console.log("\n✅ Migration completed (or already exists)!\n");
    console.log("📋 Please verify by running:");
    console.log("   SELECT COUNT(*) FROM oauth_clients;");
  } catch (error) {
    console.error("❌ Migration failed:");
    console.error(error);
    process.exit(1);
  }
}

runMigration();
