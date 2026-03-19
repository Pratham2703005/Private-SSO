import { PROFILE_SECTION_CONFIG, type PersonalInfoFieldSlug } from "@/constants/personal-info";

export interface UpdateProfileFieldParams {
  field: PersonalInfoFieldSlug;
  value: string | string[] | null;
}

export interface UpdateProfileResponse {
  success: boolean;
  message?: string;
  error?: string;
  details?: unknown;
  data?: {
    field: PersonalInfoFieldSlug;
    value: string | string[] | null;
    updatedAccount: unknown;
  };
}

/**
 * Client-side function to update a profile field
 * Calls POST /api/auth/profile/update with field and value
 *
 * Usage:
 * const response = await updateProfileField({
 *   field: 'name',
 *   value: 'John Doe'
 * });
 *
 * if (response.success) {
 *   console.log('Profile updated:', response.data);
 * } else {
 *   console.error('Update failed:', response.error);
 * }
 */
export async function updateProfileField(
  params: UpdateProfileFieldParams
): Promise<UpdateProfileResponse> {
  try {
    const response = await fetch("/api/auth/profile/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    const data: UpdateProfileResponse = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || "Failed to update profile",
        details: data.details,
      };
    }

    return data;
  } catch (error) {
    console.error("Profile update error:", error);
    return {
      success: false,
      error: "Network error or invalid response",
    };
  }
}

/**
 * Get profile section configuration with full path
 * Useful for generating links and component selections
 *
 * Usage:
 * const config = getProfileSectionConfig('name');
 * console.log(config.redirectLink); // '/personal-info/name'
 */
export function getProfileSectionConfig(fieldSlug: PersonalInfoFieldSlug) {
  return PROFILE_SECTION_CONFIG[fieldSlug];
}

/**
 * Get all profile sections with their configurations
 * Useful for rendering settings page with all available sections
 */
export function getAllProfileSectionConfigs() {
  return Object.values(PROFILE_SECTION_CONFIG);
}

/**
 * Get component type for a specific field
 * Helps determine which component to render on the edit page
 */
export function getComponentTypeForField(fieldSlug: PersonalInfoFieldSlug) {
  return PROFILE_SECTION_CONFIG[fieldSlug]?.componentType;
}

/**
 * Check if a field requires reauthentication before update
 */
export function requiresReauthForField(fieldSlug: PersonalInfoFieldSlug): boolean {
  return PROFILE_SECTION_CONFIG[fieldSlug]?.requiresReauth ?? false;
}

/**
 * Get custom component path if field has one
 */
export function getCustomComponentPath(fieldSlug: PersonalInfoFieldSlug): string | undefined {
  return PROFILE_SECTION_CONFIG[fieldSlug]?.customComponentPath;
}
