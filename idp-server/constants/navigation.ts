import { NavItem, QuickAction } from "@/types/account";

export const USER_INFO = 'u'
export const NAVIGATION_ITEMS: NavItem[] = [
  {
    icon: "home",
    label: "Home",
    href: `/${USER_INFO}/`,
    color: "blue",
  },
  {
    icon: "person",
    label: "Personal info",
    href: `/${USER_INFO}/personal-info`,
    color: "green",
  },
  {
    icon: "link",
    label: "Connected apps",
    href: `/${USER_INFO}/connected-apps`,
    color: "cyan",
  },
];

export const QUICK_ACTIONS: QuickAction[] = [
  { label: "My password", href: `/${USER_INFO}/security/password` },
  { label: "Devices", href: `/${USER_INFO}/security/devices` },
  { label: "Password Manager", href: `/${USER_INFO}/security/password-manager` },
  { label: "My Activity", href: `/${USER_INFO}/activity` },
  { label: "Email", href: `/${USER_INFO}/email` },
];

export const FOOTER_LINKS = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Help", href: "/help" },
  { label: "About", href: "/about" },
] as const;
