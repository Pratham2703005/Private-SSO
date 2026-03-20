# `useSSO` Hook — Complete Reference

> Package: `pratham-sso` | Source: `myown-sso-client/src/client/hooks/useSSO.ts`

## Setup Requirement

The hook **must** be used inside a `<SSOProvider>`. It throws if the context is missing.

```tsx
import { SSOProvider } from 'pratham-sso';

// In your layout or root component:
<SSOProvider
  idpServer="http://localhost:3000"
  clientId="your-client-id"
  redirectUri="http://localhost:3004/api/auth/callback"
  enableWidget={true}               // default: true
  onSessionUpdate={(s) => {}}       // optional callback
  onError={(err) => {}}             // optional callback
>
  <App />
</SSOProvider>
```

---

## API Reference

```tsx
const {
  session,
  loading,
  error,
  signIn,
  logout,
  globalLogout,
  refresh,
  switchAccount,
  on,
} = useSSO();
```

### `session` — `SessionData | null`

The current authenticated session. `null` when not logged in or during initial load.

```ts
interface SessionData {
  user: User;
  account: Account;
  accounts: Account[];
  activeAccountId: string;
  issuedAt: number;
}

interface User {
  id: string;       // Unique user ID from IDP
  name: string;     // Display name
  email: string;    // Primary email
}

interface Account {
  id: string;       // Account ID (different from user ID)
  name: string;     // Account display name
  email: string;    // Account email
  isPrimary?: boolean;  // True for the primary/first account
}
```

**Deep Analysis — What `session` contains:**

| Field | What it is | Where it comes from |
|-------|-----------|---------------------|
| `user` | The authenticated human. One user can have multiple accounts. | IDP `users` table |
| `account` | The **currently active** account for this session. | IDP `user_accounts` table, filtered by `activeAccountId` |
| `accounts` | **All** accounts linked to this user's session (including accounts logged in during this session). | IDP `session_logons` join with `user_accounts` |
| `activeAccountId` | ID of the currently selected account. Changes when you call `switchAccount()`. | IDP `sessions.active_account_id` |
| `issuedAt` | Unix timestamp (seconds) when the session data was fetched from the server. | Set by the `/api/me` response |

**How session is fetched:**
1. Client POSTs to `/api/me` with `credentials: 'include'` (sends `__sso_session` cookie) and a CSRF token from `__csrf` cookie
2. Server reads `__sso_session` cookie → calls IDP `/api/auth/session` with that session ID
3. IDP validates the session, checks expiry, does soft User-Agent binding check
4. Returns `{ authenticated, user, account, accounts, activeAccountId }`
5. Provider stores this in React state

**When session auto-refreshes:**
- On initial mount (component first renders)
- On browser tab becoming visible (`visibilitychange` event)
- On window `focus` event
- On widget `sessionUpdate` or `ACCOUNT_SWITCHED` postMessage
- On manual `refresh()` call

**Deduplication:** If multiple refresh triggers fire simultaneously, only ONE actual `/api/me` call is made. Subsequent callers receive the same promise.

---

### `loading` — `boolean`

`true` only during the initial session fetch on mount. Becomes `false` after the first `/api/me` call completes (whether successful or not). Does NOT become `true` again on subsequent refreshes.

---

### `error` — `Error | null`

The last error encountered during any auth operation (`signIn`, `refresh`, `switchAccount`, or widget errors). Resets to `null` on successful session fetch.

---

### `signIn(email?, prompt?)` — `Promise<void>`

Starts the OAuth2 + PKCE authorization flow. **Redirects the browser** — does not return.

```ts
// Basic sign in
await signIn();

// Pre-fill email on IDP login form
await signIn('user@example.com');

// Force signup flow
await signIn(undefined, 'signup');

// Force login (re-authentication)
await signIn('user@example.com', 'login');
```

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `email` | `string?` | Pre-fills email on IDP login form (sent as `login_hint`) |
| `prompt` | `string?` | Controls IDP behavior: `'login'` = force login, `'signup'` = show signup form |

**Internal flow:**
```
signIn() called
  → GET /api/auth/start (client's Next.js route)
    → Server generates PKCE verifier + challenge
    → Server generates signed CSRF state
    → Server sets cookies: oauth_state, pkce_verifier (HttpOnly)
    → Server returns IDP authorize URL
  → Browser redirects to IDP /api/auth/authorize
    → User authenticates on IDP
    → IDP redirects to /api/auth/callback with ?code=...&state=...
      → Server validates state signature (CSRF protection)
      → Server exchanges code + PKCE verifier for tokens at IDP /api/auth/token
      → Server sets __sso_session cookie with session_id
      → Server redirects to home page
  → SSOProvider mounts → fetches /api/me → session populated
```

**Security:**
- PKCE (RFC 7636) prevents authorization code interception
- Signed state prevents CSRF attacks
- All auth cookies are HttpOnly (no JS access)

---

### `logout()` — `void`

Local-only logout. Clears React state and emits a `'logout'` event.

```ts
logout();
```

> **BUG:** This function does NOT clear the `__sso_session` cookie or call any server endpoint. The session cookie persists, so on next page refresh or tab focus, `session` will be restored from the cookie. See [Known Issues](#known-issues).

**What it does:**
1. Sets `session` to `null`
2. Emits `'logout'` event

**What it does NOT do:**
- Clear `__sso_session` cookie
- Call IDP `/api/auth/logout` endpoint
- Revoke tokens on the server

---

### `globalLogout()` — `void`

Logout + notify the widget iframe to propagate logout across all SSO-connected apps.

```ts
globalLogout();
```

> **BUG:** Same cookie issue as `logout()`. Additionally, this only works if the widget iframe has been loaded and `widgetFrameRef` has been captured from a postMessage event.

**What it does:**
1. Sets `session` to `null`
2. Emits `'globalLogout'` event
3. Posts `{ type: 'logout' }` to widget iframe (if available)

---

### `refresh()` — `Promise<SessionData | null>`

Manually re-fetches the session from `/api/me`. Uses deduplication — safe to call multiple times.

```ts
const updatedSession = await refresh();
if (updatedSession) {
  console.log('Session refreshed:', updatedSession.user.name);
}
```

**Returns:** The new `SessionData` or `null` if not authenticated.

---

### `switchAccount(accountId)` — `Promise<void>`

Switches the active account by instructing the widget iframe to update the IDP session.

```ts
await switchAccount('account-uuid-here');
// session.account and session.activeAccountId are now updated
```

**Internal flow:**
1. Posts `{ type: 'switchAccount', accountId }` to widget iframe
2. Waits 500ms (hardcoded delay)
3. Calls `refresh()` to get updated session

> **Note:** Requires the widget iframe to be loaded. The 500ms delay is a fixed wait, not event-driven.

---

### `on(event, callback)` — `() => void`

Subscribe to SSO events. Returns an unsubscribe function.

```ts
const unsubscribe = on('sessionRefresh', (newSession) => {
  console.log('Session refreshed:', newSession);
});

// Later: cleanup
unsubscribe();
```

**Available events:**

| Event | Payload | When it fires |
|-------|---------|---------------|
| `'logout'` | `undefined` | `logout()` called |
| `'globalLogout'` | `undefined` | `globalLogout()` called |
| `'sessionRefresh'` | `SessionData` | Session successfully refreshed from server |
| `'accountSwitch'` | `{ newAccount, previousAccount }` | Account switched |
| `'error'` | `Error` | Any auth error occurs |

---

## Cookies Used

| Cookie | Purpose | HttpOnly | Set By |
|--------|---------|----------|--------|
| `__sso_session` | Session ID — validated against IDP on every `/api/me` call | Yes | `/api/auth/callback` |
| `__csrf` | CSRF token for double-submit protection on `/api/me` | No (JS-readable) | IDP `/api/auth/session` |
| `oauth_state` | Signed CSRF state during OAuth flow | Yes | `/api/auth/start` |
| `pkce_verifier` | PKCE code verifier during OAuth flow | Yes | `/api/auth/start` |

---

## Configuration Constants

From `myown-sso-client/src/shared/config.ts`:

```ts
API_PATHS = {
  authStart:    '/api/auth/start',
  authCallback: '/api/auth/callback',
  me:           '/api/me',
}

Timeouts = {
  oauth:   600s   (10 min — OAuth flow expiry)
  pkce:    300s   (5 min — PKCE verifier expiry)
  session: 86400s (1 day — session cookie maxAge)
}
```

---

## Usage Example

```tsx
'use client';
import { useSSO } from 'pratham-sso';

export function LoginButton() {
  const { session, loading, signIn, logout } = useSSO();

  if (loading) return <button disabled>Loading...</button>;

  if (session) {
    return (
      <div>
        <p>Welcome, {session.user.name} ({session.account.email})</p>
        <p>Active account: {session.activeAccountId}</p>
        <p>Total accounts: {session.accounts.length}</p>
        <button onClick={() => logout()}>Sign Out</button>
      </div>
    );
  }

  return <button onClick={() => signIn()}>Sign In</button>;
}
```

---

## Known Issues

### 1. `logout()` doesn't actually log out
**Problem:** `logout()` only sets `session = null` in React state. The `__sso_session` cookie remains valid. On page refresh, tab focus, or visibility change, the auto-refresh mechanism calls `/api/me`, finds the valid cookie, and restores the session.

**Workaround:** Manually clear the cookie and/or call the IDP logout endpoint:
```ts
// Clear cookie client-side (won't work — it's HttpOnly)
// You need a server route like /api/auth/logout that:
//   1. Calls IDP /api/auth/logout to revoke tokens
//   2. Clears the __sso_session cookie
//   3. Returns success
```

**Proper fix needed:** Add a `/api/auth/logout` route in the client app that clears the `__sso_session` cookie server-side and optionally revokes the session on the IDP.

### 2. `globalLogout()` depends on widget iframe
If `enableWidget` is `false` or the widget script failed to load, `widgetFrameRef.current` is `null` and the postMessage is silently skipped. Logout won't propagate to other apps.

### 3. `signIn()` errors are silent
If `/api/auth/start` fails (IDP down, wrong config, network error), the error is caught and stored in `error` state but there's no user-visible feedback unless you explicitly check `error`:
```tsx
const { error } = useSSO();
if (error) console.error('Auth error:', error.message);
```

### 4. `switchAccount()` uses a hardcoded 500ms delay
Instead of waiting for a confirmation event from the widget, it uses `setTimeout(resolve, 500)`. This can be too slow or too fast depending on network conditions.

### 5. Session dedup can serve stale data
If a session change happens during an in-flight `/api/me` request, the dedup mechanism returns the already-in-flight promise's result (which may not reflect the latest state).

---

## Environment Variables (client-d)

```env
NEXT_PUBLIC_IDP_SERVER=http://localhost:3000
NEXT_PUBLIC_CLIENT_ID=<your-oauth-client-id>
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3004/api/auth/callback
OAUTH_SECRET=<your-oauth-secret>
```
