import { DEFAULT_CONFIG, API_PATHS } from '../shared';
import type { SessionData } from '../shared';

export interface GetSSOUserOptions {
  idpServer?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface GetSSOUserResult {
  authenticated: boolean;
  sessionId?: string;
  session?: SessionData;
  error?: string;
}

/**
 * Server-side helper for Next.js: reads the __sso_session cookie and resolves the user from the IdP.
 * Removes the need for client apps to hand-roll their own `requireAuth` or `getCurrentUser`.
 *
 * Usage (App Router):
 *   import { cookies } from 'next/headers'
 *   import { getSSOUser } from 'pratham-sso/server'
 *
 *   const cookieStore = await cookies()
 *   const result = await getSSOUser(
 *     cookieStore.get('__sso_session')?.value,
 *     { idpServer: process.env.NEXT_PUBLIC_IDP_SERVER }
 *   )
 */
export async function getSSOUser(
  sessionId: string | undefined,
  options: GetSSOUserOptions = {}
): Promise<GetSSOUserResult> {
  if (!sessionId) {
    return { authenticated: false, error: 'No session cookie' };
  }

  const idpServer = options.idpServer || (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_IDP_SERVER : undefined);
  if (!idpServer) {
    return { authenticated: false, error: 'idpServer not configured' };
  }

  const fetchImpl = options.fetchImpl || fetch;
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 5000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(`${idpServer.replace(/\/$/, '')}${API_PATHS.idpSession}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${DEFAULT_CONFIG.cookies.ssoSession}=${sessionId}`,
      },
      body: JSON.stringify({ session_id: sessionId }),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!res.ok) {
      return { authenticated: false, error: `IdP returned ${res.status}` };
    }

    const data = await res.json();
    if (!data?.user?.email) {
      return { authenticated: false, error: 'IdP returned no user' };
    }

    return {
      authenticated: true,
      sessionId,
      session: {
        user: data.user,
        account: data.account,
        accounts: data.accounts || [],
        activeAccountId: data.activeAccountId,
        issuedAt: Date.now(),
      },
    };
  } catch (err) {
    const error = err as Error;
    return {
      authenticated: false,
      error: error.name === 'AbortError' ? 'IdP timeout' : error.message || 'IdP request failed',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
