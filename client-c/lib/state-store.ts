/**
 * CSRF State Store
 * Stores generated state values to prevent CSRF attacks
 * State must match between authorize redirect and callback
 */

declare global {
  var stateStore: Map<string, { state: string; expiresAt: number }>;
}

if (!global.stateStore) {
  global.stateStore = new Map();
}

const stateStore = global.stateStore;

export function storeState(state: string, expiresInSeconds: number = 600): void {
  stateStore.set(state, {
    state,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  });
  console.log(`[StateStore] ✅ Stored state: ${state.substring(0, 8)}... (total: ${stateStore.size})`);
}

export function validateState(state: string): boolean {
  const stored = stateStore.get(state);
  
  if (!stored) {
    console.log(`[StateStore] ❌ State not found: ${state.substring(0, 8)}...`);
    return false;
  }

  if (stored.expiresAt < Date.now()) {
    console.log(`[StateStore] ⏱️ State expired: ${state.substring(0, 8)}...`);
    stateStore.delete(state);
    return false;
  }

  console.log(`[StateStore] ✅ State valid: ${state.substring(0, 8)}...`);
  stateStore.delete(state); // Consume state (one-time use)
  return true;
}

export function cleanupExpiredStates(): void {
  const now = Date.now();
  const before = stateStore.size;
  
  for (const [state, data] of stateStore.entries()) {
    if (data.expiresAt < now) {
      stateStore.delete(state);
    }
  }
  
  if (stateStore.size < before) {
    console.log(`[StateStore] 🧹 Cleaned up ${before - stateStore.size} expired states`);
  }
}
