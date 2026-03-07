export interface User {
  id: string;
  email: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface Session {
  id: string;
  user_id: string;
  created_at: string;
  revoked_at: string | null;
}

export interface NavItem {
  icon: string;
  label: string;
  href: string;
  color: NavItemColor;
}

export type NavItemColor =
  | "blue"
  | "green"
  | "cyan"
  | "purple"
  | "pink"
  | "orange"
  | "yellow";

export interface QuickAction {
  label: string;
  href: string;
}
