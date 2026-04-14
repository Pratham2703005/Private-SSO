import { supabase } from "@/lib/db";

const TTL_MS = 60_000;

const DEV_FALLBACK_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003",
  "http://localhost:3004",
  "https://pratham-sso.vercel.app",
];

type Cache = { origins: string[]; expiresAt: number };
let cache: Cache | null = null;

function toOrigin(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    return new URL(raw.trim()).origin;
  } catch {
    return null;
  }
}

async function loadOrigins(): Promise<string[]> {
  const { data, error } = await supabase
    .from("oauth_clients")
    .select("domain")
    .eq("is_active", true);

  if (error) throw error;

  const origins = new Set<string>();
  for (const row of data ?? []) {
    const origin = toOrigin((row as { domain: unknown }).domain);
    if (origin) origins.add(origin);
  }

  if (origins.size === 0 && process.env.NODE_ENV !== "production") {
    DEV_FALLBACK_ORIGINS.forEach((o) => origins.add(o));
  }

  return Array.from(origins);
}

export async function getAllowedWidgetOrigins(): Promise<string[]> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.origins;

  try {
    const origins = await loadOrigins();
    cache = { origins, expiresAt: now + TTL_MS };
    return origins;
  } catch (err) {
    console.error("[widget-origins] load failed:", err);
    if (cache) return cache.origins;
    return process.env.NODE_ENV !== "production" ? [...DEV_FALLBACK_ORIGINS] : [];
  }
}

export async function isWidgetOriginAllowed(origin: string | null): Promise<boolean> {
  if (!origin) return false;
  const origins = await getAllowedWidgetOrigins();
  return origins.includes(origin);
}

export function invalidateWidgetOriginCache(): void {
  cache = null;
}
