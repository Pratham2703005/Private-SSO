/**
 * Database types barrel export
 * Prevents deep index access throughout codebase
 * Auto-generated from lib/database.types.ts
 */
import type { Database } from "@/lib/database.types";

// Base row types
export type User = Database["public"]["Tables"]["users"]["Row"];
export type UserAccount = Database["public"]["Tables"]["user_accounts"]["Row"];
export type Session = Database["public"]["Tables"]["sessions"]["Row"];
export type SessionLogon = Database["public"]["Tables"]["session_logons"]["Row"];
export type RefreshToken = Database["public"]["Tables"]["refresh_tokens"]["Row"];
export type AuthorizationCode = Database["public"]["Tables"]["authorization_codes"]["Row"];
export type OAuthClient = Database["public"]["Tables"]["oauth_clients"]["Row"];
export type Grant = Database["public"]["Tables"]["grants"]["Row"];
export type CSRFToken = Database["public"]["Tables"]["csrf_tokens"]["Row"];

// Composed types for relationship-based queries
// These are used when selecting with `.select('*, relation(...)')`

/**
 * SessionLogon with nested user account data (from getSessionLogons)
 * When selecting `user_accounts(id, email, name, is_primary)`, returns single object
 */
export type SessionLogonWithAllFields = SessionLogon & {
  user_accounts: {
    id: string;
    email: string;
    name: string;
    is_primary: boolean | null;
  } | null;
};

/**
 * SessionLogon with nested user account data (from getActiveSessionLogons)
 * When selecting `user_accounts(id, email, name)`, returns single object
 */
export type SessionLogonWithAccount = SessionLogon & {
  user_accounts: {
    id: string;
    email: string;
    name: string;
  } | null;
};

/**
 * Safe user account for responses
 * Excludes sensitive fields from full row
 */
export type SafeUserAccount = Pick<
  UserAccount,
  "id" | "email" | "name" | "is_primary" | "created_at"
>;

/**
 * Safe user profile
 * Excludes password_hash and other sensitive fields
 */
export type SafeUser = Pick<
  User,
  "id" | "email" | "created_at" | "updated_at"
>;

/**
 * Authorization code response
 * Full row with all fields
 */
export type AuthCodeRow = AuthorizationCode;
