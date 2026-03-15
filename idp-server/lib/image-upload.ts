import { supabase } from "./db";


/**
 * Image upload configuration and validation
 */
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] as const;

export const IMAGE_CONFIG = {
  MAX_SIZE: 2 * 1024 * 1024, // 2MB
  ALLOWED_TYPES: ALLOWED_MIME_TYPES,
} as const;

/**
 * Validate image file
 * @throws {Error} If validation fails
 */
export function validateImageFile(imageFile: File): void {
  if (!ALLOWED_MIME_TYPES.includes(imageFile.type as typeof ALLOWED_MIME_TYPES[number])) {
    throw new Error(
      `Invalid image type. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`
    );
  }

  if (imageFile.size > IMAGE_CONFIG.MAX_SIZE) {
    throw new Error(
      `Image size exceeds ${IMAGE_CONFIG.MAX_SIZE / 1024 / 1024}MB limit`
    );
  }
}

/**
 * Generate secure filename with UUID
 */
export function generateSecureFilename(originalName: string): string {
  // Extract extension safely
  const ext = originalName.split(".").pop()?.toLowerCase() || "bin";
  // Sanitize extension to prevent directory traversal
  const sanitizedExt = ext.replace(/[^a-z0-9]/g, "");
  return `${crypto.randomUUID()}.${sanitizedExt}`;
}

/**
 * Upload image to Supabase Storage and return public URL
 * @param imageFile - The image file to upload
 * @param bucketName - Supabase bucket name (default: oauth-client-logos)
 * @param folderPath - Folder path in bucket (default: logos)
 * @returns Public URL of uploaded image
 * @throws {Error} If upload fails
 */
export async function uploadImageToSupabase(
  imageFile: File,
  bucketName = "oauth-client-logos",
  folderPath = "logos"
): Promise<string> {
  // Validate image
  validateImageFile(imageFile);

  // Generate secure filename
  const fileName = generateSecureFilename(imageFile.name);
  const filePath = `${folderPath}/${fileName}`;

  try {
    // Convert to Buffer for best compatibility
    const buffer = Buffer.from(await imageFile.arrayBuffer());

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType: imageFile.type,
        upsert: false,
      });

    if (error) {
      console.error("[uploadImageToSupabase] Storage error:", error);
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    if (!data?.path) {
      throw new Error("Upload succeeded but no file path returned");
    }

    // Get public URL
    const { data: publicData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.path);

    if (!publicData?.publicUrl) {
      throw new Error("Failed to generate public URL");
    }

    return publicData.publicUrl;
  } catch (error) {
    console.error("[uploadImageToSupabase] Error:", error);
    throw error;
  }
}

/**
 * Handle optional image upload (returns null if no image provided)
 * Useful for endpoints where image is optional
 */
export async function uploadImageIfProvided(
  imageFile: File | null
): Promise<string | null> {
  if (!imageFile || !(imageFile instanceof File) || imageFile.size === 0) {
    return null;
  }

  try {
    return await uploadImageToSupabase(imageFile);
  } catch (error) {
    console.error("[uploadImageIfProvided] Error:", error);
    throw error;
  }
}
