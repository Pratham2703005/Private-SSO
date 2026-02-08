import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

/**
 * Development-only endpoint to check OAuth clients in database
 * GET /api/debug/oauth-clients
 */
export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("oauth_clients")
      .select("*");

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch clients", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        count: data ? data.length : 0,
        clients: data,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Exception error", details: String(error) },
      { status: 500 }
    );
  }
}
