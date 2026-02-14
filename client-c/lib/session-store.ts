/**
 * Server-side session token store (in-memory)
 * Each client app maintains its own sessions
 * Uses global to survive Next.js hot reloads
 */

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
  const entry = tokenStore.get(sessionId);
  if (!entry) {
    console.log(`[SessionStore] ❌ Session not found`);
    return null;
  }
  console.log(`[SessionStore] ✅ Access token found`);
  return entry.accessToken;
}

export async function getRefreshToken(sessionId: string): Promise<string | null> {
  const entry = tokenStore.get(sessionId);
  return entry?.refreshToken || null;
}

export async function deleteSession(sessionId: string): Promise<void> {
  tokenStore.delete(sessionId);
  console.log(
    `[SessionStore] 🗑️  Deleted session: ${sessionId.substring(0, 8)}... (total sessions: ${tokenStore.size})`
  );
}
