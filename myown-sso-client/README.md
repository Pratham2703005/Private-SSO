# pratham-sso

A plug-and-play SSO client SDK for Next.js apps. One provider, a few hooks, four API route one-liners — and your app has full OAuth2 + PKCE authentication with multi-account support, cross-tab sync, and widget integration.

```bash
npm install pratham-sso
```

## Setup

### 1. Environment Variables

```env
NEXT_PUBLIC_IDP_SERVER=https://pratham-sso.vercel.app/
NEXT_PUBLIC_CLIENT_ID=your-client-id
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000/api/auth/callback  <= use your domain
OAUTH_SECRET=your-random-secret-for-signing <= 32 words string
```

### 2. Wrap your app

```tsx
// app/layout.tsx
import { SSOProvider } from 'pratham-sso';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SSOProvider
          idpServer={process.env.NEXT_PUBLIC_IDP_SERVER!}
          clientId={process.env.NEXT_PUBLIC_CLIENT_ID!}
          redirectUri={process.env.NEXT_PUBLIC_REDIRECT_URI!}
        >
          {children}
        </SSOProvider>
      </body>
    </html>
  );
}
```

### 3. Create API routes

Four files, each a one-liner:

```ts
// app/api/auth/start/route.ts
import { startAuth } from 'pratham-sso/server';

export const GET = startAuth({
  clientId: process.env.NEXT_PUBLIC_CLIENT_ID!,
  idpServer: process.env.NEXT_PUBLIC_IDP_SERVER!,
  redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI!,
  oauthSecret: process.env.OAUTH_SECRET!,
});
```

```ts
// app/api/auth/callback/route.ts
import { handleCallback } from 'pratham-sso/server';

export const GET = handleCallback({
  clientId: process.env.NEXT_PUBLIC_CLIENT_ID!,
  idpServer: process.env.NEXT_PUBLIC_IDP_SERVER!,
  redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI!,
  oauthSecret: process.env.OAUTH_SECRET!,
});
```

```ts
// app/api/me/route.ts
import { validateSession } from 'pratham-sso/server';

export const POST = validateSession({
  clientId: process.env.NEXT_PUBLIC_CLIENT_ID!,
  idpServer: process.env.NEXT_PUBLIC_IDP_SERVER!,
});
```

```ts
// app/api/auth/logout/route.ts
import { handleLogout } from 'pratham-sso/server';

export const POST = handleLogout({
  clientId: process.env.NEXT_PUBLIC_CLIENT_ID!,
  idpServer: process.env.NEXT_PUBLIC_IDP_SERVER!,
});
```

### 4. Use in components

```tsx
'use client';
import { useSSO } from 'pratham-sso';

export default function Profile() {
  const { session, loading, signIn, logout } = useSSO();

  if (loading) return <p>Loading...</p>;
  if (!session) return <button onClick={() => signIn()}>Sign In</button>;

  return (
    <div>
      <p>Welcome, {session.user.name}</p>
      <button onClick={() => logout()}>Sign Out</button>
    </div>
  );
}
```

That's it. Your app now has SSO.

---

## API Reference

### `<SSOProvider>`

Wrap your app at the root layout. Manages session state, loads the widget, handles cross-tab sync.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `idpServer` | `string` | required | IDP server URL |
| `clientId` | `string` | — | OAuth client ID |
| `redirectUri` | `string` | — | OAuth redirect URI |
| `scope` | `string` | `'openid profile email'` | OAuth scope |
| `enableWidget` | `boolean` | `true` | Load widget iframe for cross-tab sync |
| `onSessionUpdate` | `(session) => void` | — | Called when session changes |
| `onError` | `(error) => void` | — | Called on errors |

---

### `useSSO()`

Full hook with all auth methods. Use in components that trigger auth actions.

```ts
const { session, loading, error, signIn, logout, globalLogout, refresh, switchAccount, on } = useSSO();
```

| Property | Type | Description |
|----------|------|-------------|
| `session` | `SessionData \| null` | Current user session |
| `loading` | `boolean` | True during initial load |
| `error` | `Error \| null` | Last error |
| `signIn(email?, prompt?)` | `() => Promise<void>` | Start OAuth login. Optional email hint, optional `'login'` or `'signup'` prompt |
| `logout()` | `() => Promise<void>` | Logout from this app only |
| `globalLogout()` | `() => Promise<void>` | Logout from IDP + all connected apps |
| `refresh()` | `() => Promise<SessionData \| null>` | Re-fetch session from server |
| `switchAccount(id)` | `(string) => Promise<void>` | Switch to a different linked account |
| `on(event, cb)` | `() => () => void` | Subscribe to events, returns unsubscribe fn |

---

### `useSession()`

Lightweight hook — session data only, no auth methods. Use in display-only components (navbar, avatar) to avoid unnecessary re-renders.

```ts
const { session, loading, error } = useSession();
```

---

### Events

```ts
const { on } = useSSO();

on('logout', () => { /* app-level logout */ });
on('globalLogout', () => { /* all apps logged out */ });
on('sessionRefresh', (session) => { /* session updated */ });
on('accountSwitch', ({ newAccount, previousAccount }) => { /* switched */ });
on('error', (error) => { /* something went wrong */ });
```

---

## Server Route Handlers

Import from `pratham-sso/server`. Each is a factory that returns a Next.js route handler.

### `startAuth(config)`

**Route:** `GET /api/auth/start`

Generates PKCE challenge + CSRF state, sets secure cookies, returns IDP authorize URL.

- Sets `oauth_state` cookie (HMAC-SHA256 signed, HttpOnly, 10 min)
- Sets `pkce_verifier` cookie (HttpOnly, 5 min)
- Returns `{ url, ok: true }` — the IDP authorize URL to redirect to

### `handleCallback(config)`

**Route:** `GET /api/auth/callback`

Called by IDP after login. Verifies CSRF state, exchanges auth code for session using PKCE.

- Reads `oauth_state` + `pkce_verifier` cookies
- POSTs code + verifier to IDP token endpoint
- Sets `__sso_session` cookie (HttpOnly, 1 day)
- Redirects to `/` on success, `/auth/error` on failure

### `validateSession(config)`

**Route:** `POST /api/me`

Validates the session cookie against IDP and returns user data.

- Reads `__sso_session` cookie
- Returns `{ authenticated, user, account, accounts, activeAccountId }`

### `handleLogout(config)`

**Route:** `POST /api/auth/logout`

Logs out and clears cookies. Accepts `{ scope: 'app' | 'global' }` in request body.

- Clears `__sso_session` and `__csrf` cookies
- Notifies IDP of logout
- Returns `{ success, message, scope }`

---

## Types

```ts
import type { SessionData, User, Account } from 'pratham-sso';

interface SessionData {
  user: User;
  account: Account;
  accounts: Account[];
  activeAccountId: string;
  issuedAt: number;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface Account {
  id: string;
  name: string;
  email: string;
  isPrimary?: boolean;
}
```

---

## Cookies

| Cookie | Set By | Purpose | HttpOnly | Max-Age |
|--------|--------|---------|----------|---------|
| `__sso_session` | `handleCallback` | Session ID from IDP | Yes | 1 day |
| `oauth_state` | `startAuth` | HMAC-signed CSRF state | Yes | 10 min |
| `pkce_verifier` | `startAuth` | PKCE code verifier | Yes | 5 min |
| `__csrf` | IDP | CSRF token for logout | Yes | — |

---

## How It Works

```
Browser                    Your Next.js App               IDP Server
  │                              │                            │
  │  signIn() ──────────────────>│                            │
  │                    GET /api/auth/start                    │
  │                    Set cookies: state + PKCE              │
  │                    Return IDP authorize URL               │
  │  Redirect ───────────────────────────────────────────────>│
  │                              │                    User logs in
  │<──────────────── Redirect with ?code&state ──────────────│
  │  GET /api/auth/callback ────>│                            │
  │                    Verify state, POST code+verifier ─────>│
  │                              │<────── { session_id } ─────│
  │                    Set __sso_session cookie               │
  │<──── Redirect to / ─────────│                            │
  │                              │                            │
  │  SSOProvider: POST /api/me ─>│                            │
  │                    Validate session ─────────────────────>│
  │                              │<────── { user, accounts } ─│
  │<──── Session ready ──────────│                            │
```

---

## Security

- **PKCE** (Proof Key for Code Exchange) — prevents auth code interception
- **CSRF protection** — HMAC-SHA256 signed state parameter
- **HttpOnly cookies** — session tokens inaccessible to JavaScript
- **Secure flag** — cookies sent over HTTPS only in production
- **SameSite** — `lax` in dev, `none` in production (for cross-site widget)
- **Origin validation** — widget postMessage checks origin

---

## License

MIT — Pratham Israni
