# myown-sso-client

Production-ready SSO client SDK for seamless authentication integration across multiple applications.

**Status**: Under active development (Phase 1-2 ✅ / Phase 3-6 🚧)

## Features

- ✅ **Clerk/Auth0 level DX** - Simple hooks and provider
- ✅ **IDP-Agnostic** - Works with any OAuth2 IDP
- ✅ **Refresh Deduping** - Only one /api/me call even with 5 simultaneous requests
- ✅ **Event System** - React to auth changes: `on('logout', callback)`
- ✅ **Widget Integration** - Built-in support for widget iframe
- ✅ **TypeScript** - Full type safety
- 🚧 **Server Utilities** - Easy route setup (Coming Phase 3)
- 🚧 **Comprehensive Docs** - Examples and guides (Coming Phase 5)

## Quick Start

### Installation

```bash
npm install myown-sso-client
```

### Setup (3 simple steps)

**1. Wrap your app with provider:**

```typescript
// app/layout.tsx
import { SSOProvider } from 'myown-sso-client';

export default function RootLayout({ children }) {
  return (
    <html>
      <SSOProvider
        idpServer="https://idp.yourdomain.com"
        clientId="your-client-id"
        redirectUri="/api/auth/callback"
        enableWidget
      >
        {children}
      </SSOProvider>
    </html>
  );
}
```

**2. Create API routes (auto-generated in v1):**

```typescript
// app/api/auth/start/route.ts
import { startAuth } from 'myown-sso-client/server';

export const GET = startAuth({
  clientId: process.env.NEXT_PUBLIC_CLIENT_ID,
  idpServer: process.env.NEXT_PUBLIC_IDP_SERVER,
  redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI,
  oauthSecret: process.env.NEXT_PUBLIC_OAUTH_STATE_SECRET,
});
```

**3. Use in components:**

```typescript
import { useSSO } from 'myown-sso-client';

export default function Profile() {
  const { session, loading, signIn, logout } = useSSO();

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {session ? (
        <div>
          <h1>{session.user.name}</h1>
          <button onClick={logout}>Logout</button>
        </div>
      ) : (
        <button onClick={() => signIn()}>Sign In</button>
      )}
    </div>
  );
}
```

## API Reference

### SSOProvider

```typescript
<SSOProvider
  idpServer="https://idp.com"          // IDP server URL
  clientId="app-id"                    // OAuth client ID
  redirectUri="/api/auth/callback"     // Callback URL
  enableWidget={true}                  // Load widget iframe
  onSessionUpdate={(session) => {}}    // Session change callback
  onError={(error) => {}}              // Error callback
>
  {children}
</SSOProvider>
```

### useSSO()

```typescript
const {
  session,           // SessionData | null
  loading,           // boolean
  error,             // Error | null
  signIn,            // (email?, prompt?) => Promise<void>
  logout,            // () => void
  globalLogout,      // () => void
  refresh,           // () => Promise<SessionData | null>
  switchAccount,     // (accountId) => Promise<void>
  on,                // (event, callback) => unsubscribe
} = useSSO();
```

### useSession()

Lightweight hook - just session state (minimal rerenders):

```typescript
const {
  session,     // SessionData | null
  loading,     // boolean
  error,       // Error | null
} = useSession();
```

### Events

```typescript
const { on } = useSSO();

// Subscribe to events
on('logout', () => {
  clearCache();
  redirectToHome();
});

on('sessionRefresh', (session) => {
  console.log('New session:', session);
});

on('accountSwitch', ({ newAccount, previousAccount }) => {
  console.log(`Switched from ${previousAccount.name} to ${newAccount.name}`);
});

on('globalLogout', () => {
  clearAppState();
});

on('error', (error) => {
  showErrorToast(error.message);
});
```

## Server Utilities

### startAuth()

Initiates OAuth2 flow with PKCE:

```typescript
import { startAuth } from 'myown-sso-client/server';

export const GET = startAuth(config);
```

### handleCallback()

Exchanges authorization code for session:

```typescript
import { handleCallback } from 'myown-sso-client/server';

export const GET = handleCallback(config);
```

### validateSession()

Validates session and returns user data:

```typescript
import { validateSession } from 'myown-sso-client/server';

export const POST = validateSession(config);
```

## Types

```typescript
import type {
  SessionData,
  User,
  Account,
  SSOProviderConfig,
  EventType,
  EventCallback,
} from 'myown-sso-client';
```

## Configuration

All constants defined in one place:

```typescript
import { DEFAULT_CONFIG } from 'myown-sso-client';

// Access:
console.log(DEFAULT_CONFIG.cookies.session);           // 'app_session_c'
console.log(DEFAULT_CONFIG.timeouts.session);          // 86400 (1 day)
console.log(DEFAULT_CONFIG.scope);                     // 'openid profile email'
```

## Architecture

```
Client                    Server                    Shared
├── hooks/               ├── start-auth.ts         ├── types.ts
│   ├── useSSO.ts        ├── callback.ts           ├── config.ts
│   └── useSession.ts    └── validate-session.ts   ├── events.ts
├── provider/                                       ├── cookies.ts
│   ├── SSOProvider.tsx                            ├── csrf.ts
│   └── context.ts                                 └── index.ts
├── widget/
│   └── widget-events.ts
└── index.ts
```

## Development Status

- ✅ **Phase 1**: Package structure & shared types (Complete)
- 🚧 **Phase 2**: SSOProvider & hooks (In Progress)
- 🚧 **Phase 3**: Server utilities (Coming)
- 🚧 **Phase 4**: Widget integration (Coming)
- 🚧 **Phase 5**: Build & packaging (Coming)
- 🚧 **Phase 6**: Documentation & examples (Coming)

## Contributing

This is an internal SDK. For issues or suggestions, contact the team.

## License

MIT
