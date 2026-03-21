'use client';

import { useSSO, useSession } from 'pratham-sso';
import { useState } from 'react';

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto font-mono leading-relaxed whitespace-pre">
      {code}
    </pre>
  );
}

function ResultBox({ result, label }: { result: string | null; label?: string }) {
  if (!result) return null;
  return (
    <div className="mt-2 p-3 bg-gray-800 rounded text-xs font-mono text-yellow-300 overflow-x-auto max-h-48 overflow-y-auto">
      {label && <span className="text-gray-400">{label}: </span>}
      {result}
    </div>
  );
}

function FunctionCard({
  title,
  description,
  code,
  apiCall,
  cookies,
  receives,
  children,
  result,
}: {
  title: string;
  description: string;
  code: string;
  apiCall?: string;
  cookies?: string;
  receives?: string;
  children: React.ReactNode;
  result?: string | null;
}) {
  return (
    <div className="border border-gray-700 rounded-xl overflow-hidden bg-gray-850 shadow-lg">
      <div className="px-5 py-3 bg-gray-800 border-b border-gray-700">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="text-sm text-gray-400 mt-1">{description}</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-0">
        {/* Left: Code */}
        <div className="p-4 border-r border-gray-700">
          <CodeBlock code={code} />
          {/* Meta info */}
          <div className="mt-3 flex flex-wrap gap-2">
            {apiCall && (
              <span className="inline-block px-2 py-1 rounded bg-blue-900/50 text-blue-300 text-xs font-mono">
                API: {apiCall}
              </span>
            )}
            {cookies && (
              <span className="inline-block px-2 py-1 rounded bg-purple-900/50 text-purple-300 text-xs font-mono">
                Cookies: {cookies}
              </span>
            )}
            {receives && (
              <span className="inline-block px-2 py-1 rounded bg-emerald-900/50 text-emerald-300 text-xs font-mono">
                Returns: {receives}
              </span>
            )}
          </div>
          <ResultBox result={result ?? null} label="Response" />
        </div>
        {/* Right: Button */}
        <div className="p-4 flex flex-col items-center justify-center gap-3 bg-gray-800/50">
          {children}
        </div>
      </div>
    </div>
  );
}

function SignInDemo() {
  const { signIn } = useSSO();
  const [email, setEmail] = useState('');

  return (
    <FunctionCard
      title="signIn(email?, prompt?)"
      description="Starts OAuth2 login flow. Redirects browser to IDP authorize page via /api/auth/start."
      code={`import { useSSO } from 'pratham-sso';

const { signIn } = useSSO();

// Basic sign in
await signIn();

// With email hint
await signIn('user@example.com');

// Force signup page
await signIn(undefined, 'signup');`}
      apiCall="GET /api/auth/start"
      cookies="Sets: oauth_state (10min), pkce_verifier (5min)"
      receives="{ url: string } → redirects to IDP"
    >
      <input
        type="email"
        placeholder="Email (optional)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-3 py-2 rounded bg-gray-700 text-white text-sm border border-gray-600 focus:border-blue-500 focus:outline-none"
      />
      <button
        onClick={() => signIn(email || undefined)}
        className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
      >
        Sign In
      </button>
      <button
        onClick={() => signIn(undefined, 'signup')}
        className="w-full px-4 py-2 bg-blue-800 text-blue-200 rounded-lg hover:bg-blue-900 transition text-sm"
      >
        Sign Up (prompt=signup)
      </button>
    </FunctionCard>
  );
}

function LogoutDemo() {
  const { logout, globalLogout } = useSSO();
  const [result, setResult] = useState<string | null>(null);

  return (
    <FunctionCard
      title="logout() / globalLogout()"
      description="Logout from this app only, or globally from IDP + all connected apps."
      code={`import { useSSO } from 'pratham-sso';

const { logout, globalLogout } = useSSO();

// App-only logout
await logout();
// POST /api/auth/logout { scope: 'app' }

// Global logout (all apps)
await globalLogout();
// POST /api/auth/logout { scope: 'global' }
// Also sends postMessage { type: 'logout' } to widget`}
      apiCall="POST /api/auth/logout"
      cookies="Clears: __sso_session, __csrf"
      receives="{ success: bool, message, scope }"
      result={result}
    >
      <button
        onClick={async () => {
          try {
            await logout();
            setResult('Logged out (app scope)');
          } catch (e) {
            setResult('Error: ' + e);
          }
        }}
        className="w-full px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold"
      >
        Logout (App Only)
      </button>
      <button
        onClick={async () => {
          try {
            await globalLogout();
            setResult('Logged out (global scope)');
          } catch (e) {
            setResult('Error: ' + e);
          }
        }}
        className="w-full px-4 py-2.5 bg-red-900 text-red-200 rounded-lg hover:bg-red-950 transition text-sm"
      >
        Global Logout (All Apps)
      </button>
    </FunctionCard>
  );
}

function RefreshDemo() {
  const { refresh } = useSSO();
  const [result, setResult] = useState<string | null>(null);

  return (
    <FunctionCard
      title="refresh()"
      description="Re-fetches the current session from the server by calling POST /api/me."
      code={`import { useSSO } from 'pratham-sso';

const { refresh } = useSSO();

const session = await refresh();
// POST /api/me → validates __sso_session cookie
// Returns: SessionData | null

console.log(session?.user.name);
console.log(session?.account);
console.log(session?.accounts); // all linked accounts`}
      apiCall="POST /api/me → POST idpServer/api/auth/session"
      cookies="Reads: __sso_session"
      receives="SessionData { user, account, accounts, activeAccountId }"
      result={result}
    >
      <button
        onClick={async () => {
          try {
            const session = await refresh();
            setResult(session ? JSON.stringify(session, null, 2) : 'null (not authenticated)');
          } catch (e) {
            setResult('Error: ' + e);
          }
        }}
        className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold"
      >
        Refresh Session
      </button>
    </FunctionCard>
  );
}

function SwitchAccountDemo() {
  const { switchAccount, session } = useSSO();
  const [result, setResult] = useState<string | null>(null);

  return (
    <FunctionCard
      title="switchAccount(accountId)"
      description="Switches to a different linked account. Sends postMessage to widget iframe, then refreshes session."
      code={`import { useSSO } from 'pratham-sso';

const { switchAccount, session } = useSSO();

// List available accounts
session?.accounts.forEach(acc => {
  console.log(acc.id, acc.name, acc.email);
});

// Switch to another account
await switchAccount('account-id-here');
// → postMessage { type: 'switchAccount', accountId }
// → then calls refresh() to get updated session`}
      apiCall="postMessage to widget → refresh()"
      cookies="Reads: __sso_session (via refresh)"
      receives="void (session updates automatically)"
      result={result}
    >
      {session?.accounts && session.accounts.length > 1 ? (
        session.accounts.map((acc) => (
          <button
            key={acc.id}
            onClick={async () => {
              try {
                await switchAccount(acc.id);
                setResult(`Switched to: ${acc.name} (${acc.email})`);
              } catch (e) {
                setResult('Error: ' + e);
              }
            }}
            className={`w-full px-4 py-2 rounded-lg transition text-sm text-left ${
              acc.id === session.activeAccountId
                ? 'bg-indigo-700 text-white border-2 border-indigo-400'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600 border border-gray-600'
            }`}
          >
            {acc.name} ({acc.email})
            {acc.id === session.activeAccountId && ' ← active'}
          </button>
        ))
      ) : (
        <p className="text-gray-400 text-sm text-center">
          {session ? 'Only 1 account linked' : 'Sign in to see accounts'}
        </p>
      )}
    </FunctionCard>
  );
}

function UseSessionDemo() {
  const { session, loading, error } = useSession();
  const [result, setResult] = useState<string | null>(null);

  return (
    <FunctionCard
      title="useSession()"
      description="Lightweight hook — returns session data only (no auth methods). Ideal for display components to avoid unnecessary re-renders."
      code={`import { useSession } from 'pratham-sso';

// Lightweight: no signIn/logout/refresh methods
const { session, loading, error } = useSession();

// Use in display-only components:
// Navbar, avatars, role-based UI
if (loading) return <Spinner />;
if (!session) return <p>Not signed in</p>;

return <p>Hello, {session.user.name}</p>;`}
      cookies="Reads: __sso_session (via SSOProvider context)"
      receives="{ session, loading, error }"
      result={result}
    >
      <button
        onClick={() => {
          setResult(
            JSON.stringify(
              { session: session ?? null, loading, error: error?.message ?? null },
              null,
              2
            )
          );
        }}
        className="w-full px-4 py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition font-semibold"
      >
        Read Session State
      </button>
    </FunctionCard>
  );
}

function EventsDemo() {
  const { on } = useSSO();
  const [result, setResult] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [unsubs, setUnsubs] = useState<(() => void)[]>([]);

  const startListening = () => {
    const events = ['logout', 'sessionRefresh', 'accountSwitch', 'globalLogout', 'error'] as const;
    const newUnsubs = events.map((event) =>
      on(event, (data: unknown) => {
        const timestamp = new Date().toLocaleTimeString();
        setResult((prev) => `[${timestamp}] ${event}: ${JSON.stringify(data)}\n${prev || ''}`);
      })
    );
    setUnsubs(newUnsubs);
    setListening(true);
    setResult('Listening for events...');
  };

  const stopListening = () => {
    unsubs.forEach((u) => u());
    setUnsubs([]);
    setListening(false);
    setResult(null);
  };

  return (
    <FunctionCard
      title="on(event, callback)"
      description="Subscribe to SSO events: logout, sessionRefresh, accountSwitch, globalLogout, error. Returns an unsubscribe function."
      code={`import { useSSO } from 'pratham-sso';

const { on } = useSSO();

// Subscribe to events
const unsub = on('sessionRefresh', (session) => {
  console.log('Session refreshed:', session);
});

const unsub2 = on('logout', () => {
  console.log('User logged out');
});

const unsub3 = on('accountSwitch', ({ newAccount, previousAccount }) => {
  console.log('Switched from', previousAccount, 'to', newAccount);
});

// Cleanup
unsub();  // stop listening`}
      receives="unsubscribe: () => void"
      result={result}
    >
      {!listening ? (
        <button
          onClick={startListening}
          className="w-full px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-semibold"
        >
          Start Listening
        </button>
      ) : (
        <button
          onClick={stopListening}
          className="w-full px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-semibold"
        >
          Stop Listening
        </button>
      )}
    </FunctionCard>
  );
}

function ServerRoutesDemo() {
  return (
    <>
      <FunctionCard
        title="startAuth(config)"
        description="Server-side route handler. Generates PKCE + CSRF state, sets cookies, returns IDP authorize URL."
        code={`// app/api/auth/start/route.ts
import { startAuth } from 'pratham-sso/server';

export const GET = startAuth({
  clientId: process.env.NEXT_PUBLIC_CLIENT_ID!,
  idpServer: process.env.NEXT_PUBLIC_IDP_SERVER!,
  redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI!,
  oauthSecret: process.env.OAUTH_SECRET!,
});

// What happens internally:
// 1. Generates 32-byte random state (CSRF)
// 2. Signs state with HMAC-SHA256(oauthSecret)
// 3. Generates 96-byte PKCE verifier + SHA256 challenge
// 4. Sets cookies: oauth_state (10min), pkce_verifier (5min)
// 5. Returns { url: idpServer/api/auth/authorize?... }`}
        apiCall="GET /api/auth/start"
        cookies="Sets: oauth_state (HttpOnly, 10min), pkce_verifier (HttpOnly, 5min)"
        receives='{ url: string, ok: true }'
      >
        <a
          href="/api/auth/start"
          target="_blank"
          className="w-full px-4 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition font-semibold text-center block"
        >
          Visit /api/auth/start
        </a>
      </FunctionCard>

      <FunctionCard
        title="handleCallback(config)"
        description="Server-side route handler. Validates CSRF state, exchanges auth code for session via PKCE, sets session cookie."
        code={`// app/api/auth/callback/route.ts
import { handleCallback } from 'pratham-sso/server';

export const GET = handleCallback({
  clientId: process.env.NEXT_PUBLIC_CLIENT_ID!,
  idpServer: process.env.NEXT_PUBLIC_IDP_SERVER!,
  redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI!,
  oauthSecret: process.env.OAUTH_SECRET!,
});

// What happens internally:
// 1. Reads ?code=...&state=... from query params
// 2. Reads oauth_state cookie, verifies HMAC signature
// 3. Reads pkce_verifier cookie
// 4. POST idpServer/api/auth/token {
//      grant_type: 'authorization_code',
//      code, client_id, redirect_uri, code_verifier
//    }
// 5. Sets __sso_session cookie with session_id (1 day)
// 6. Deletes pkce_verifier cookie
// 7. Redirects to /`}
        apiCall="GET /api/auth/callback → POST idpServer/api/auth/token"
        cookies="Reads: oauth_state, pkce_verifier | Sets: __sso_session (1 day) | Deletes: pkce_verifier"
        receives="Redirect to / on success, /auth/error on failure"
      >
        <div className="text-gray-400 text-sm text-center">
          Called automatically by IDP after login
        </div>
      </FunctionCard>

      <FunctionCard
        title="validateSession(config)"
        description="Server-side route handler. Reads __sso_session cookie, validates it against IDP, returns user data."
        code={`// app/api/me/route.ts
import { validateSession } from 'pratham-sso/server';

export const POST = validateSession({
  clientId: process.env.NEXT_PUBLIC_CLIENT_ID!,
  idpServer: process.env.NEXT_PUBLIC_IDP_SERVER!,
});

// What happens internally:
// 1. Reads __sso_session cookie
// 2. If missing → { authenticated: false }
// 3. POST idpServer/api/auth/session { session_id }
// 4. Returns {
//      authenticated: true,
//      sessionId, user, account,
//      accounts, activeAccountId
//    }`}
        apiCall="POST /api/me → POST idpServer/api/auth/session"
        cookies="Reads: __sso_session"
        receives="{ authenticated, user?, account?, accounts? }"
      >
        <button
          onClick={async () => {
            const res = await fetch('/api/me', { method: 'POST', credentials: 'include' });
            const data = await res.json();
            alert(JSON.stringify(data, null, 2));
          }}
          className="w-full px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition font-semibold"
        >
          Call POST /api/me
        </button>
      </FunctionCard>

      <FunctionCard
        title="handleLogout(config)"
        description="Server-side route handler. Clears session cookies and notifies IDP of logout."
        code={`// app/api/auth/logout/route.ts
import { handleLogout } from 'pratham-sso/server';

export const POST = handleLogout({
  clientId: process.env.NEXT_PUBLIC_CLIENT_ID!,
  idpServer: process.env.NEXT_PUBLIC_IDP_SERVER!,
});

// What happens internally:
// 1. Reads { scope } from request body ('app' | 'global')
// 2. Reads __sso_session and __csrf cookies
// 3. POST idpServer/api/auth/logout {
//      scope, clientId, _csrf
//    }
// 4. Clears __sso_session and __csrf cookies
// 5. Returns { success, message, scope }`}
        apiCall="POST /api/auth/logout → POST idpServer/api/auth/logout"
        cookies="Reads: __sso_session, __csrf | Clears: __sso_session, __csrf"
        receives='{ success: bool, message, scope }'
      >
        <button
          onClick={async () => {
            const res = await fetch('/api/auth/logout', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ scope: 'app' }),
            });
            const data = await res.json();
            alert(JSON.stringify(data, null, 2));
          }}
          className="w-full px-4 py-2.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition font-semibold"
        >
          Call POST /api/auth/logout
        </button>
      </FunctionCard>
    </>
  );
}

function SSOProviderDemo() {
  return (
    <FunctionCard
      title="<SSOProvider>"
      description="Root context provider. Wraps your app, manages session state, loads widget script, handles cross-tab sync."
      code={`// app/layout.tsx
import { SSOProvider } from 'pratham-sso';

export default function Layout({ children }) {
  return (
    <SSOProvider
      idpServer={process.env.NEXT_PUBLIC_IDP_SERVER!}
      clientId={process.env.NEXT_PUBLIC_CLIENT_ID!}
      redirectUri={process.env.NEXT_PUBLIC_REDIRECT_URI!}
      scope="openid profile email"    // default
      enableWidget={true}              // default
      onSessionUpdate={(session) => {  // optional
        console.log('Session changed:', session);
      }}
      onError={(error) => {            // optional
        console.error('SSO error:', error);
      }}
    >
      {children}
    </SSOProvider>
  );
}

// Internally:
// 1. Creates React context with session state
// 2. Loads widget script: idpServer/api/widget.js
// 3. Fetches session on mount (POST /api/me)
// 4. Re-fetches on tab focus / visibility change
// 5. Listens for postMessage from widget iframe
// 6. Deduplicates concurrent session fetches`}
      cookies="Reads: __sso_session (via /api/me)"
      receives="Context: { session, loading, error, signIn, logout, ... }"
    >
      <div className="text-center text-gray-400 text-sm">
        Already active — wrapping this entire page in layout.tsx
      </div>
    </FunctionCard>
  );
}

function CurrentSessionDisplay() {
  const { session, loading } = useSSO();

  if (loading) {
    return (
      <div className="p-4 rounded-xl bg-gray-800 border border-gray-700 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-1/3 mb-2"></div>
        <div className="h-3 bg-gray-700 rounded w-1/2"></div>
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-xl border ${session ? 'bg-emerald-900/30 border-emerald-700' : 'bg-red-900/30 border-red-700'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2.5 h-2.5 rounded-full ${session ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
        <span className="font-semibold text-white">{session ? 'Authenticated' : 'Not Authenticated'}</span>
      </div>
      {session && (
        <div className="text-sm text-gray-300 ml-4.5 space-y-0.5">
          <p><span className="text-gray-500">User:</span> {session.user.name} ({session.user.email})</p>
          <p><span className="text-gray-500">Account:</span> {session.account.name}</p>
          <p><span className="text-gray-500">Accounts:</span> {session.accounts?.length ?? 0} linked</p>
          <p><span className="text-gray-500">Active ID:</span> <code className="text-xs bg-gray-800 px-1 rounded">{session.activeAccountId}</code></p>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              <span className="text-blue-400">pratham-sso</span> API Explorer
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">All exported functions — transparent usage, API calls, cookies</p>
          </div>
          <div className="w-72 absolute top-10 right-10">
            <CurrentSessionDisplay />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-12">
        {/* Client Hooks Section */}
        <section>
          <h2 className="text-xl font-bold text-gray-200 mb-1 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            Client-Side Hooks
            <span className="text-sm font-normal text-gray-500 ml-2">import from &apos;pratham-sso&apos;</span>
          </h2>
          <p className="text-gray-500 text-sm mb-5">React hooks and components used in client components (&apos;use client&apos;)</p>

          <div className="space-y-6">
            <SSOProviderDemo />
            <SignInDemo />
            <UseSessionDemo />
            <RefreshDemo />
            <LogoutDemo />
            <SwitchAccountDemo />
            <EventsDemo />
          </div>
        </section>

        {/* Server Routes Section */}
        <section>
          <h2 className="text-xl font-bold text-gray-200 mb-1 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-violet-500"></span>
            Server-Side Route Handlers
            <span className="text-sm font-normal text-gray-500 ml-2">import from &apos;pratham-sso/server&apos;</span>
          </h2>
          <p className="text-gray-500 text-sm mb-5">Next.js API route handlers — each is a one-liner export in your route.ts files</p>

          <div className="space-y-6">
            <ServerRoutesDemo />
          </div>
        </section>

        {/* Cookie Reference */}
        <section>
          <h2 className="text-xl font-bold text-gray-200 mb-1 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-purple-500"></span>
            Cookie Reference
          </h2>
          <p className="text-gray-500 text-sm mb-5">All cookies managed by the library</p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-700 rounded-lg overflow-hidden">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-300">Cookie Name</th>
                  <th className="px-4 py-3 text-left text-gray-300">Set By</th>
                  <th className="px-4 py-3 text-left text-gray-300">Read By</th>
                  <th className="px-4 py-3 text-left text-gray-300">HttpOnly</th>
                  <th className="px-4 py-3 text-left text-gray-300">Max-Age</th>
                  <th className="px-4 py-3 text-left text-gray-300">Contains</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                <tr className="bg-gray-900">
                  <td className="px-4 py-2 font-mono text-purple-300">__sso_session</td>
                  <td className="px-4 py-2 text-gray-400">handleCallback</td>
                  <td className="px-4 py-2 text-gray-400">validateSession, handleLogout</td>
                  <td className="px-4 py-2 text-green-400">Yes</td>
                  <td className="px-4 py-2 text-gray-400">1 day</td>
                  <td className="px-4 py-2 text-gray-400">session_id from IDP</td>
                </tr>
                <tr className="bg-gray-850">
                  <td className="px-4 py-2 font-mono text-purple-300">oauth_state</td>
                  <td className="px-4 py-2 text-gray-400">startAuth</td>
                  <td className="px-4 py-2 text-gray-400">handleCallback</td>
                  <td className="px-4 py-2 text-green-400">Yes</td>
                  <td className="px-4 py-2 text-gray-400">10 min</td>
                  <td className="px-4 py-2 text-gray-400">HMAC-SHA256 signed CSRF state</td>
                </tr>
                <tr className="bg-gray-900">
                  <td className="px-4 py-2 font-mono text-purple-300">pkce_verifier</td>
                  <td className="px-4 py-2 text-gray-400">startAuth</td>
                  <td className="px-4 py-2 text-gray-400">handleCallback (then deleted)</td>
                  <td className="px-4 py-2 text-green-400">Yes</td>
                  <td className="px-4 py-2 text-gray-400">5 min</td>
                  <td className="px-4 py-2 text-gray-400">Base64url PKCE verifier (96 bytes)</td>
                </tr>
                <tr className="bg-gray-850">
                  <td className="px-4 py-2 font-mono text-purple-300">__csrf</td>
                  <td className="px-4 py-2 text-gray-400">IDP / middleware</td>
                  <td className="px-4 py-2 text-gray-400">handleLogout</td>
                  <td className="px-4 py-2 text-green-400">Yes</td>
                  <td className="px-4 py-2 text-gray-400">-</td>
                  <td className="px-4 py-2 text-gray-400">CSRF token for IDP calls</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* OAuth Flow Diagram */}
        <section>
          <h2 className="text-xl font-bold text-gray-200 mb-1 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            OAuth2 + PKCE Flow
          </h2>
          <p className="text-gray-500 text-sm mb-5">How the full authentication flow works end-to-end</p>

          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 font-mono text-sm text-gray-300 space-y-2 overflow-x-auto">
            <pre className="whitespace-pre leading-relaxed">{`Browser                         Client App (Next.js)              IDP Server
  │                                    │                              │
  │  1. Click "Sign In"                │                              │
  │──── signIn() ─────────────────────>│                              │
  │                                    │                              │
  │                          2. GET /api/auth/start                   │
  │                          Generate PKCE verifier + challenge       │
  │                          Generate CSRF state + HMAC sign          │
  │                          Set cookies: oauth_state, pkce_verifier  │
  │                          Return { url: IDP authorize URL }        │
  │                                    │                              │
  │  3. Redirect to IDP                │                              │
  │────────────────────────────────────────────────────────────────── >│
  │                                    │                              │
  │  4. User logs in on IDP            │                              │
  │< ────────────────────────────── Redirect with ?code=...&state=... │
  │                                    │                              │
  │  5. GET /api/auth/callback?code=...&state=...                     │
  │──────────────────────────────────> │                              │
  │                          6. Verify state signature (HMAC-SHA256)  │
  │                          7. POST /api/auth/token ────────────────>│
  │                             { code, code_verifier, client_id }    │
  │                                    │  8. Return { session_id } <──│
  │                          9. Set cookie: __sso_session             │
  │                          10. Delete cookie: pkce_verifier         │
  │  11. Redirect to /   <────────────│                              │
  │                                    │                              │
  │  12. SSOProvider mounts            │                              │
  │      POST /api/me ────────────────>│                              │
  │                          13. Read __sso_session cookie            │
  │                          14. POST /api/auth/session ─────────────>│
  │                                    │  15. Return user data  <─────│
  │  16. Session ready  <──────────────│                              │`}</pre>
          </div>
        </section>

        <footer className="text-center text-gray-600 text-sm py-8 border-t border-gray-800">
          pratham-sso — All functions visualized with live interaction
        </footer>
      </main>
    </div>
  );
}
