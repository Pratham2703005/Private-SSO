# Widget Development Tasks

**Status:** Ready for Implementation  
**Architecture:** iframe-based widget on IDP domain  
**Key Constraint:** Tokens always server-side, Origin validation on all postMessage

---

## Phase 1: Backend API Enhancements (idp-server)

### Task 1.1: Create Widget Accounts Endpoint
**File:** `idp-server/app/api/widget/accounts/route.ts`

**Responsibility:** GET endpoint returning all accounts in current IDP session

**Requirements:**
- Validate `__sso_session` cookie exists
- Query `session_logons` table for current session
- Resolve account details (email, name, avatar_url) from `user_accounts`
- Determine index: position in ordered list (by `logged_in_at ASC`)
- Return active account index

**Response:**
```json
{
  "accounts": [
    {
      "index": 0,
      "id": "uuid-account-1",
      "email": "user@example.com",
      "name": "Account One",
      "avatar": "https://idp.com/avatars/...",
      "isPrimary": true
    },
    {
      "index": 1,
      "id": "uuid-account-2",
      "email": "second@example.com",
      "name": "Account Two",
      "avatar": "https://idp.com/avatars/...",
      "isPrimary": false
    }
  ],
  "activeIndex": 0
}
```

**Dependencies:**
- Session validation middleware
- Account indexing utility (Task 1.5)

---

### Task 1.2: Create Widget Switch Account Endpoint
**File:** `idp-server/app/api/widget/switch-account/route.ts`

**Responsibility:** POST endpoint to switch active account

**Requirements:**
- POST body: `{ index: number }`
- Validate index maps to account in current session
- Update `sessions.active_account_id` to new account
- Update `session_logons.last_active_at` for new account
- Return success response (no tokens)

**Response:**
```json
{
  "success": true,
  "newActiveIndex": 1,
  "activeId": "uuid-account-2"
}
```

**Error Cases:**
- `400 Bad Request` - Invalid index
- `403 Forbidden` - Account not in session
- `401 Unauthorized` - No IDP session

**Notes:**
- Tokens NOT returned here
- Called from iframe (same origin as IDP)
- Client will trigger silent OIDC after receiving this response

---

### Task 1.3: Create Widget Logout Endpoint
**File:** `idp-server/app/api/widget/logout/route.ts`

**Responsibility:** POST endpoint for per-app or global logout

**Requirements:**
- POST body: `{ mode: "app" | "global" }`
- If `mode: "app"`:
  - Return logout URL for calling client: `{ logoutUrl: "https://client-a.com/api/auth/logout-app" }`
  - Do NOT destroy IDP session
- If `mode: "global"`:
  - Mark all logons in session as revoked
  - Clear `__sso_session` and `sso_refresh_token` cookies
  - Return 204 No Content

**Response (app mode):**
```json
{
  "logoutUrl": "https://client-a.com/api/auth/logout-app"
}
```

**Response (global mode):**
- 204 No Content (with cleared cookies)

**Dependencies:**
- Detect calling origin (from iframe postMessage, or request origin)
- Client origin mapping (Task 4.1)

---

### Task 1.4: Verify `/authorize?prompt=none` Flow
**File:** `idp-server/app/api/auth/authorize/route.ts` (update existing)

**Responsibility:** Ensure silent auth code flow works

**Requirements:**
- If `prompt=none` in query:
  - Check if valid `__sso_session` exists
  - Check if `active_account_id` is set
  - If both valid: silently issue authorization code (no UI redirect)
  - If invalid: return 401 Unauthorized
- Standard auth flow unaffected

**Success Response (prompt=none):**
```json
{
  "code": "auth_code_xyz",
  "expiresAt": 1707663600
}
```

**Error Response (prompt=none):**
- `401 Unauthorized` - No valid IDP session or account

---

### Task 1.5: Create Account Indexing Utility
**File:** `idp-server/lib/account-indexing.ts`

**Responsibility:** Map between account index and account ID

**Functions:**
```typescript
// Get account by index (session-aware)
export async function getAccountByIndex(
  sessionId: string, 
  index: number
): Promise<Account | null>

// Get index by account ID (session-aware)
export async function getIndexByAccountId(
  sessionId: string, 
  accountId: string
): Promise<number | null>

// List all accounts with indices
export async function getAllAccountsWithIndices(
  sessionId: string
): Promise<IndexedAccount[]>
```

**Query Logic:**
- SELECT from `session_logons` WHERE session_id = ?
- ORDER BY `logged_in_at ASC`
- Assign index 0, 1, 2, ... in order
- Skip revoked logons

**Dependencies:**
- Database connection
- Types: `Account`, `IndexedAccount`

---

### Task 1.6: Create `/u/{index}` Route (IDP)
**File:** `idp-server/app/u/[index]/page.tsx`

**Responsibility:** Resolve index to account and render account manage page

**Requirements:**
- Route param: `index` (0, 1, 2, ...)
- Resolve to account via Task 1.5
- If invalid index: return 404
- Server-render account info (avatar, email, name, etc.)
- Show account management UI (settings, connected apps, etc.)
- Can be same UI as `/u/[accountId]` but URL is index-based

**Implementation Option:**
```typescript
// Option A: Redirect to accountId
const account = await getAccountByIndex(sessionId, index);
redirect(`/u/${account.id}`);

// Option B: Render directly
// Reuse account-manage component
```

---

## Phase 2: Widget Bootstrap & Security (idp-server)

### Task 2.1: Create widget.js Script Route
**File:** `idp-server/app/api/widget.js/route.ts`

**Responsibility:** Serve injectable widget script

**Requirements:**
- GET endpoint returning compiled JavaScript
- Script injects avatar button into client page
- Script sets up single global `message` event listener
- On avatar click: injects iframe modal
- Validates all postMessage by origin check: `event.origin === 'https://idp.com'`
- Prevents multiple loads (`window.__accountSwitcherLoaded` flag)

**Code Structure:**
```typescript
export async function GET(req: Request) {
  const widgetScript = `
    (function(window) {
      if (window.__accountSwitcherLoaded) return;
      window.__accountSwitcherLoaded = true;
      
      const IDP_ORIGIN = 'https://idp.com';
      const WIDGET_URL = '${IDP_ORIGIN}/widget/account-switcher';
      let iframeModal = null;
      
      // Global message listener (ONCE ONLY)
      window.addEventListener('message', (event) => {
        if (event.origin !== IDP_ORIGIN) return;
        // Handle: closeAccountSwitcher, accountSwitched, logoutApp, logoutGlobal
      });
      
      function openAccountSwitcher() { ... }
      function triggerSilentLogin() { ... }
      function logoutApp(logoutUrl) { ... }
      
      // Create avatar button
      const container = document.createElement('div');
      // ... button styles and click handler
    })(window);
  `;
  
  return new Response(widgetScript, {
    headers: {
      'Content-Type': 'application/javascript',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
```

**Security Checks:**
- ✅ Origin validation on all postMessage
- ✅ Sandbox iframe with `allow-same-origin allow-popups allow-popups-to-escape-sandbox`
- ✅ No tokens in postMessage
- ✅ Single listener (not repeated)

---

### Task 2.2: Create widget/account-switcher Page
**File:** `idp-server/app/widget/account-switcher/page.tsx`

**Responsibility:** iframe content page (on IDP domain)

**Requirements:**
- Server component that fetches `/api/widget/accounts`
- Renders modal UI with:
  - Active account section (Task 3.1)
  - Accounts list section (Task 3.2)
  - Actions section (Task 3.3)
- All interactions use postMessage to parent
- Layout: 360px width, dropdown style

**Structure:**
```tsx
export default async function AccountSwitcherPage() {
  const accounts = await fetch('/api/widget/accounts', {
    headers: { cookie: 'from request' }
  });
  
  return (
    <div className="p-4 bg-white rounded-lg">
      <ActiveAccountSection account={accounts.accounts[accounts.activeIndex]} />
      <AccountsList accounts={accounts.accounts} activeIndex={accounts.activeIndex} />
      <ActionsSection />
    </div>
  );
}
```

**Security:**
- Server-side fetch (has cookies)
- No tokens exposed
- Client components handle postMessage

---

### Task 2.3: Update Middleware CSP Headers
**File:** `idp-server/middleware.ts` (update existing)

**Responsibility:** Set CSP frame-ancestors for widget safety

**Requirements:**
- For `/widget/account-switcher`: `Content-Security-Policy: frame-ancestors <allowlist>`
- Allowlist = all registered client origins
- Never use `frame-ancestors *`
- For other routes: `frame-ancestors 'none'`

**Implementation:**
```typescript
if (req.nextUrl.pathname === '/widget/account-switcher') {
  const origins = WIDGET_ALLOWED_CLIENTS.map(c => c.origin).join(' ');
  res.headers.set(
    'Content-Security-Policy',
    `frame-ancestors ${origins}`
  );
}
```

---

## Phase 3: Widget UI Components (iframe)

### Task 3.1: Active Account Section Component
**File:** `idp-server/components/widget/active-account-card.tsx`

**Props:**
```typescript
interface ActiveAccountCardProps {
  account: {
    id: string;
    email: string;
    name: string;
    avatar: string;
  };
}
```

**Renders:**
- Large circular avatar (64x64px)
- Email below avatar
- Greeting: "Hi, {name}!"
- Primary CTA button: "Manage your Account"
  - Click: `window.top.location.href = '/u/{index}'` (index from props or context)

**Styling:**
- Center-aligned
- Padding: 24px
- Border-bottom: 1px solid #e0e0e0

---

### Task 3.2: Accounts List Section Component
**File:** `idp-server/components/widget/accounts-list.tsx`

**Props:**
```typescript
interface AccountsListProps {
  accounts: Array<{
    index: number;
    id: string;
    email: string;
    name: string;
    avatar: string;
  }>;
  activeIndex: number;
}
```

**Renders:**
- Collapsible header: "More Accounts" (if other accounts exist)
- List of accounts (excluding active)
- Each account entry:
  - Small avatar (32x32px)
  - Name + email (stacked)
  - Click handler:
    ```typescript
    onClick={async () => {
      const res = await fetch('/api/widget/switch-account', {
        method: 'POST',
        body: JSON.stringify({ index }),
        credentials: 'include',
      });
      if (res.ok) {
        window.parent.postMessage(
          { type: 'accountSwitched' },
          'https://client-a.com' // Parent origin
        );
      }
    }}
    ```

**Styling:**
- Max-height for collapsible (animate on expand/collapse)
- Hover effect on account rows
- Padding: 12px per row

---

### Task 3.3: Actions Section Component
**File:** `idp-server/components/widget/actions-section.tsx`

**Renders:**
- "Add another account" button
  - Click: `window.top.location.href = '/login?return_to=' + document.referrer`
  
- "Sign out of this app" button (optional, if multi-app)
  - Click:
    ```typescript
    onClick={async () => {
      const res = await fetch('/api/widget/logout', {
        method: 'POST',
        body: JSON.stringify({ mode: 'app' }),
        credentials: 'include',
      });
      const data = await res.json();
      window.parent.postMessage(
        { type: 'logoutApp', logoutUrl: data.logoutUrl },
        'https://client-a.com'
      );
    }}
    ```

- "Sign out of all accounts" button
  - Click:
    ```typescript
    onClick={async () => {
      const res = await fetch('/api/widget/logout', {
        method: 'POST',
        body: JSON.stringify({ mode: 'global' }),
        credentials: 'include',
      });
      if (res.ok) {
        window.parent.postMessage(
          { type: 'logoutGlobal' },
          'https://client-a.com'
        );
      }
    }}
    ```

**Styling:**
- Buttons: full width
- Spacing: 8px between buttons
- Padding: 12px 0
- Border-top: 1px solid #e0e0e0

---

## Phase 4: Client-Side Required Implementation

### Task 4.1: Client Silent Login Endpoint (REQUIRED)
**File:** `client-a/app/api/auth/silent-login/route.ts` (and same for client-b)

**Responsibility:** Silent OIDC flow after account switch

**Requirements:**
- GET endpoint
- Call IDP `/api/auth/authorize?prompt=none&client_id=client-a&redirect_uri=...`
- If success (200): receive auth code
  - Exchange code for tokens via `/api/auth/get-token` (server-side)
  - Store access + refresh tokens in httpOnly cookies
  - Redirect to `/dashboard` (or referrer)
- If failure (401/error): redirect to `/login`

**Implementation:**
```typescript
export async function GET(req: Request) {
  try {
    const authUrl = new URL('https://idp.com/api/auth/authorize');
    authUrl.searchParams.set('prompt', 'none');
    authUrl.searchParams.set('client_id', 'client-a');
    authUrl.searchParams.set('redirect_uri', 'https://client-a.com/api/auth/callback');
    
    const authRes = await fetch(authUrl.toString(), {
      credentials: 'include',
    });
    
    if (!authRes.ok) {
      return redirect('/login');
    }
    
    const { code } = await authRes.json();
    
    // Exchange code for tokens
    const tokenRes = await fetch('https://idp.com/api/auth/get-token', {
      method: 'POST',
      body: JSON.stringify({
        code,
        client_id: 'client-a',
        client_secret: process.env.NEXT_PUBLIC_CLIENT_SECRET,
      }),
    });
    
    const { access_token, refresh_token } = await tokenRes.json();
    
    // Store in httpOnly cookies
    const response = redirect('/dashboard');
    response.cookies.set('access_token', access_token, { httpOnly: true });
    response.cookies.set('refresh_token', refresh_token, { httpOnly: true });
    
    return response;
  } catch (error) {
    return redirect('/login');
  }
}
```

**Errors to Handle:**
- Network timeout
- Invalid IDP response
- Code exchange failure
- Missing client_secret

---

### Task 4.2: Client App-Only Logout Endpoint (Optional)
**File:** `client-a/app/api/auth/logout-app/route.ts`

**Responsibility:** Sign out from client app only (keep IDP session)

**Requirements:**
- POST endpoint
- Clear client-side session cookies (access_token, refresh_token)
- Do NOT touch IDP cookies
- Redirect to `/` or login screen

**Implementation:**
```typescript
export async function POST(req: Request) {
  const response = redirect('/');
  response.cookies.delete('access_token');
  response.cookies.delete('refresh_token');
  return response;
}
```

---

### Task 4.3: Load Widget Script in Client Layout
**File:** `client-a/app/layout.tsx` (and client-b)

**Update:** Add script tag in `<body>` element

**Current:**
```tsx
<body>
  {/* existing content */}
</body>
```

**Updated:**
```tsx
<body>
  {/* existing content */}
  <script src="https://idp.com/widget.js"></script>
</body>
```

---

## Phase 5: Security & Configuration

### Task 5.1: Create Widget Client Allowlist
**File:** `idp-server/config/widget-clients.ts`

**Responsibility:** Define allowed client origins for widget embedding

**Implementation:**
```typescript
export interface WidgetClient {
  origin: string;
  clientId: string;
  name: string;
}

export const WIDGET_ALLOWED_CLIENTS: WidgetClient[] = [
  {
    origin: 'https://client-a.com',
    clientId: 'client-a',
    name: 'Client A Production',
  },
  {
    origin: 'https://client-b.com',
    clientId: 'client-b',
    name: 'Client B Production',
  },
  {
    origin: 'http://localhost:3001',
    clientId: 'client-a-dev',
    name: 'Client A Development',
  },
];

export function isAllowedWidgetClient(origin: string): boolean {
  return WIDGET_ALLOWED_CLIENTS.some(c => c.origin === origin);
}
```

**Usage:**
- Import in Task 2.3 (middleware CSP)
- Import in Task 1.2 (validate postMessage origin if needed)

---

### Task 5.2: Add Widget Config Environment Variables
**File:** `idp-server/.env.local` (or .env)

**Variables:**
```
IDP_URL=https://idp.com
NEXT_PUBLIC_WIDGET_URL=https://idp.com/widget/account-switcher
WIDGET_ALLOWED_ORIGINS=https://client-a.com,https://client-b.com,http://localhost:3001
```

---

## Phase 6: Integration Testing & Polish

### Task 6.1: Integration Test Suite
**File:** `test/widget-integration.ts`

**Test Cases:**
- [ ] GET `/api/widget/accounts` returns accounts with indices
- [ ] POST `/api/widget/switch-account` updates active account
- [ ] POST `/api/widget/logout` with mode=app returns logoutUrl
- [ ] POST `/api/widget/logout` with mode=global destroys session
- [ ] GET `/authorize?prompt=none` returns auth code (valid session)
- [ ] GET `/authorize?prompt=none` returns 401 (no session)
- [ ] Account indexing is deterministic and stable
- [ ] Cross-domain postMessage works with origin validation
- [ ] Widget script loads without duplication

---

### Task 6.2: Add Widget Styles
**File:** `idp-server/styles/widget.css` (or inline in page component)

**Styles:**
- Avatar button: 40x40px, circular, fixed position
- Modal backdrop: semi-transparent (rgba 0,0,0,0.5)
- Account switcher card: 360px width, border-radius 8px
- Hover effects on account rows
- Active account styling
- Responsive adjustments for mobile

---

## Summary Table

| Phase | Tasks | Files | Status |
|-------|-------|-------|--------|
| 1 | API endpoints (6 tasks) | 6 route files + 1 utility | Ready |
| 2 | Widget bootstrap (3 tasks) | 2 route files + 1 middleware update | Ready |
| 3 | UI components (3 tasks) | 3 component files | Ready |
| 4 | Client integration (3 tasks) | 2-3 endpoint files + 1 layout update | Required |
| 5 | Security (2 tasks) | 1 config file + env setup | Ready |
| 6 | Testing & polish (2 tasks) | 1 test file + 1 style file | Ready |
| **Total** | **19 tasks** | **~15 files** | **Production-Ready** |

---

## Implementation Order

**Recommended sequence:**
1. Phase 1 (API) → Phase 2 (Widget Bootstrap)
2. Phase 3 (UI) in parallel with Phase 4 (Client Setup)
3. Phase 5 (Security) during implementation
4. Phase 6 (Testing) after all code written

**Critical Path:**
- Task 1.5 (Account Indexing) → Task 2.2 (iframe page)
- Task 4.1 (Silent Login) → Task 2.1 (widget.js postMessage handling)
- Task 5.1 (Allowlist) → Task 2.3 (Middleware CSP)

---

## Dependencies & Blockers

**No external blockers.** System has:
- ✅ session_logons table
- ✅ /authorize flow
- ✅ /api/auth/get-token endpoint
- ✅ Existing OAuth clients (client-a, client-b)

All dependencies are internal and available.

