/**
 * Server-side session token store (in-memory)
 * Each client app maintains its own sessions
 * Uses global to survive Next.js hot reloads
 */

// Use global to persist across hot reloads in development
declare global {
  var tokenStore: Map<string, { accessToken: string; refreshToken?: string; expiresAt: number }>;
}

if (!global.tokenStore) {
  global.tokenStore = new Map();
}

const tokenStore = global.tokenStore;

export async function storeAccessToken(
  sessionId: string,
  accessToken: string,
  expiresIn: number = 24 * 60 * 60 * 1000 // 1 day
): Promise<void> {
  const existing = tokenStore.get(sessionId);
  tokenStore.set(sessionId, {
    accessToken,
    refreshToken: existing?.refreshToken,
    expiresAt: Date.now() + expiresIn,
  });
  console.log(
    `[SessionStore] ✅ Stored access_token for sessionId: ${sessionId.substring(0, 8)}... (total sessions: ${tokenStore.size})`
  );
}

export async function storeRefreshToken(
  sessionId: string,
  refreshToken: string
): Promise<void> {
  const existing = tokenStore.get(sessionId);
  tokenStore.set(sessionId, {
    accessToken: existing?.accessToken || "",
    refreshToken,
    expiresAt: existing?.expiresAt || Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  });
  console.log(
    `[SessionStore] ✅ Stored refresh_token for sessionId: ${sessionId.substring(0, 8)}... (total sessions: ${tokenStore.size})`
  );
}

export async function getAccessToken(sessionId: string): Promise<string | null> {
  console.log(`[SessionStore] Looking for sessionId: ${sessionId.substring(0, 8)}... (available: ${Array.from(tokenStore.keys()).map(id => id.substring(0, 8)).join(', ')})`);
  
  const token = tokenStore.get(sessionId);
  if (!token) {
    console.log(`[SessionStore] ❌ No token found for sessionId: ${sessionId.substring(0, 8)}...`);
    return null;
  }

  if (token.expiresAt < Date.now()) {
    console.log(`[SessionStore] ⏱️ Token expired for sessionId: ${sessionId.substring(0, 8)}...`);
    tokenStore.delete(sessionId);
    return null;
  }

  console.log(`[SessionStore] ✅ Access token found for sessionId: ${sessionId.substring(0, 8)}...`);
  return token.accessToken;
}

export async function getRefreshToken(sessionId: string): Promise<string | null> {
  const token = tokenStore.get(sessionId);
  if (!token || !token.refreshToken) {
    console.log(`[SessionStore] ❌ No refresh_token found for sessionId: ${sessionId.substring(0, 8)}...`);
    return null;
  }

  console.log(`[SessionStore] ✅ Refresh token found for sessionId: ${sessionId.substring(0, 8)}...`);
  return token.refreshToken;
}

export async function clearSession(sessionId: string): Promise<void> {
  tokenStore.delete(sessionId);
  console.log(`[SessionStore] ✅ Cleared session: ${sessionId.substring(0, 8)}... (remaining: ${tokenStore.size})`);
}
