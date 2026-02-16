import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import crypto from "crypto";

function uuidv4(): string {
  return crypto.randomUUID();
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase credentials not configured");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// User Functions
export async function createUser(
  email: string,
  password: string,
  name: string,
  profileImage?: string
) {
  const userId = uuidv4();
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await supabase.from("users").insert([
    {
      id: userId,
      email,
      password_hash: passwordHash,
      name,
      profile_image_url: profileImage || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]);
  } catch (error) {
    console.error("Error creating user:", error);
    throw error;
  }
  return { id: userId, email, name };
}

export async function getUserByEmail(email: string) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .single();

  if (error) return null;
  return data;
}

export async function getUserById(userId: string) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) return null;
  return data;
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

// Account Functions
export async function createUserAccount(
  userId: string,
  email: string,
  name: string,
  isPrimary: boolean = false
) {
  const accountId = uuidv4();

  try{
    await supabase.from("user_accounts").insert([
      {
        id: accountId,
        user_id: userId,
        email,
        name,
        is_primary: isPrimary,
        created_at: new Date().toISOString(),
      },
    ]);

  }catch(error){
    console.error("Error creating user account:", error);
    throw error;
  }

  return { id: accountId, email, name, isPrimary };
}

export async function getUserAccounts(userId: string) {
  const { data, error } = await supabase
    .from("user_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) return [];
  return data;
}

export async function getAccountById(accountId: string) {
  const { data, error } = await supabase
    .from("user_accounts")
    .select("*")
    .eq("id", accountId)
    .single();

  if (error) return null;
  return data;
}

// Session Functions
export async function createSession(userId: string, accountId?: string) {
  const sessionId = uuidv4();

  try{
    await supabase.from("sessions").insert([
      {
        id: sessionId,
        user_id: userId,
        active_account_id: accountId || null,
        refresh_token_hash: null,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
      },
    ]);

    // If accountId provided, also create session_logons entry
    if (accountId) {
      const { error: logonError } = await supabase
        .from("session_logons")
        .insert([
          {
            session_id: sessionId,
            account_id: accountId,
            logged_in_at: new Date().toISOString(),
            last_active_at: new Date().toISOString(),
            revoked: false,
          },
        ]);

      if (logonError) {
        console.error("[DB] Error creating session logon:", logonError);
        throw logonError;
      }
    }
  }catch(error){
    console.error("Error creating session:", error);
    throw error;
  }

  return sessionId;
}

export async function getSession(sessionId: string) {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error) return null;
  return data;
}

export async function revokeSession(sessionId: string) {
  const { error } = await supabase
    .from("sessions")
    .delete()
    .eq("id", sessionId);

  if (error) throw error;
}

// Refresh Token Functions
// Stage 8: Token rotation with replaced_by_token_hash + used_at tracking

/**
 * Store a new refresh token
 * 30-day expiry, supports rotation chain tracking
 * Supports multiple signatures for backwards compatibility:
 * - storeRefreshToken(userId, accountId, clientId, tokenHash, sessionId)  <- login/signup
 * - storeRefreshToken(userId, clientId, tokenHash, sessionId)             <- token exchange
 */
export async function storeRefreshToken(
  userId: string,
  param2?: string,
  param3?: string,
  param4?: string,
  param5?: string
) {
  // Handle both 3/4-parameter and 5-parameter calls
  let accountId: string | null = null;
  let clientId: string;
  let tokenHash: string;
  let sessionId: string | null = null;

  if (param4 && param4.length === 64) {
    // param4 is likely token hash (SHA256 = 64 chars)
    // Could be: (userId, accountId, clientId, tokenHash) or (userId, accountId, clientId, tokenHash, sessionId)
    accountId = param2 || null; // UUID or null
    clientId = param3 || "";
    tokenHash = param4;
    sessionId = param5 || null;
  } else if (param4 && param4.length < 64) {
    // param4 is sessionId: (userId, clientId, tokenHash, sessionId)
    clientId = param2 || "";
    tokenHash = param3 || "";
    sessionId = param4 || null;
  } else {
    // 3-parameter call: (userId, clientId, tokenHash)
    clientId = param2 || "";
    tokenHash = param3 || "";
    sessionId = null;
  }

  const tokenId = uuidv4();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  try {
    // Note: revoked and revoked_at columns will use their default values if they exist
    const { error } = await supabase.from("refresh_tokens").insert([
      {
        id: tokenId,
        user_id: userId,
        token_hash: tokenHash,
        client_id: clientId,
        account_id: accountId,
        session_id: sessionId,
        expires_at: expiresAt.toISOString(),
        used_at: null,
        replaced_by_token_hash: null,
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) throw error;
  } catch (error) {
    console.error("[DB] Error storing refresh token:", error);
    throw error;
  }

  return tokenId;
}

/**
 * Get refresh token by hash (for validation)
 * Only returns tokens that haven't been used (rotated) or revoked
 */
export async function getRefreshTokenByHash(tokenHash: string) {
  const { data, error } = await supabase
    .from("refresh_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .is("used_at", null) // Only tokens not yet rotated
    .eq("revoked", false) // Only tokens not revoked
    .single();

  if (error) {
    console.log("[DB] Refresh token not found, used, or revoked:", error.message);
    return null;
  }
  return data;
}

/**
 * Mark old token as used and track replacement
 * This prevents replay attacks - old token becomes invalid
 */
export async function rotateRefreshToken(
  oldTokenHash: string,
  newTokenHash: string
) {
  const now = new Date().toISOString();

  try {
    const { error } = await supabase
      .from("refresh_tokens")
      .update({
        used_at: now,
        replaced_by_token_hash: newTokenHash,
      })
      .eq("token_hash", oldTokenHash)
      .is("used_at", null); // Only update if not already used

    if (error) throw error;
  } catch (error) {
    console.error("[DB] Error rotating refresh token:", error);
    throw error;
  }
}

/**
 * Validate refresh token (check expiry, usage, revocation, etc)
 */
export async function validateRefreshToken(tokenHash: string) {
  const token = await getRefreshTokenByHash(tokenHash);
  
  if (!token) {
    return { valid: false, error: "invalid_grant" };
  }

  // Check if expired
  const expiresAt = new Date(token.expires_at);
  if (expiresAt < new Date()) {
    return { valid: false, error: "invalid_grant" };
  }

  // Check if revoked
  if (token.revoked) {
    return { valid: false, error: "invalid_grant" };
  }

  return { valid: true, token };
}

/**
 * Revoke all user tokens (for global logout)
 * Marks all tokens as revoked (different from rotation)
 */
export async function revokeAllUserTokens(userId: string) {
  const now = new Date().toISOString();
  
  try {
    const { error } = await supabase
      .from("refresh_tokens")
      .update({ revoked: true, revoked_at: now })
      .eq("user_id", userId)
      .eq("revoked", false); // Only revoke tokens that aren't already revoked

    if (error) throw error;
    console.log("[DB] ✅ All refresh tokens revoked for user:", userId.substring(0, 8) + "...");
  } catch (error) {
    console.error("[DB] Error revoking user tokens:", error);
    throw error;
  }
}

/**
 * Revoke authorization codes for a user (optional cleanup during logout)
 */
export async function revokeUserAuthorizationCodes(userId: string) {
  try {
    const { error } = await supabase
      .from("authorization_codes")
      .update({ is_redeemed: true })
      .eq("user_id", userId)
      .eq("is_redeemed", false);

    if (error) throw error;
    console.log("[DB] ✅ Authorization codes revoked for user:", userId.substring(0, 8) + "...");
  } catch (error) {
    console.error("[DB] Error revoking authorization codes:", error);
    throw error;
  }
}

export async function getUserProfileWithAccounts(userId: string) {
  const user = await getUserById(userId);
  if (!user) return null;

  const accounts = await getUserAccounts(userId);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    profileImage: user.profile_image_url,
    accounts: accounts.map((acc) => ({
      id: acc.id,
      email: acc.email,
      name: acc.name,
      isPrimary: acc.is_primary,
    })),
  };
}

// OAuth Client Functions
export async function getOAuthClient(clientId: string) {
  try {
    console.log(`[getOAuthClient] Querying oauth_clients for clientId: ${clientId}`);
    
    const { data, error } = await supabase
      .from("oauth_clients")
      .select("*")
      .eq("client_id", clientId)
      .single();

    console.log(`[getOAuthClient] Query result - data:`, !!data, "error:", error?.message || "none");

    if (error) {
      // No rows returned is a valid case (client doesn't exist)
      if (error.message?.includes("no rows") || error.code === "PGRST116") {
        console.log(`[getOAuthClient] No rows found for clientId: ${clientId}`);
        return null;
      }
      // Log other errors but still return null
      console.error("[getOAuthClient] Supabase error:", error);
      return null;
    }

    console.log(`[getOAuthClient] Found client:`, data?.client_id, "is_active:", data?.is_active);
    return data;
  } catch (error) {
    console.error("[getOAuthClient] Exception error:", error);
    return null;
  }
}

// Authorization Code Functions
export async function createAuthorizationCode(
  userId: string,
  clientId: string,
  redirectUri: string,
  codeChallenge: string | null, // Optional: PKCE not required for backward compatibility
  state: string,
  scopes: string[],
  ttlSeconds: number = 600 // Default 10 minutes, can be overridden for testing
) {
  const code = uuidv4();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  try {
    console.log('[createAuthorizationCode] Attempting to insert:', {
      code: code.substring(0, 8) + '...',
      clientId,
      userId: userId.substring(0, 8) + '...',
      ttlSeconds,
      expiresAt: expiresAt.toISOString(),
      codeChallenge: codeChallenge ? 'provided' : 'not provided',
    });

    const rowToInsert = {
      code,
      client_id: clientId,
      user_id: userId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge || "", // Use empty string instead of null for DB compatibility
      code_challenge_method: "S256",
      state,
      scopes,
      expires_at: expiresAt.toISOString(),
      is_redeemed: false,
    };

    console.log('[createAuthorizationCode] � FULL ROW TO INSERT:');
    console.log(JSON.stringify(rowToInsert, null, 2));

    const { data, error } = await supabase
      .from("authorization_codes")
      .insert([rowToInsert])
      .select()
      .single();

    if (error) {
      console.error("[createAuthorizationCode] ❌ Supabase insert error:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      console.error("[createAuthorizationCode] ❌ Insert data was:", JSON.stringify(rowToInsert, null, 2));
      return null;
    }

    console.log("[createAuthorizationCode] ✅ INSERT SUCCEEDED");
    console.log("[createAuthorizationCode] 📝 Inserted data returned:", JSON.stringify(data, null, 2));

    console.log(`[createAuthorizationCode] ✅ Insert succeeded`);
    console.log('[createAuthorizationCode] 📝 CODE CREATED:', code);
    console.log('[createAuthorizationCode] 📝 CODE LENGTH:', code.length);
    console.log('[createAuthorizationCode] 📝 CODE BYTES:', Buffer.from(code).toString('hex').substring(0, 40) + "...");
    console.log('[createAuthorizationCode] 📝 CODE FIRST 10 CHARS:', code.substring(0, 10));
    
    // Verify it was actually stored by querying it back immediately
    console.log('[createAuthorizationCode] Verifying code was stored with exact lookup...');
    const { data: verifyData, error: verifyError } = await supabase
      .from("authorization_codes")
      .select("code, client_id, redirect_uri, code_challenge")
      .eq("code", code);
    
    if (verifyError) {
      console.error('[createAuthorizationCode] ❌ Query error on verification:', {
        code_short: code.substring(0, 8) + '...',
        full_code: code,
        error_message: verifyError.message,
        error_code: verifyError.code,
        error_details: verifyError.details,
      });
      return null;
    }
    
    if (!verifyData || verifyData.length === 0) {
      console.error('[createAuthorizationCode] ❌ Verification failed: Code inserted but query returned no rows', {
        code: code,
        rowCount: verifyData?.length || 0,
      });
      return null;
    }
    
    // CRITICAL: Verify the returned code matches what we inserted
    const retrievedCode = verifyData[0].code;
    if (retrievedCode !== code) {
      console.error('[createAuthorizationCode] ❌ MISMATCH: Inserted code ≠ Retrieved code', {
        inserted: code,
        retrieved: retrievedCode,
      });
      return null;
    }
    
    console.log('[createAuthorizationCode] ✅ Verification successful:', {
      code: verifyData[0].code,
      client_id: verifyData[0].client_id,
      redirect_uri: verifyData[0].redirect_uri,
      code_challenge_length: verifyData[0].code_challenge ? verifyData[0].code_challenge.length : 0,
      code_challenge_first_20: verifyData[0].code_challenge ? verifyData[0].code_challenge.substring(0, 20) + "..." : "(empty)",
    });
    
    return code;
  } catch (error) {
    console.error("[createAuthorizationCode] ❌ Exception:", error);
    return null;
  }
}

export async function getAuthorizationCode(code: string) {
  try {
    console.log('[getAuthorizationCode] 🔍 SEARCHING for code:');
    console.log('[getAuthorizationCode]   Code:', code);
    console.log('[getAuthorizationCode]   Length:', code.length);
    console.log('[getAuthorizationCode]   First 20:', code.substring(0, 20));
    
    const { data, error } = await supabase
      .from("authorization_codes")
      .select("*")
      .eq("code", code);

    if (error) {
      console.error("[getAuthorizationCode] ❌ QUERY ERROR:", {
        code: code.substring(0, 8) + '...',
        error_message: error.message,
        error_code: error.code,
        error_details: error.details,
      });
      return null;
    }

    if (!data || data.length === 0) {
      console.error("[getAuthorizationCode] ❌ NOT FOUND: No rows matched query", {
        searched_for: code,
        searched_length: code.length,
        rows_returned: 0,
      });
      return null;
    }

    const authCode = data[0];
    console.log("[getAuthorizationCode] ✅ FOUND! Code details:");
    console.log("[getAuthorizationCode]   Found code:", authCode.code);
    console.log("[getAuthorizationCode]   Match:", authCode.code === code ? "✅ EXACT MATCH" : "❌ MISMATCH");
    console.log("[getAuthorizationCode]   Client ID:", authCode.client_id);
    console.log("[getAuthorizationCode]   Is redeemed:", authCode.is_redeemed);
    console.log("[getAuthorizationCode]   Expires at (raw):", authCode.expires_at);

    // Check if expired - CRITICAL: Ensure expires_at is parsed as UTC
    // If expires_at doesn't have 'Z', add it to ensure UTC parsing
    const expiresAtString = authCode.expires_at.endsWith('Z') 
      ? authCode.expires_at 
      : authCode.expires_at + 'Z';
    
    const now = new Date();
    const expiresAt = new Date(expiresAtString);
    
    console.log("[getAuthorizationCode] ⏱️  Time check:");
    console.log("[getAuthorizationCode]   Raw expires_at:", authCode.expires_at);
    console.log("[getAuthorizationCode]   Parsed expires_at:", expiresAtString);
    console.log("[getAuthorizationCode]   Now:", now.toISOString());
    console.log("[getAuthorizationCode]   Expires (parsed):", expiresAt.toISOString());
    console.log("[getAuthorizationCode]   Expired:", expiresAt < now ? "YES ❌" : "NO ✅");

    if (expiresAt < now) {
      console.log("[getAuthorizationCode] ❌ CODE EXPIRED");
      return null;
    }

    // Check if already redeemed
    if (authCode.is_redeemed) {
      console.log("[getAuthorizationCode] ❌ CODE ALREADY REDEEMED (single-use violation)");
      return null;
    }

    console.log("[getAuthorizationCode] ✅✅ CODE IS VALID");
    return authCode;
  } catch (error) {
    console.error("[getAuthorizationCode] ❌ EXCEPTION:", {
      error: error,
      message: (error as Error)?.message ,
    });
    return null;
  }
}

export async function markAuthorizationCodeAsRedeemed(code: string) {
  try {
    const { error } = await supabase
      .from("authorization_codes")
      .update({ is_redeemed: true })
      .eq("code", code);

    if (error) {
      console.error("[markAuthorizationCodeAsRedeemed] Error:", error.message);
      return false;
    }

    console.log("[markAuthorizationCodeAsRedeemed] Marked code as redeemed:", code);
    return true;
  } catch (error) {
    console.error("[markAuthorizationCodeAsRedeemed] Exception:", error);
    return false;
  }
}

// ============================================================================
// Stage 11: Account Switching Functions
// ============================================================================

/**
 * Update session to include initial account
 * Called during session creation to link account
 */
export async function updateSessionWithAccount(
  sessionId: string,
  accountId: string
) {
  try {
    const { error } = await supabase
      .from("sessions")
      .update({ active_account_id: accountId })
      .eq("id", sessionId);

    if (error) throw error;
    console.log("[DB] ✅ Session updated with account:", accountId.substring(0, 8) + "...");
  } catch (error) {
    console.error("[DB] Error updating session with account:", error);
    throw error;
  }
}

/**
 * Add an account to session's logons (multiple accounts logged in)
 * If account already logged in, this is idempotent (UNIQUE constraint prevents duplicates)
 */
export async function addAccountToSession(
  sessionId: string,
  accountId: string
) {
  try {
    // Try to insert new logon entry
    const { error } = await supabase
      .from("session_logons")
      .insert([
        {
          session_id: sessionId,
          account_id: accountId,
          logged_in_at: new Date().toISOString(),
          last_active_at: new Date().toISOString(),
          revoked: false,
        },
      ])

    // UNIQUE constraint violation means account already in session
    // It may be revoked from a previous sign-out — un-revoke it
    if (error) {
      if (error.code === "23505" || error.message?.includes("unique")) {
        console.log("[DB] ℹ️  Account already in session logons, un-revoking if needed");
        await supabase
          .from("session_logons")
          .update({
            revoked: false,
            revoked_at: null,
            last_active_at: new Date().toISOString(),
          })
          .eq("session_id", sessionId)
          .eq("account_id", accountId);
      } else {
        console.error("[DB] Error adding account to session:", error);
        throw error;
      }
    }

    // Always update active_account_id to the newly added/re-added account
    await supabase
      .from("sessions")
      .update({ active_account_id: accountId })
      .eq("id", sessionId);

    console.log("[DB] ✅ Account added to session and set as active:", accountId.substring(0, 8) + "...");
  } catch (error) {
    // Check if it's a UNIQUE constraint error (account already logged in)
    const errorMessage = (error as Error)?.message || "";
    if (errorMessage.includes("unique") || errorMessage.includes("UNIQUE")) {
      console.log("[DB] ℹ️  Account already in session logons (UNIQUE constraint)");
      // Still un-revoke and set as active
      await supabase
        .from("session_logons")
        .update({
          revoked: false,
          revoked_at: null,
          last_active_at: new Date().toISOString(),
        })
        .eq("session_id", sessionId)
        .eq("account_id", accountId);
      await supabase
        .from("sessions")
        .update({ active_account_id: accountId })
        .eq("id", sessionId);
      return;
    }
    console.error("[DB] Error adding account to session:", error);
    throw error;
  }
}

/**
 * Get all accounts logged into this session
 * Returns all logons regardless of revocation status
 */
export async function getSessionLogons(sessionId: string) {
  try {
    const { data, error } = await supabase
      .from("session_logons")
      .select(
        `
        id,
        account_id,
        logged_in_at,
        last_active_at,
        revoked,
        revoked_at,
        user_accounts(id, email, name, is_primary)
      `
      )
      .eq("session_id", sessionId)
      .order("last_active_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("[DB] Error getting session logons:", error);
    return [];
  }
}

/**
 * Get active (non-revoked) accounts in session
 * Used for accounts list and finding next-active account
 * Optimized with index(session_id, revoked)
 */
export async function getActiveSessionLogons(sessionId: string) {
  try {
    const { data, error } = await supabase
      .from("session_logons")
      .select(
        `
        id,
        account_id,
        logged_in_at,
        last_active_at,
        revoked,
        user_accounts(id, email, name)
      `
      )
      .eq("session_id", sessionId)
      .eq("revoked", false)
      .order("last_active_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("[DB] Error getting active session logons:", error);
    return [];
  }
}

/**
 * Switch the currently active account in the session
 * Updates active_account_id and last_active_at for the account
 */
export async function switchActiveAccount(
  sessionId: string,
  accountId: string
) {
  try {
    // Update session's active account
    const { error: updateSessionError } = await supabase
      .from("sessions")
      .update({ active_account_id: accountId })
      .eq("id", sessionId);

    if (updateSessionError) throw updateSessionError;

    // Update last_active_at for this logon
    const { error: updateLogonError } = await supabase
      .from("session_logons")
      .update({ last_active_at: new Date().toISOString() })
      .eq("session_id", sessionId)
      .eq("account_id", accountId);

    if (updateLogonError) throw updateLogonError;

    console.log(
      "[DB] ✅ Switched active account:",
      accountId.substring(0, 8) + "..."
    );
  } catch (error) {
    console.error("[DB] Error switching active account:", error);
    throw error;
  }
}

/**
 * Mark a logon as revoked (per-account logout)
 * Prevents this account from accessing tokens in this session
 */
export async function markLogonRevoked(
  sessionId: string,
  accountId: string
) {
  try {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("session_logons")
      .update({ revoked: true, revoked_at: now })
      .eq("session_id", sessionId)
      .eq("account_id", accountId);

    if (error) throw error;
    console.log(
      "[DB] ✅ Marked logon as revoked:",
      accountId.substring(0, 8) + "..."
    );
  } catch (error) {
    console.error("[DB] Error marking logon revoked:", error);
    throw error;
  }
}

/**
 * Revoke refresh tokens PRECISELY for a specific account + session
 * Revocation is scoped to: user_id + account_id + session_id (+ optional client_id)
 * This prevents blast radius of revocation affecting other sessions/accounts
 */
export async function revokeAccountTokensPrecise(
  userId: string,
  accountId: string,
  sessionId: string,
  clientId?: string
) {
  try {
    const now = new Date().toISOString();
    let query = supabase
      .from("refresh_tokens")
      .update({ revoked: true, revoked_at: now })
      .eq("user_id", userId)
      .eq("account_id", accountId)
      .eq("session_id", sessionId)
      .eq("revoked", false); // Only revoke tokens that aren't already revoked

    // Optional: scope to specific client
    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    const { error } = await query;

    if (error) throw error;
    console.log(
      "[DB] ✅ Revoked account tokens:",
      userId.substring(0, 8) + "... | " + accountId.substring(0, 8) + "..."
    );
  } catch (error) {
    console.error("[DB] Error revoking account tokens:", error);
    throw error;
  }
}
