import { NextResponse } from "next/server";
import { getConnectedApps } from "@/lib/db";

/**
 * GET /api/auth/connected-apps
 * Fetch all active OAuth clients for the connected-apps UI
 * Returns enriched client data with domain extracted from redirect URIs
 */
export async function GET() {
  try {
    const clients = await getConnectedApps();

    // Enrich clients with domain extraction
    const enrichedClients = clients.map((client) => {
      // Use stored domain, or extract from first allowed redirect URI
      let domain = client.domain || "Unknown";
      if (!client.domain && client.allowed_redirect_uris && Array.isArray(client.allowed_redirect_uris)) {
        const firstUri = client.allowed_redirect_uris[0];
        if (firstUri) {
          try {
            const url = new URL(firstUri);
            domain = url.hostname;
          } catch {
            domain = firstUri;
          }
        }
      }

      // Parse scopes from CSV format (space-separated or comma-separated)
      const scopes = (client.allowed_scopes || "")
        .split(/[\s,]+/)
        .filter((scope: string) => scope.trim().length > 0);

      return {
        id: client.id,
        client_id: client.client_id,
        client_name: client.client_name || "Unnamed App",
        image: client.image,
        domain,
        scopes,
        is_active: client.is_active,
        created_at: client.created_at,
      };
    });

    return NextResponse.json({
      success: true,
      apps: enrichedClients,
    });
  } catch (error) {
    console.error("[connected-apps] Exception error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch connected apps",
      },
      { status: 500 }
    );
  }
}
