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
