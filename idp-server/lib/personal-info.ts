import {
  PERSONAL_INFO_ACTION_LABELS,
  PERSONAL_INFO_FIELD_LABELS,
  PERSONAL_INFO_FIELD_SLUGS,
  type PersonalInfoFieldSlug,
} from "@/constants/personal-info";
import type { UserAccount } from "@/types/database";

export interface PersonalInfoDisplayItem {
  slug: PersonalInfoFieldSlug;
  label: string;
  values: string[];
  actionLabel: string;
}

export function isPersonalInfoFieldSlug(value: string): value is PersonalInfoFieldSlug {
  return PERSONAL_INFO_FIELD_SLUGS.includes(value as PersonalInfoFieldSlug);
}

function formatBirthday(rawBirthday: string | null): string {
  if (!rawBirthday) {
    return "Not set";
  }

  const parsedDate = new Date(rawBirthday);
  if (Number.isNaN(parsedDate.getTime())) {
    return rawBirthday;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parsedDate);
}

export function getPersonalInfoValuesBySlug(
  account: UserAccount,
  slug: PersonalInfoFieldSlug,
): string[] {
  switch (slug) {
    case "profile-picture":
      return [account.profile_image_url ? "Picture uploaded" : "Not set"];
    case "name":
      return [account.name || "Not set"];
    case "gender":
      return [account.gender || "Not set"];
    case "email":
      return [account.email || "Not set"];
    case "phone":
      return [account.phone || "Not set"];
    case "birthday":
      return [formatBirthday(account.birthday)];
    case "language":
      return [account.language || "English (United States)"];
    case "home-address":
      return [account.home_address || "Not set"];
    case "work-address":
      return [account.work_address || "Not set"];
    case "other-addresses":
      return ["Not set"];
    case "google-password":
      return ["Last changed Nov 7, 2025"];
    default:
      return ["Not set"];
  }
}

export function buildPersonalInfoDisplayItems(account: UserAccount): PersonalInfoDisplayItem[] {
  return PERSONAL_INFO_FIELD_SLUGS.map((slug) => ({
    slug,
    label: PERSONAL_INFO_FIELD_LABELS[slug],
    values: getPersonalInfoValuesBySlug(account, slug),
    actionLabel: PERSONAL_INFO_ACTION_LABELS[slug],
  }));
}
