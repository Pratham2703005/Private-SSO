import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

/**
 * Development-only endpoint to seed OAuth clients for testing
 * POST /api/setup/seed-oauth-clients
 * 
 * This should only be accessible in development mode
 */
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 }
    );
  }

  try {
    // First, ensure the oauth_clients table exists by creating it
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS oauth_clients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id TEXT UNIQUE NOT NULL,
        client_secret_hash TEXT NOT NULL,
        client_name TEXT,
        allowed_redirect_uris TEXT[] NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_oauth_clients_client_id ON oauth_clients(client_id);
      CREATE INDEX IF NOT EXISTS idx_oauth_clients_active ON oauth_clients(is_active);
    `;

    // Try to create the table using a raw query through fetch to Supabase REST
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (supabaseUrl && supabaseKey) {
      try {
        // First try to create table using Supabase's query endpoint
        const headers = {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        };

        // Check if table exists first
        const checkTableResponse = await fetch(
          `${supabaseUrl}/rest/v1/oauth_clients?limit=1`,
          {
            method: 'GET',
            headers,
          }
        );

        if (checkTableResponse.status === 400 || checkTableResponse.status === 404) {
          console.log('[Seeding] oauth_clients table does not exist, attempting to create...');
          
          // Table doesn't exist, we need to create it
          // Supabase REST API doesn't support DDL, so we'll note this limitation
          console.log('[Seeding] Note: oauth_clients table creation requires manual setup or Supabase SQL Editor');
          console.log('[Seeding] Please run migrations manually in Supabase SQL Editor');
        }
      } catch (tableCheckError) {
        console.error('[Seeding] Error checking table:', tableCheckError);
      }
    }

    const clients = [
      {
        client_id: "client-a",
        client_secret_hash: "test_secret_hash_a",
        client_name: "Client App A",
        allowed_redirect_uris: [
          "http://localhost:3001/api/auth/callback",
          "http://localhost:3001/login",
        ],
        is_active: true,
      },
      {
        client_id: "client-b",
        client_secret_hash: "test_secret_hash_b",
        client_name: "Client App B",
        allowed_redirect_uris: [
          "http://localhost:3002/api/auth/callback",
          "http://localhost:3002/login",
        ],
        is_active: true,
      },
      {
        client_id: "client-inactive",
        client_secret_hash: "test_secret_hash_inactive",
        client_name: "Inactive Test Client",
        allowed_redirect_uris: [
          "http://localhost:3001/api/auth/callback",
        ],
        is_active: false,
      },
    ];

    const results = [];

    for (const client of clients) {
      try {
        // Check if client already exists
        const { data: existing, error: checkError } = await supabase
          .from("oauth_clients")
          .select("id")
          .eq("client_id", client.client_id)
          .single();

        if (!existing && !checkError) {
          // Client doesn't exist, insert it
          const { error: insertError } = await supabase
            .from("oauth_clients")
            .insert([client]);

          if (insertError) {
            results.push({
              clientId: client.client_id,
              status: "error",
              error: insertError.message,
            });
          } else {
            results.push({
              clientId: client.client_id,
              status: "created",
            });
          }
        } else if (existing) {
          // Client already exists
          results.push({
            clientId: client.client_id,
            status: "already_exists",
          });
        } else if (checkError?.code === 'PGRST116') {
          // No rows found - this is expected, proceed with insert
          const { error: insertError } = await supabase
            .from("oauth_clients")
            .insert([client]);

          if (insertError) {
            results.push({
              clientId: client.client_id,
              status: "error",
              error: insertError.message,
            });
          } else {
            results.push({
              clientId: client.client_id,
              status: "created",
            });
          }
        } else {
          // Some other error occurred
          results.push({
            clientId: client.client_id,
            status: "error",
            error: checkError?.message || "Unknown error checking if client exists",
          });
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({
          clientId: client.client_id,
          status: "error",
          error: errorMessage,
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "OAuth clients seeding attempted",
        results,
        note: "If all results show table not found error, please run migrations in Supabase SQL Editor",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Failed to seed clients", details: String(error) },
      { status: 500 }
    );
  }
}
