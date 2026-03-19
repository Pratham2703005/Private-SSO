import type { UserAccount } from "@/types/database";

export const PERSONAL_INFO_FIELD_SLUGS = [
  "profile-picture",
  "name",
  "gender",
  "email",
  "phone",
  "birthday",
  "language",
  "home-address",
  "work-address",
  "other-addresses",
  "google-password",
] as const;

export type PersonalInfoFieldSlug = (typeof PERSONAL_INFO_FIELD_SLUGS)[number];

export const PERSONAL_INFO_FIELD_LABELS: Record<PersonalInfoFieldSlug, string> = {
  "profile-picture": "Profile picture",
  name: "Name",
  gender: "Gender",
  email: "Email",
  phone: "Phone",
  birthday: "Birthday",
  language: "Language",
  "home-address": "Home address",
  "work-address": "Work address",
  "other-addresses": "Other addresses",
  "google-password": "Google Password",
};

export const PERSONAL_INFO_ACTION_LABELS: Record<PersonalInfoFieldSlug, string> = {
  "profile-picture": "Update",
  name: "Edit",
  gender: "Edit",
  email: "Manage",
  phone: "Edit",
  birthday: "Edit",
  language: "Edit",
  "home-address": "Edit",
  "work-address": "Edit",
  "other-addresses": "Manage",
  "google-password": "Change",
};

// Profile Section Configuration
export interface ProfileSectionConfig {
  slug: PersonalInfoFieldSlug;
  redirectLink: string;
  label: string;
  actionLabel: string;
  componentType: "text-input" | "select" | "date-picker" | "image-upload" | "custom";
  updateField: keyof UserAccount;
  requiresReauth?: boolean;
  customComponentPath?: string;
}

export const PROFILE_SECTION_CONFIG: Record<PersonalInfoFieldSlug, ProfileSectionConfig> = {
  "profile-picture": {
    slug: "profile-picture",
    redirectLink: "/personal-info/profile-picture",
    label: "Profile picture",
    actionLabel: "Update",
    componentType: "image-upload",
    updateField: "profile_image_url",
  },
  name: {
    slug: "name",
    redirectLink: "/personal-info/name",
    label: "Name",
    actionLabel: "Edit",
    componentType: "text-input",
    updateField: "name",
  },
  gender: {
    slug: "gender",
    redirectLink: "/personal-info/gender",
    label: "Gender",
    actionLabel: "Edit",
    componentType: "select",
    updateField: "gender",
  },
  email: {
    slug: "email",
    redirectLink: "/personal-info/email",
    label: "Email",
    actionLabel: "Manage",
    componentType: "custom",
    updateField: "email",
    requiresReauth: true,
    customComponentPath: "@/components/account/email-manager",
  },
  phone: {
    slug: "phone",
    redirectLink: "/personal-info/phone",
    label: "Phone",
    actionLabel: "Edit",
    componentType: "text-input",
    updateField: "phone",
  },
  birthday: {
    slug: "birthday",
    redirectLink: "/personal-info/birthday",
    label: "Birthday",
    actionLabel: "Edit",
    componentType: "date-picker",
    updateField: "birthday",
  },
  language: {
    slug: "language",
    redirectLink: "/personal-info/language",
    label: "Language",
    actionLabel: "Edit",
    componentType: "select",
    updateField: "language",
  },
  "home-address": {
    slug: "home-address",
    redirectLink: "/personal-info/home-address",
    label: "Home address",
    actionLabel: "Edit",
    componentType: "text-input",
    updateField: "home_address",
  },
  "work-address": {
    slug: "work-address",
    redirectLink: "/personal-info/work-address",
    label: "Work address",
    actionLabel: "Edit",
    componentType: "text-input",
    updateField: "work_address",
  },
  "other-addresses": {
    slug: "other-addresses",
    redirectLink: "/personal-info/other-addresses",
    label: "Other addresses",
    actionLabel: "Manage",
    componentType: "custom",
    updateField: "home_address", // Placeholder, custom handling required
    customComponentPath: "@/components/account/addresses-manager",
  },
  "google-password": {
    slug: "google-password",
    redirectLink: "/personal-info/google-password",
    label: "Google Password",
    actionLabel: "Change",
    componentType: "custom",
    updateField: "email", // Placeholder, custom handling required
    requiresReauth: true,
    customComponentPath: "@/components/account/password-manager",
  },
};
