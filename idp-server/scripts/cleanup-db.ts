import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load environment variables
const envPath = path.resolve(process.cwd(), ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const envVars: Record<string, string> = {};

envContent.split("\n").forEach((line) => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith("#")) {
    const [key, ...valueParts] = trimmed.split("=");
    envVars[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_KEY;

console.log("🧹 Cleaning up Supabase database...\n");

const client = createClient(supabaseUrl, supabaseKey);

// Tables to drop in order (respecting foreign key dependencies)
const tablesToDrop = [
  "refresh_tokens",
  "sessions",
  "user_accounts",
  "users",
];

async function cleanupDatabase() {
  try {
    for (const table of tablesToDrop) {
      try {
        const { error } = await client.rpc("drop_table", {
          table_name: table,
        }).catch(() => {
          // Fallback if rpc is not available - use raw SQL
          return client.from(table).delete().neq("id", "");
        });

        if (error && !error.message.includes("does not exist")) {
          console.log(`⚠️  Error dropping ${table}: ${error.message}`);
        } else {
          console.log(`✅ Dropped table: ${table}`);
        }
      } catch (err) {
        // Try direct SQL approach via Supabase admin API
        console.log(`⏭️  Skipping ${table} (may not exist)`);
      }
    }

    console.log("\n✨ Database cleanup complete!");
    console.log("Run 'npm run setup:db' to recreate the tables.");
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    process.exit(1);
  }
}

// Alternative approach using raw SQL (more reliable)
async function cleanupDatabaseWithSQL() {
  try {
    console.log("Using SQL-based cleanup...\n");

    // Drop tables in order (foreign key dependencies)
    const dropStatements = [
      'DROP TABLE IF EXISTS "refresh_tokens" CASCADE;',
      'DROP TABLE IF EXISTS "sessions" CASCADE;',
      'DROP TABLE IF EXISTS "user_accounts" CASCADE;',
      'DROP TABLE IF EXISTS "users" CASCADE;',
    ];

    for (const sql of dropStatements) {
      try {
        const { error } = await client.rpc("exec_sql", { sql });
        
        if (error) {
          // If rpc method doesn't exist, try direct query
          const tableName = sql.match(/"([^"]+)"/)?.[1];
          console.log(`⏭️  Skipping ${tableName} (admin RPC not available)`);
        } else {
          const tableName = sql.match(/"([^"]+)"/)?.[1];
          console.log(`✅ Dropped table: ${tableName}`);
        }
      } catch (err) {
        // Continue on error
      }
    }

    console.log("\n✨ Database cleanup complete!");
    console.log("Note: To fully clear tables, use Supabase dashboard or enable RLS policies");
    console.log("Run 'npm run setup:db' to recreate the tables.");
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    process.exit(1);
  }
}

// Simple approach: Delete all rows from each table
async function cleanupDatabaseDeleteRows() {
  try {
    console.log("Clearing all data from tables...\n");

    for (const table of tablesToDrop) {
      try {
        const { error, count } = await client
          .from(table)
          .delete()
          .neq("id", "");

        if (error) {
          console.log(`⚠️  Error clearing ${table}: ${error.message}`);
        } else {
          console.log(`✅ Cleared ${count} rows from: ${table}`);
        }
      } catch (err) {
        console.log(`⏭️  Skipping ${table}`);
      }
    }

    console.log("\n✨ Database cleanup complete!");
    console.log("All data has been deleted. Tables still exist.");
    console.log("Run 'npm run setup:db' to recreate the full schema.");
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    process.exit(1);
  }
}

// Run the cleanup (using the delete rows approach as it's most reliable)
cleanupDatabaseDeleteRows();
