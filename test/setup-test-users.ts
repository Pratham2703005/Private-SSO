import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import crypto from "crypto";

dotenv.config({ path: "../.env.local" });

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://uoqyupqhxtkluadhogin.supabase.co";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  "sb_secret_anFeKxwHWOQjC0w9aqjkBg_4bKBC2TV";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "test1@example.com",
  password: "01234Pk",
  name: "Test User 1",
};

const TEST_USER_2 = {
  id: "00000000-0000-0000-0000-000000000002",
  email: "test2@example.com",
  password: "01234Pk",
  name: "Test User 2",
};

async function createTestUsers() {
  try {
    console.log("📝 Setting up test users...\n");

    const users = [TEST_USER, TEST_USER_2];

    for (const user of users) {
      // Check if user exists
      const { data: existing, error: checkError } = await supabase
        .from("users")
        .select("id")
        .eq("email", user.email)
        .single();

      if (existing) {
        console.log(`✅ ${user.email} already exists`);
        continue;
      }

      if (checkError && checkError.code !== "PGRST116") {
        console.error(`Error checking user ${user.email}:`, checkError.message);
        continue;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(user.password, 10);

      // Create user
      const { error: insertError } = await supabase.from("users").insert([
        {
          id: user.id,
          email: user.email,
          password_hash: passwordHash,
          name: user.name,
          profile_image_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      if (insertError) {
        console.error(`Error creating user ${user.email}:`, insertError.message);
        continue;
      }

      // Create primary account for user
      const accountId = crypto.randomUUID();
      const { error: accountError } = await supabase
        .from("user_accounts")
        .insert([
          {
            id: accountId,
            user_id: user.id,
            email: user.email,
            name: user.name,
            is_primary: true,
            created_at: new Date().toISOString(),
          },
        ]);

      if (accountError) {
        console.error(
          `Error creating account for ${user.email}:`,
          accountError.message
        );
        continue;
      }

      console.log(`✅ Created ${user.email} with account ${accountId}`);
    }

    console.log("\n🎉 Test users setup complete!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

createTestUsers();
