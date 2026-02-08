import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
dotenv.config({path: "../.env.local"});

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://uoqyupqhxtkluadhogin.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "sb_secret_anFeKxwHWOQjC0w9aqjkBg_4bKBC2TV";
console.log(SUPABASE_URL, SERVICE_KEY)
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const TABLES_TO_RESET = [
    "authorization_codes",
    "grants",
    "oauth_clients",
    "refresh_tokens",
    "sessions",
];

async function resetTable(table: string) {
  const { error } = await supabase
    .from(table)
    .delete()
    .not("id", "is", null);

  if (error) throw new Error(`${table} reset failed: ${error.message}`);
  console.log(`✅ cleared: ${table}`);
}

async function main() {
  for (const table of TABLES_TO_RESET) {
    await resetTable(table);
  }
  console.log("🔥 All selected tables cleared!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
