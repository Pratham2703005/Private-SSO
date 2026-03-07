/**
 * CSRF State Store - Signed Cookie Strategy
 * 
 * PRODUCTION-SAFE: Stores OAuth state in signed HttpOnly cookies instead of in-memory Map
 * Benefits:
 * - ✅ Scales across multiple instances (no server affinity required)
 * - ✅ Survives process restarts
 * - ✅ Works on serverless/load-balanced deployments
 * - ✅ Automatic expiry (no cleanup needed)
 * 
 * Strategy: Sign state with HMAC-SHA256, embed signature in cookie value
 * On validate: Verify signature matches the state value
 */

import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const SECRET = process.env.NEXT_PUBLIC_OAUTH_STATE_SECRET!;

if (!process.env.NEXT_PUBLIC_OAUTH_STATE_SECRET && process.env.NODE_ENV === "production") {
  console.warn(
    "[StateStore] ⚠️  NEXT_PUBLIC_OAUTH_STATE_SECRET not set. Set NEXT_PUBLIC_OAUTH_STATE_SECRET in .env.production for proper security."
  );
}

/**
 * Store state in a signed HttpOnly cookie
 * Format: state.signature (where signature = HMAC-SHA256(secret, state))
 */
export function storeState(state: string, response: NextResponse, expiresInSeconds: number = 600): void {
  // Sign the state value
  const signature = createHmac("sha256", SECRET).update(state).digest("hex");
  const signedValue = `${state}.${signature}`;

  response.cookies.set({
    name: "oauth_state",
    value: signedValue,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: expiresInSeconds,
    path: "/",
  });

  console.log(`[StateStore] ✅ Stored state in signed cookie: ${state.substring(0, 8)}...`);
}

/**
 * Validate state by verifying cookie signature and comparing state value
 * Automatically deletes the cookie after validation (one-time use)
 */
export function validateState(state: string, request: NextRequest, response?: NextResponse): boolean {
  const signedValue = request.cookies.get("oauth_state")?.value;

  if (!signedValue) {
    console.log(`[StateStore] ❌ State cookie not found`);
    return false;
  }

  const [storedState, signature] = signedValue.split(".");

  if (!storedState || !signature) {
    console.log(`[StateStore] ❌ Invalid state cookie format`);
    return false;
  }

  // Verify signature
  const expectedSignature = createHmac("sha256", SECRET).update(storedState).digest("hex");

  if (signature !== expectedSignature) {
    console.log(`[StateStore] ❌ State cookie signature invalid (tampering detected?)`);
    return false;
  }

  // Verify state parameter matches
  if (storedState !== state) {
    console.log(`[StateStore] ❌ State mismatch: ${storedState.substring(0, 8)}... !== ${state.substring(0, 8)}...`);
    return false;
  }

  console.log(`[StateStore] ✅ State valid: ${state.substring(0, 8)}...`);

  // Consume cookie (one-time use) if response provided
  if (response) {
    response.cookies.delete("oauth_state");
  }

  return true;
}

/**
 * Delete state cookie (cleanup helper)
 */
export function deleteState(response: NextResponse): void {
  response.cookies.delete("oauth_state");
  console.log(`[StateStore] 🗑️  Deleted state cookie`);
}
