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
