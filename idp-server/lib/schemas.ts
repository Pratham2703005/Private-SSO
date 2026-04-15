import { z } from "zod";

// Request/Response Schemas
export const LoginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const SignupSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string(),
});

export const SwitchAccountSchema = z.object({
  accountId: z.string().uuid("Invalid account ID"),
});

export const AuthorizeSchema = z.object({
  clientId: z.string(),
  redirectUri: z.string().url("Invalid redirect URI"),
  scopes: z.string().optional(),
  state: z.string().optional(),
});

// Token Payloads
export interface AccessTokenPayload {
  sub: string; // user_id
  email: string;
  name: string;
  accountId: string;
  scopes: string[]; // OAuth 2.0 scopes for authorization
  iat: number;
}

export interface IdTokenPayload {
  sub: string; // user_id
  email: string;
  name: string;
  iat: number;
}

export interface RefreshTokenPayload {
  sub: string; // user_id
  accountId: string;
  clientId: string;
  jti: string; // JWT ID for rotation tracking
  iat: number;
}

// API Response Types
export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      email: string;
      name: string;
      profileImage?: string;
    };
  };
  error?: string;
}

/**
 * OAuth 2.0 Token Response (RFC 6749)
 * Returned by /token endpoint for both authorization_code and refresh_token grants
 */
export interface TokenResponse {
  access_token: string;
  id_token: string;
  refresh_token: string;
  session_id: string;
  session_state: "active" | "inactive";
  token_type: "Bearer";
  expires_in: number; // seconds (3600 = 1 hour, 86400 = 1 day)
  session_bootstrap?: {
    user: { id: string; email: string; name: string };
    account: { id: string; email: string; name: string };
    accounts: Array<{ id: string; email: string; name: string; isPrimary?: boolean }>;
    activeAccountId: string;
  };
}

/**
 * OAuth 2.0 Error Response (RFC 6749)
 * Returned when token exchange fails
 */
export interface TokenErrorResponse {
  error: string;
  error_description?: string;
}

/**
 * Authorization Code Object from Database
 * Stored temporarily during code exchange flow
 */
export interface AuthorizationCode {
  code: string;
  client_id: string;
  user_id: string;
  redirect_uri: string;
  code_challenge: string | null;
  code_challenge_method: string | null;
  scopes: string | null;
  state: string;
  is_redeemed: boolean;
  created_at: string;
  expires_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  profileImage?: string;
  accounts: {
    id: string;
    email: string;
    name: string;
    isPrimary: boolean;
  }[];
}
