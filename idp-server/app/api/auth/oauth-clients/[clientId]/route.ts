import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { uploadImageIfProvided } from "@/lib/image-upload";
import type { OAuthClient } from "@/types/database";

/**
 * PUT /api/auth/oauth-clients/[clientId]
 * 
 * Update an existing OAuth client configuration
 * Accepts FormData with optional image file
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const contentType = request.headers.get("content-type") || "";
    
    let client_name: string | undefined;
    let domain: string | undefined;
    let allowed_scopes: string | undefined;
    let allowed_redirect_uris: string[] | undefined;
    let imageFile: File | null = null;
    let is_active = true;

    if (contentType.includes("multipart/form-data")) {
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

    // Upload image if provided (new image)
    let imageUrl: string | null = null;
    try {
      imageUrl = await uploadImageIfProvided(imageFile);
    } catch (uploadErr) {
      console.error("[PUT /api/auth/oauth-clients] Image upload error:", uploadErr);
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

    // Update the OAuth client
    interface UpdatePayload {
      client_name: string;
      domain: string;
      allowed_scopes: string;
      allowed_redirect_uris: string[];
      is_active: boolean;
      updated_at: string;
      image?: string | null;
    }

    const updateData: UpdatePayload = {
      client_name,
      domain,
      allowed_scopes: allowed_scopes || "openid profile email",
      allowed_redirect_uris: allowed_redirect_uris || [],
      is_active,
      updated_at: new Date().toISOString(),
    };

    // Only update image if a new one was uploaded
    if (imageUrl) {
      updateData.image = imageUrl;
    }

    const { data, error } = await supabase
      .from("oauth_clients")
      .update(updateData)
      .eq("client_id", clientId)
      .select()
      .single() as { data: OAuthClient | null; error: Error };

    if (error) {
      console.error("[PUT /api/auth/oauth-clients] Supabase error:", error);
      throw new Error(error.message);
    }

    console.log("[PUT /api/auth/oauth-clients] Successfully updated OAuth client");

    return NextResponse.json({
      success: true,
      client: data,
    });
  } catch (error) {
    console.error("[PUT /api/auth/oauth-clients] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
