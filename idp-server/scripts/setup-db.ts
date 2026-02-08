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

console.log("🔧 Checking Supabase database schema...\n");

const client = createClient(supabaseUrl, supabaseKey);

// SQL to create all tables
const tables: { name: string; sql: string }[] = [
  {
    name: "users",
    sql: `CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR UNIQUE NOT NULL,
      password_hash VARCHAR NOT NULL,
      name VARCHAR NOT NULL,
      profile_image_url VARCHAR,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    );`,
  },
  {
    name: "user_accounts",
    sql: `CREATE TABLE IF NOT EXISTS user_accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      email VARCHAR NOT NULL,
      name VARCHAR NOT NULL,
      is_primary BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT now()
    );`,
  },
  {
    name: "sessions",
    sql: `CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      refresh_token_hash VARCHAR,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT now()
    );`,
  },
  {
    name: "refresh_tokens",
    sql: `CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR NOT NULL,
      client_id VARCHAR NOT NULL,
      account_id UUID REFERENCES user_accounts(id),
      is_revoked BOOLEAN DEFAULT false,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT now()
    );`,
  },
];

const indexes: { name: string; sql: string }[] = [
  {
    name: "idx_users_email",
    sql: `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
  },
  {
    name: "idx_user_accounts_user_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_user_accounts_user_id ON user_accounts(user_id);`,
  },
  {
    name: "idx_refresh_tokens_user_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);`,
  },
  {
    name: "idx_refresh_tokens_token_hash",
    sql: `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);`,
  },
];

async function checkTableExists(tableName: string): Promise<boolean> {
  try {
    const { error } = await client.from(tableName).select("id").limit(1);
    // If no error about table not existing, table exists
    if (!error) return true;
    if (error.code === "42P01") return false; // Table doesn't exist
    // Other errors might be permission or connection issues
    console.warn(`⚠️  Could not verify table "${tableName}": ${error.message}`);
    return false;
  } catch (error) {
    return false;
  }
}

async function setupDatabase() {
  try {
    let allExists = true;

    console.log("📋 Checking each table...\n");

    // Check each table
    for (const table of tables) {
      const exists = await checkTableExists(table.name);
      if (exists) {
        console.log(`✅ ${table.name}`);
      } else {
        console.log(`❌ ${table.name} - MISSING`);
        allExists = false;
      }
    }

    console.log("\n");

    if (!allExists) {
      console.error("⚠️  Some tables are missing!\n");
      console.error("📍 Manual Setup Required:\n");
      console.error("1. Open: https://app.supabase.com");
      console.error("2. Go to your project");
      console.error("3. Go to SQL Editor");
      console.error("4. Click 'New query'");
      console.error("5. Copy-paste ALL the SQL below:");
      console.error("6. Click 'Run'\n");

      console.error("=".repeat(60));
      console.error("\n// 📌 COPY ALL THIS SQL:\n");

      // Print tables
      for (const table of tables) {
        console.error(table.sql);
        console.error("");
      }

      // Print indexes
      for (const index of indexes) {
        console.error(index.sql);
        console.error("");
      }

      console.error("=".repeat(60));
      console.error("\n");
      process.exit(1);
    }

    console.log("✅ All tables exist!\n");
    console.log("Checking indexes...\n");

    let indexesMissing = false;

    // Check indexes by trying to use them indirectly
    for (const index of indexes) {
      console.log(`ℹ️  ${index.name}`);
    }

    console.log("\n💡 Note: Cannot verify indexes directly from client.");
    console.log("If you see errors about missing indexes, run this SQL:\n");
    console.error("=".repeat(60));
    for (const index of indexes) {
      console.error(index.sql);
    }
    console.error("=".repeat(60));
    console.log("\n🎉 Database setup complete!\n");
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}\n`);
    console.error("Make sure:");
    console.error("  1. NEXT_PUBLIC_SUPABASE_URL is set");
    console.error("  2. SUPABASE_SERVICE_KEY is set");
    console.error("  3. You have internet connection");
    process.exit(1);
  }
}

setupDatabase();
