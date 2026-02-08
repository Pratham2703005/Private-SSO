// Helper to seed OAuth clients into Supabase for testing
// Run this once to set up client-a and client-b in the oauth_clients table

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase credentials not configured");
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedOAuthClients() {
  try {
    console.log("🌱 Seeding OAuth clients into Supabase...");

    // Check and insert client-a
    const { data: existingClientA } = await supabase
      .from("oauth_clients")
      .select("id")
      .eq("client_id", "client-a")
      .single();

    if (!existingClientA) {
      const { error: errorA } = await supabase
        .from("oauth_clients")
        .insert([
          {
            client_id: "client-a",
            client_secret_hash: "hash_client_a_secret", // For testing only
            client_name: "Client App A",
            allowed_redirect_uris: [
              "http://localhost:3001/api/auth/callback",
              "http://localhost:3001/login",
            ],
            is_active: true,
          },
        ]);

      if (errorA) {
        console.error("❌ Error inserting client-a:", errorA);
      } else {
        console.log("✅ Created client-a");
      }
    } else {
      console.log("⏭️  client-a already exists");
    }

    // Check and insert client-b
    const { data: existingClientB } = await supabase
      .from("oauth_clients")
      .select("id")
      .eq("client_id", "client-b")
      .single();

    if (!existingClientB) {
      const { error: errorB } = await supabase
        .from("oauth_clients")
        .insert([
          {
            client_id: "client-b",
            client_secret_hash: "hash_client_b_secret", // For testing only
            client_name: "Client App B",
            allowed_redirect_uris: [
              "http://localhost:3002/api/auth/callback",
              "http://localhost:3002/login",
            ],
            is_active: true,
          },
        ]);

      if (errorB) {
        console.error("❌ Error inserting client-b:", errorB);
      } else {
        console.log("✅ Created client-b");
      }
    } else {
      console.log("⏭️  client-b already exists");
    }

    // Check and insert client-inactive
    const { data: existingInactive } = await supabase
      .from("oauth_clients")
      .select("id")
      .eq("client_id", "client-inactive")
      .single();

    if (!existingInactive) {
      const { error: errorInactive } = await supabase
        .from("oauth_clients")
        .insert([
          {
            client_id: "client-inactive",
            client_secret_hash: "hash_client_inactive_secret",
            client_name: "Inactive Test Client",
            allowed_redirect_uris: ["http://localhost:3001/api/auth/callback"],
            is_active: false,
          },
        ]);

      if (errorInactive) {
        console.error("❌ Error inserting client-inactive:", errorInactive);
      } else {
        console.log("✅ Created client-inactive");
      }
    } else {
      console.log("⏭️  client-inactive already exists");
    }

    console.log("🎉 OAuth clients seeding complete!");
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

seedOAuthClients();
