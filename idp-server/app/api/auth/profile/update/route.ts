import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  getSession,
  getAccountById,
  supabase,
} from "@/lib/db";
import { isPersonalInfoFieldSlug } from "@/lib/personal-info";
import { PROFILE_SECTION_CONFIG, type PersonalInfoFieldSlug } from "@/constants/personal-info";
import type { UserAccount } from "@/types/database";

// Helper to upload image to Supabase Storage
async function uploadImageToSupabase(
  dataUrl: string,
  accountId: string,
): Promise<string> {
  try {
    // Parse data URL
    const matches = dataUrl.match(/^data:image\/([a-z]+);base64,(.+)$/);
    if (!matches) {
      throw new Error("Invalid image data URL format");
    }

    const [, imageType, base64Data] = matches;
    const buffer = Buffer.from(base64Data, "base64");

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${accountId}/${timestamp}.${imageType}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from("profile-images")
      .upload(filename, buffer, {
        contentType: `image/${imageType}`,
        upsert: false,
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("profile-images").getPublicUrl(data.path);

    return publicUrl;
  } catch (error) {
    console.error("Image upload error:", error);
    throw error;
  }
}

// Validation schemas for each field type
const fieldValidationSchemas: Record<PersonalInfoFieldSlug, z.ZodSchema> = {
  "profile-picture": z.object({
    // Accept either data URLs, uploaded URLs, or null to clear
    value: z.union([
      z.string().refine(
        (val) => val.startsWith("data:image/") || val.startsWith("http") || val === "",
        "Invalid image format"
      ),
      z.null(),
    ]).optional(),
  }),
  name: z.object({
    value: z.string().min(2, "Name must be at least 2 characters").max(255),
  }),
  gender: z.object({
    value: z.enum(["Male", "Female", "Other", "Prefer not to say"]),
  }),
  email: z.object({
    value: z.string().email("Invalid email format"),
  }),
  phone: z.object({
    value: z.string().regex(/^\d{10}$|^\+\d{1,3}\d{6,14}$|^$/, "Invalid phone format").optional(),
  }),
  birthday: z.object({
    value: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  }),
  language: z.object({
    value: z.string().min(2).max(50),
  }),
  "home-address": z.object({
    value: z.string().max(500).optional(),
  }),
  "google-password": z.object({
    value: z.never(), // This field requires custom component handling
  }),
};

/**
 * POST /api/auth/profile/update
 * Updates a specific profile field for the authenticated user's account
 *
 * Request body:
 * {
 *   field: "name" | "gender" | "phone" | ... (PersonalInfoFieldSlug)
 *   value: string | string[] | undefined
 * }
 *
 * Response:
 * {
 *   success: true,
 *   message: "Profile updated successfully",
 *   data: {
 *     field: "name",
 *     value: "New Name",
 *     updatedAccount: {...}
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Get session from cookie
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("__sso_session")?.value;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: No session found" },
        { status: 401 }
      );
    }

    // Validate session
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Invalid session" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { field, value } = body;

    // Validate field slug
    if (!field || !isPersonalInfoFieldSlug(field)) {
      return NextResponse.json(
        { success: false, error: "Invalid field specified" },
        { status: 400 }
      );
    }

    // Get field configuration
    const fieldConfig = PROFILE_SECTION_CONFIG[field];
    if (!fieldConfig) {
      return NextResponse.json(
        { success: false, error: "Field configuration not found" },
        { status: 400 }
      );
    }

    // Check if field requires custom handling
    if (fieldConfig.componentType === "custom") {
      return NextResponse.json(
        {
          success: false,
          error: `Field '${field}' requires custom component handling. Use dedicated endpoint.`,
        },
        { status: 400 }
      );
    }

    // Validate input against field-specific schema
    const validationSchema = fieldValidationSchemas[field];
    const validationResult = validationSchema.safeParse({ value });

    if (!validationResult.success) {
      // Format validation errors for better readability
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
        code: err.code,
      }));

      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: errors,
        },
        { status: 400 }
      );
    }

    // Get current account
    const account = await getAccountById(session.active_account_id);
    if (!account) {
      return NextResponse.json(
        { success: false, error: "Account not found" },
        { status: 404 }
      );
    }

    // Map field slug to database column and prepare update data
    let updateData: Partial<UserAccount> = {};

    switch (field) {
      case "profile-picture":
        // Handle image upload if it's a data URL
        if (value && typeof value === "string" && value.startsWith("data:image/")) {
          try {
            const imageUrl = await uploadImageToSupabase(value, account.id);
            updateData = { profile_image_url: imageUrl };
          } catch (error) {
            return NextResponse.json(
              {
                success: false,
                error: `Failed to upload image: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
              { status: 400 }
            );
          }
        } else if (value) {
          updateData = { profile_image_url: value as string };
        } else {
          updateData = { profile_image_url: null };
        }
        break;
      case "name":
        updateData = { name: value as string };
        break;
      case "gender":
        updateData = { gender: value as string };
        break;
      case "email":
        updateData = { email: value as string };
        break;
      case "phone":
        updateData = { phone: (value as string) || null };
        break;
      case "birthday":
        updateData = { birthday: (value as string) || null };
        break;
      case "language":
        updateData = { language: (value as string) || null };
        break;
      case "home-address":
        updateData = { home_address: (value as string) || null };
        break;
      default:
        return NextResponse.json(
          { success: false, error: "Unsupported field update" },
          { status: 400 }
        );
    }

    // Update database
    const { data: updatedAccount, error } = await supabase
      .from("user_accounts")
      .update(updateData)
      .eq("id", account.id)
      .select()
      .single();

    if (error || !updatedAccount) {
      console.error("Database update error:", error?.message || error);
      return NextResponse.json(
        { 
          success: false, 
          error: error?.message || "Failed to update profile"
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${fieldConfig.label} updated successfully`,
      data: {
        field,
        value,
        updatedAccount,
      },
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
