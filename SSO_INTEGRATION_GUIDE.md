# SSO Integration Guide

Complete guide for integrating applications with the MyOwn SSO system (following client-c implementation).

---

## 🏗️ Architecture

```
┌─────────────────┐                    ┌──────────────────┐
│  Your App       │                    │  IDP Server      │
│  (Client-C)     │                    │  (localhost:3000)│
├─────────────────┤                    ├──────────────────┤
│ Cookies:        │  ◄──OAuth2────►   │ Cookies:         │
│ app_session_c   │                    │ __sso_session    │
│ __csrf          │────postMessage────│ __csrf           │
│ oauth_state     │  (widget iframe)   │                  │
│ pkce_verifier   │                    │                  │
└─────────────────┘                    └──────────────────┘
```

---

## 📡 Three Backend Routes Required

### 1️⃣ GET /api/auth/start
**Initiates OAuth2 flow with PKCE**

```typescript
// app/api/auth/start/route.ts
import { createHash, randomBytes } from "crypto";

export async function GET(request: NextRequest) {
  const state = generateRandomState(); // 32 bytes
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  // Build IDP authorize URL
  const authorizeUrl = new URL("/api/auth/authorize", process.env.NEXT_PUBLIC_IDP_SERVER);
  authorizeUrl.searchParams.set("client_id", process.env.NEXT_PUBLIC_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", process.env.NEXT_PUBLIC_REDIRECT_URI);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "openid profile email");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.json({ url: authorizeUrl.toString() });

  // Store state & verifier in signed cookies (5-10 min expiry)
  response.cookies.set("oauth_state", signState(state), { httpOnly: true, maxAge: 600 });
  response.cookies.set("pkce_verifier", verifier, { httpOnly: true, maxAge: 300 });

  return response;
}
```

**Input**: Query params `email?`, `prompt?` (optional)  
**Output**: `{ "url": "https://idp.com/api/auth/authorize?..." }`  
**Cookies Set**: `oauth_state` (signed), `pkce_verifier`

---

### 2️⃣ GET /api/auth/callback
**Exchanges auth code for session**

```typescript
// app/api/auth/callback/route.ts
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  // 1. Validate CSRF state
  if (!validateState(state, request)) {
    return NextResponse.redirect(new URL("/?error=csrf", request.nextUrl.origin));
  }

  // 2. Get PKCE verifier
  const verifier = request.cookies.get("pkce_verifier")?.value;
  if (!verifier) {
    return NextResponse.redirect(new URL("/?error=no_verifier", request.nextUrl.origin));
  }

  // 3. Exchange code for session (SERVER-TO-SERVER)
  const tokenResponse = await fetch(`${IDP_SERVER}/api/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: process.env.NEXT_PUBLIC_CLIENT_ID,
      redirect_uri: process.env.NEXT_PUBLIC_REDIRECT_URI,
      code,
      code_verifier: verifier,
    }),
  });

  const tokenData = await tokenResponse.json();
  const sessionId = tokenData.session_id; // Opaque reference

  // 4. Set session cookie (NO token storage!)
  const response = NextResponse.redirect(new URL("/", request.nextUrl.origin));
  response.cookies.set("app_session_c", sessionId, {
    httpOnly: true,
    maxAge: 86400, // 1 day
    sameSite: "lax",
  });
  response.cookies.delete("pkce_verifier");
  response.cookies.delete("oauth_state");

  return response;
}
```

**Input**: Query params `code`, `state` (from IDP redirect)  
**Output**: Redirect to `/`  
**Cookies**: Set `app_session_c`, delete temp cookies

---

### 3️⃣ POST /api/me
**Validates session & returns user data**

```typescript
// app/api/me/route.ts
export async function GET(request: NextRequest) {
  const appSessionCookie = request.cookies.get("app_session_c")?.value;

  if (!appSessionCookie) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  // CRITICAL: Forward cookies to IDP (enables cross-domain session validation)
  const cookieHeader = request.headers.get("cookie") || "";

  const validateResponse = await fetch(`${IDP_SERVER}/api/auth/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookieHeader, // ← Must forward!
      "x-session-id": appSessionCookie,
      "x-client-id": process.env.NEXT_PUBLIC_CLIENT_ID,
    },
    body: JSON.stringify({
      _csrf: request.cookies.get("__csrf")?.value || "",
    }),
  });

  if (!validateResponse.ok) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const userData = await validateResponse.json();
  const response = NextResponse.json({
    authenticated: true,
    user: userData.user,
    account: userData.account,
    accounts: userData.accounts,
    activeAccountId: userData.activeAccountId,
  });

  // Forward IDP's Set-Cookie headers (updates CSRF token)
  validateResponse.headers.getSetCookie().forEach(cookie => {
    response.headers.append("Set-Cookie", cookie);
  });

  return response;
}
```

**Input**: 
```json
Body: { "_csrf": "token_value" }
Cookies: app_session_c, __sso_session, __csrf
```

**Output** (Success - 200):
```json
{
  "authenticated": true,
  "user": {
    "id": "user123",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "activeAccountId": "account123"
}
```

**Output** (Unauthorized - 401):
```json
{
  "authenticated": false
}
```

---

## 🔄 Complete Login Flow

```
Step 1: User clicks "Sign In" button
        └─> Frontend calls /api/auth/start

Step 2: /api/auth/start (your backend)
        ├─ Generates state (CSRF protection)
        ├─ Generates PKCE challenge
        ├─ Sets oauth_state cookie (signed)
        ├─ Sets pkce_verifier cookie
        └─ Returns { url: "https://idp/api/auth/authorize?..." }

Step 3: Frontend redirects to IDP authorize URL
        └─> User logs in at IDP
        └─> IDP generates authorization code
        └─> IDP redirects to /api/auth/callback?code=xxx&state=yyy

Step 4: /api/auth/callback (your backend)
        ├─ Validates state signature
        ├─ Gets PKCE verifier from cookie
        ├─ Exchanges code + verifier for session_id (server-to-server)
        ├─ Sets app_session_c cookie with session_id
        └─ Redirects to home page /

Step 5: Frontend mounts / page
        └─> useEffect calls /api/me

Step 6: /api/me (your backend)
        ├─ Reads app_session_c cookie
        ├─ Forwards ALL cookies to IDP /api/auth/session
        ├─ IDP validates __sso_session cookie
        ├─ IDP returns user data
        └─ Backend returns user data to frontend

Step 7: Frontend receives user data
        └─> Sets session state
        └─> Shows authenticated UI
```

---

## 🍪 Cookie Reference

| Cookie         | Domain  | Max Age | HttpOnly | Purpose                           |
|----------------|---------|---------|---------|-----------------------------------|
| app_session_c  | Your app| 1 day   | ✅      | **Opaque session reference** (only store this!) |
| oauth_state    | Your app| 10 min  | ✅      | CSRF state for OAuth (temp)       |
| pkce_verifier  | Your app| 5 min   | ✅      | PKCE challenge (temp)             |
| __sso_session  | IDP     | 24h     | ✅      | IDP server session                |
| __csrf         | IDP     | Variable| ✅      | CSRF token (auto-refreshed)       |

**Key Principle**: Your app only stores `app_session_c` (opaque). All tokens stay on IDP. Session always validated via `/api/me` call.

---

## 🎯 Frontend Integration (React/Next.js)

```typescript
// pages/index.tsx or app/page.tsx
'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch session on mount
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'include' });
        const data = await res.json();
        setSession(data.authenticated ? data : null);
      } catch {
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, []);

  // Re-validate session on visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetch('/api/me', { credentials: 'include' })
          .then(r => r.json())
          .then(data => setSession(data.authenticated ? data : null));
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {session ? (
        <div>
          <h1>Welcome, {session.user.name}!</h1>
          <p>Email: {session.user.email}</p>
        </div>
      ) : (
        <div>
          <p>Not logged in</p>
          {/* Widget button goes here - loads from IDP script */}
        </div>
      )}
    </div>
  );
}
```

---

## ⚙️ Environment Setup

```env
NEXT_PUBLIC_IDP_SERVER=http://localhost:3000
NEXT_PUBLIC_CLIENT_ID=your-client-id
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3003/api/auth/callback
NEXT_PUBLIC_OAUTH_STATE_SECRET=your-secure-random-secret
```

---

## 📋 Widget Integration

Add this to your `app/layout.tsx`:

```typescript
export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <Script
          src={`${process.env.NEXT_PUBLIC_IDP_SERVER}/api/widget.js`}
          strategy="afterInteractive"
        />
      </head>
      <body>
        {children}
        <div id="__account_switcher_mount_point" />
      </body>
    </html>
  );
}
```

---

## 🔒 Security Checklist

- ✅ Use PKCE (code_challenge + code_verifier)
- ✅ Store CSRF state in signed HttpOnly cookie
- ✅ **Never store access_token or refresh_token in cookies/localStorage**
- ✅ Only store opaque session ID (app_session_c)
- ✅ Forward Cookie header on server-to-server calls
- ✅ Validate message origin when using postMessage
- ✅ Use HttpOnly + Secure + SameSite=Lax cookies
- ✅ Always call /api/me to validate session, never trust frontend

---

## 🚀 Account Switching & Logout

### Account Switch (via Widget)
Widget iframe sends: `{ type: 'sessionUpdate' }`  
→ Frontend calls `/api/me` again  
→ Gets new `activeAccountId` and user data

### Logout
Widget iframe sends: `{ type: 'logout' }` or `{ type: 'globalLogout' }`  
→ Frontend clears session state  
→ Shows "Not logged in" UI

---

## ❌ Common Mistakes to Avoid

1. **Storing tokens**: Never put access_token in cookies/localStorage
2. **Forgetting Cookie header**: Must forward cookies on server-to-server `/api/me` call
3. **Missing PKCE**: Always implement code_challenge + code_verifier
4. **Not validating CSRF**: Always verify state signature before token exchange
5. **Trusting frontend**: Always validate session via backend `/api/me` call


## 🎓 Key Concepts

**PKCE (Proof Key for Public Clients)**
- Frontend generates random `verifier`
- Backend hashes it as `challenge`
- When exchanging code, include original `verifier`
- Prevents authorization code interception

**CSRF State**
- random `state` stored in signed cookie
- returned by IDP in callback
- signature verified before token exchange
- prevents cross-site request forgery

**Opaque Session ID**
- IDP returns `session_id` (not JWT or token)
- Frontend/client stores only this ID
- Backend uses it in `/api/me` calls
- All actual auth data stays on IDP

**Cookie Forwarding**
- Browser sends cookies with `/api/me` call
- Backend MUST extract and forward to IDP
- Enables IDP server to read `__sso_session`
- This is how cross-domain session works
