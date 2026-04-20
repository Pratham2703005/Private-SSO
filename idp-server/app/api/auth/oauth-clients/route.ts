import { NextRequest, NextResponse } from "next/server";
import { createOAuthClient, getSession } from "@/lib/db";
import { getMasterCookie } from "@/lib/utils";
import { uploadImageIfProvided } from "@/lib/image-upload";

/**
 * POST /api/auth/oauth-clients
 *
 * Create a new OAuth client configuration.
 * Requires an authenticated IdP session cookie or a matching ADMIN_API_KEY header.
 */
export async function POST(request: NextRequest) {
  try {
    const adminKey = process.env.ADMIN_API_KEY;
    const providedAdminKey = request.headers.get("x-admin-key");
    const isAdminRequest = !!adminKey && !!providedAdminKey && providedAdminKey === adminKey;

    if (!isAdminRequest) {
      const sessionId = getMasterCookie(request);
      if (!sessionId) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
      const session = await getSession(sessionId);
      if (!session || (session.expires_at && new Date(session.expires_at) < new Date())) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
    }

    const contentType = request.headers.get("content-type") || "";
    let client_name: string | undefined;
    let domain: string | undefined;
    let allowed_scopes: string | undefined;
    let allowed_redirect_uris: string[] | undefined;
    let imageFile: File | null = null;

    let is_active = true;
    if (contentType.includes("multipart/form-data")) {
      // Handle FormData
      const formData = await request.formData();
      client_name = formData.get("client_name") as string;
      domain = formData.get("domain") as string;
      allowed_scopes = formData.get("allowed_scopes") as string;
      const urisString = formData.get("allowed_redirect_uris") as string;
      
      // Safely extract image file
      const image = formData.get("image");
      if (image instanceof File) {
        imageFile = image;
      }
      
      const isActiveString = formData.get("is_active") as string;
      is_active = isActiveString !== "false";

      // Parse redirect URIs from string
      if (urisString) {
        allowed_redirect_uris = urisString
          .split("\n")
          .map((uri) => uri.trim())
          .filter((uri) => uri.length > 0);
      }
    } else {
      // Handle JSON (backward compatibility)
      const body = await request.json();
      client_name = body.client_name;
      domain = body.domain;
      allowed_scopes = body.allowed_scopes;
      allowed_redirect_uris = body.allowed_redirect_uris;
      is_active = body.is_active !== false;
    }

    // Validate required fields
    if (!client_name || !domain || !allowed_redirect_uris) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: client_name, domain, allowed_redirect_uris",
        },
        { status: 400 }
      );
    }

    // Validate that redirect_uris is an array
    if (!Array.isArray(allowed_redirect_uris)) {
      return NextResponse.json(
        {
          success: false,
          error: "allowed_redirect_uris must be an array",
        },
        { status: 400 }
      );
    }

    // Upload image if provided
    let imageUrl: string | null = null;
    try {
      imageUrl = await uploadImageIfProvided(imageFile);
    } catch (uploadErr) {
      console.error("[POST /api/auth/oauth-clients] Image upload error:", uploadErr);
      return NextResponse.json(
        {
          success: false,
          error: uploadErr instanceof Error 
            ? uploadErr.message 
            : "Image upload failed",
        },
        { status: 400 }
      );
    }

    // Create the OAuth client
    const oauthClient = await createOAuthClient({
      client_name,
      domain,
      image: imageUrl,
      allowed_scopes: allowed_scopes || "openid profile email",
      allowed_redirect_uris,
      is_active,
    });

    return NextResponse.json({
      success: true,
      client: oauthClient,
    });
  } catch (error) {
    console.error("[POST /api/auth/oauth-clients] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
