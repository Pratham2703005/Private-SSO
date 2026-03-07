# Widget Manual Testing Guide

**Purpose:** Step-by-step manual testing for each development phase.  
**Tools Needed:** Browser (Chrome/Firefox), DevTools, curl/Postman for API tests  
**Setup Assumption:** IDP at `http://localhost:3000`, Client A at `http://localhost:3001`, Client B at `http://localhost:3002`

---

## Phase 1: Backend API Enhancements

### Before You Start
- [ ] IDP server running (`npm run dev` on idp-server)
- [ ] Database migrated (latest stage migrations applied)
- [ ] Test users created in DB (account-a@example.com, account-b@example.com, etc.)

### 1.1 Test `/api/widget/accounts` Endpoint

**Manual Steps:**

1. Open terminal and create multi-account session:
   ```bash
   # Login with Account A
   curl -i -c cookies.txt \
     -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"account-a@example.com","password":"123456"}'
   ```
   - Verify: `Set-Cookie: __sso_session=...` in response

   ```bash
   # Login with Account B (same browser session)
   curl -i -b cookies.txt -c cookies.txt \
     -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"account-b@example.com","password":"123456"}'
   ```
   - Verify: Same `__sso_session` cookie (not new session)

2. Fetch accounts list:
   ```bash
   curl -i -b cookies.txt http://localhost:3000/api/widget/accounts | jq .
   ```
   - **Expected Response:**
     ```json
     {
       "accounts": [
         {"index": 0, "id": "...", "email": "account-a@example.com", "name": "Account A", "avatar": "...", "isPrimary": true},
         {"index": 1, "id": "...", "email": "account-b@example.com", "name": "Account B", "avatar": "...", "isPrimary": false}
       ],
       "activeIndex": 1
     }
     ```

3. Verify deterministic ordering:
   ```bash
   # Call twice, compare responses
   curl -b cookies.txt http://localhost:3000/api/widget/accounts | jq '.accounts[].email'
   curl -b cookies.txt http://localhost:3000/api/widget/accounts | jq '.accounts[].email'
   ```
   - **Expected:** Same order both times

4. Verify no tokens in response:
   ```bash
   curl -b cookies.txt http://localhost:3000/api/widget/accounts | grep -i "token\|access\|secret"
   ```
   - **Expected:** No matches (no token fields in response)

---

### 1.2 Test `/api/widget/switch-account` Endpoint

**Manual Steps:**

1. From same session (cookies.txt still valid):
   ```bash
   # Switch to Account A (index 0)
   curl -i -b cookies.txt -c cookies.txt \
     -X POST http://localhost:3000/api/widget/switch-account \
     -H "Content-Type: application/json" \
     -d '{"index": 0}' | jq .
   ```
   - **Expected Response:**
     ```json
     {
       "success": true,
       "newActiveIndex": 0,
       "activeId": "uuid-account-a"
     }
     ```

2. Verify account switched:
   ```bash
   curl -b cookies.txt http://localhost:3000/api/widget/accounts | jq '.activeIndex'
   ```
   - **Expected:** `0` (was `1` before)

3. Test invalid index:
   ```bash
   curl -i -b cookies.txt \
     -X POST http://localhost:3000/api/widget/switch-account \
     -H "Content-Type: application/json" \
     -d '{"index": 999}'
   ```
   - **Expected:** `403 Forbidden` or `400 Bad Request`

---

### 1.3 Test `/u/{index}` Route

**Manual Steps:**

1. Open browser: `http://localhost:3000/u/0`
   - **Expected:** 
     - 200 OK
     - Page displays Account A's details (email, avatar, name)
     - URL shows `/u/0`

2. Open browser: `http://localhost:3000/u/1`
   - **Expected:**
     - 200 OK
     - Page displays Account B's details (different email than /u/0)

3. Open browser: `http://localhost:3000/u/999`
   - **Expected:** 404 Not Found

4. Check index stability:
   ```bash
   # Get current active index
   curl -b cookies.txt http://localhost:3000/api/widget/accounts | jq '.activeIndex'
   
   # Visit /u/0 in browser (don't measure, just load page)
   
   # Get active index again
   curl -b cookies.txt http://localhost:3000/api/widget/accounts | jq '.activeIndex'
   ```
   - **Expected:** Same index both times (accessing /u/0 doesn't implicitly switch active)

---

### 1.4 Test `/api/widget/logout` Endpoint

**Manual Steps:**

1. App-only logout:
   ```bash
   curl -i -b cookies.txt -c cookies.txt \
     -X POST http://localhost:3000/api/widget/logout \
     -H "Content-Type: application/json" \
     -d '{"mode": "app"}' | jq .
   ```
   - **Expected Response:**
     ```json
     {
       "logoutUrl": "http://localhost:3001/api/auth/logout-app"
     }
     ```

2. Verify IDP session still exists:
   ```bash
   curl -b cookies.txt http://localhost:3000/api/widget/accounts | jq '.accounts | length'
   ```
   - **Expected:** 2 (still shows accounts, IDP session alive)

3. Global logout:
   ```bash
   # Re-login first (from 1.1)
   curl -i -c cookies.txt \
     -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"account-a@example.com","password":"123456"}'
   
   # Then logout globally
   curl -i -b cookies.txt -c cookies.txt \
     -X POST http://localhost:3000/api/widget/logout \
     -H "Content-Type: application/json" \
     -d '{"mode": "global"}'
   ```
   - **Expected:** `204 No Content`

4. Verify session destroyed:
   ```bash
   curl -i -b cookies.txt http://localhost:3000/api/widget/accounts
   ```
   - **Expected:** `401 Unauthorized`

---

### 1.5 Test Silent OIDC (`/authorize?prompt=none`)

**Manual Steps:**

1. Establish IDP session:
   ```bash
   curl -i -c cookies.txt \
     -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"123456"}'
   ```

2. Request silent auth code:
   ```bash
   curl -i -b cookies.txt \
     "http://localhost:3000/api/auth/authorize?prompt=none&client_id=client-a&redirect_uri=http://localhost:3001/api/auth/callback&response_type=code&scope=openid%20profile&state=abc&code_challenge=xyz&code_challenge_method=S256"
   ```
   - **Expected:** 
     - `200 OK` (NOT 302 redirect)
     - Response body: `{"code": "...", "state": "abc"}`

3. Without session (should fail gracefully):
   ```bash
   # Use different cookie file (no session)
   curl -i -c cookies-none.txt \
     "http://localhost:3000/api/auth/authorize?prompt=none&client_id=client-a&redirect_uri=http://localhost:3001/api/auth/callback&response_type=code&scope=openid&state=abc&code_challenge=xyz&code_challenge_method=S256"
   ```
   - **Expected:** `401 Unauthorized`

---

## Phase 2: Widget Bootstrap & Security

### 2.1 Test `widget.js` Script

**Manual Steps:**

1. Download script:
   ```bash
   curl -i http://localhost:3000/api/widget.js | head -30
   ```
   - **Expected:**
     - `200 OK`
     - `Content-Type: application/javascript`
     - Response starts with valid JavaScript (not HTML/error)

2. Check CORS headers:
   ```bash
   curl -i -H "Origin: http://localhost:3001" http://localhost:3000/api/widget.js | grep -i "access-control"
   ```
   - **Expected:** `Access-Control-Allow-Origin: *` (or specific origin)

3. Inspect for duplicate loading flag:
   ```bash
   curl http://localhost:3000/api/widget.js | grep "accountSwitcherLoaded\|__sso"
   ```
   - **Expected:** References to `window.__accountSwitcherLoaded` flag

4. **Browser Test:** Add to client layout
   - Edit `client-a/app/layout.tsx`
   - Add in `<body>`: `<script src="http://localhost:3000/api/widget.js"></script>`
   - Save and reload `http://localhost:3001`
   - **Expected:**
     - Avatar button appears top-right corner
     - Console shows no errors (or 1st load, then 'already loaded' on reload)
     - Avatar is circular, ~40x40px

---

### 2.2 Test iframe CSP Headers

**Manual Steps:**

1. Check CSP on iframe page:
   ```bash
   curl -i -H "Origin: http://localhost:3001" http://localhost:3000/widget/account-switcher | grep -i "content-security"
   ```
   - **Expected:** `frame-ancestors http://localhost:3001 http://localhost:3002 ...`
   - **NOT:** `frame-ancestors *`

2. Test unregistered origin:
   ```bash
   curl -i -H "Origin: http://attacker.example.com" http://localhost:3000/widget/account-switcher | grep -i "content-security"
   ```
   - **Expected:** CSP header does NOT include `attacker.example.com`

---

## Phase 3: Widget UI Components (iframe)

### 3.1 Test `/widget/account-switcher` Page Load

**Manual Steps:**

1. Direct curl test:
   ```bash
   curl -i -b cookies.txt http://localhost:3000/widget/account-switcher | head -50
   ```
   - **Expected:** 200 OK, HTML response with React content

2. **Browser Test:** Open iframe directly (for debugging)
   - In DevTools, fetch from IDP domain: `http://localhost:3000/widget/account-switcher`
   - **Expected:** Background white, no errors visible

---

### 3.2 Test Widget Modal UI (Browser)

**Setup:** 
- Multi-account session established (from Phase 1 test 1.1)
- widget.js loaded in Client A

**Manual Steps:**

1. Open `http://localhost:3001` in fresh tab
2. Click avatar button (top-right)
   - **Expected:**
     - Semi-transparent dark overlay appears
     - Modal card appears (360px wide, rounded corners, shadow)
     - Modal shows:
       - **Active Account Section:** Large avatar + email + "Hi, {name}!" greeting + "Manage your Account" button
       - **Accounts List Section:** Heading "More Accounts" (collapsible or expanded)
         - List of 1+ other accounts (small avatar + name + email)
       - **Actions Section:** 2-3 buttons
         - "Add another account"
         - "Sign out of this app" (optional)
         - "Sign out of all accounts"

3. Check modal styling:
   - Backdrop is semi-transparent (can see page behind but dimmed)
   - Modal has rounded corners (8px minimum)
   - No console errors
   - Text is readable (good contrast)

4. Click backdrop (outside modal):
   - **Expected:** Modal closes

5. Click avatar again:
   - **Expected:** Modal reopens

---

## Phase 4: Client-Side Integration

### 4.1 Test Client `silent-login` Endpoint

**Manual Steps:**

1. Ensure IDP session exists:
   ```bash
   curl -i -c cookies.txt \
     -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"123456"}'
   ```

2. Call client silent-login:
   ```bash
   curl -i -b cookies.txt -c client-cookies.txt \
     http://localhost:3001/api/auth/silent-login
   ```
   - **Expected:**
     - 302 or 307 redirect to `/dashboard`
     - Response includes `Set-Cookie` headers for `access_token`, `refresh_token`
     - Tokens are HttpOnly (not readable in cookie header, but Set-Cookie present)

3. Verify client session established:
   ```bash
   # Follow redirect to dashboard
   curl -i -b client-cookies.txt http://localhost:3001/dashboard
   ```
   - **Expected:** 200 OK, dashboard content loads

---

### 4.2 Test Client App Logout

**Manual Steps:**

1. Establish client session (from 4.1):
   ```bash
   curl -i -c cookies.txt \
     -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"123456"}'
   
   curl -i -b cookies.txt -c client-cookies.txt \
     http://localhost:3001/api/auth/silent-login
   ```

2. Call app logout:
   ```bash
   curl -i -b client-cookies.txt -c client-cookies.txt \
     -X POST http://localhost:3001/api/auth/logout-app
   ```
   - **Expected:** 302/307 redirect to `/`
   - Response clears tokens (Set-Cookie with expiry)

3. Verify client session destroyed:
   ```bash
   curl -i -b client-cookies.txt http://localhost:3001/dashboard
   ```
   - **Expected:** 401 or redirect to login

4. Verify IDP session still alive:
   ```bash
   curl -i -b cookies.txt http://localhost:3000/api/widget/accounts
   ```
   - **Expected:** 200 OK (IDP session not affected)

---

## Phase 5: Account Switching Flow (Integration)

### 5.1 End-to-End Account Switch (Browser)

**Setup:**
- Multi-account session (Account A active, Account B available)
- Both clients logged in with Account A
- widget.js loaded on both

**Manual Steps:**

1. Open `http://localhost:3001` and `http://localhost:3002` side-by-side
2. Both show Account A context (in nav/profile)
3. On Client A, click avatar → modal opens
4. In modal, click "Account B" (other account)
   - **Check Network tab (DevTools):**
     - `POST /api/widget/switch-account` called on IDP
     - `GET /api/auth/silent-login` called on Client A
     - No errors
   - **Expected:**
     - Modal closes
     - Client A nav/profile now shows Account B email
     - No manual page refresh was needed

5. Check Client B (side-by-side):
   - Client B **still shows Account A** (separate app sessions)
   - This is correct (IDP session is shared, but client sessions are independent)

6. On Client B, switch to Account B:
   - **Expected:** Client B now also shows Account B

7. Refresh both clients:
   - **Expected:** Both still show Account B (tokens persisted in cookies)

---

### 5.2 Test Logout Flows (Browser)

**Setup:** Multi-account session, both clients logged in

**App-Only Logout:**
1. On Client A, click avatar → modal
2. Click "Sign out of this app"
   - **Expected:**
     - Client A shows login page
     - Client B still logged in (switch to Client B tab, still on dashboard)
     - Refresh Client A: still login page

3. On Client A, open avatar again (or try by URL hacking):
   - **Expected:** Avatar still shows (IDP session exists)
   - Can see accounts in modal

**Global Logout:**
1. On Client A, click avatar → modal
2. Click "Sign out of all accounts"
   - **Expected:**
     - Client A shows login page
     - Client B **also** shows login page (global session destroyed)
     - Open Developer Tools:
       - Check cookie: `__sso_session` cleared
       - All IDP cookies gone

3. Try to access widget:
   ```bash
   curl -b cookies.txt http://localhost:3000/api/widget/accounts
   ```
   - **Expected:** `401 Unauthorized`

---

## Phase 6: Advanced User Flows

### 6.1 "Add Another Account" Flow

**Manual Steps:**

1. Open Client A with existing account
2. Click avatar → modal
3. Click "Add another account"
   - **Expected:** Redirected to IDP login page

4. Enter new credentials (Account C):
   - Email: `account-c@example.com`
   - Password: `123456`
   - Click "Sign up" or "Create account"

5. After signup/login:
   - **Expected:**
     - Redirected back to Client A (same URL/page as before)
     - No manual navigation needed

6. Open widget again (avatar click):
   - **Expected:** Accounts list now shows 3 accounts (A, B, C)

7. Click new account (Account C):
   - **Expected:** Switch works, Client A now shows Account C email

---

### 6.2 "Manage Account" Flow

**Manual Steps:**

1. Open Client A with multi-account session
2. Click avatar → modal
3. Verify active account shown (e.g., "Account B")
4. Click "Manage your Account" button
   - **Expected:**
     - New tab/window opens
     - URL is `http://localhost:3000/u/1` (index 1 for Account B)
     - Page shows Account B's email + avatar + management options

5. Switch account (in original modal):
   - Close "Manage Account" tab
   - Click avatar → modal
   - Switch to Account A

6. Click "Manage your Account" again:
   - **Expected:** New tab opens to `/u/0` (Account A's index)
   - Shows Account A's email

---

## Phase 7: Cross-Domain Testing

### 7.1 Widget on Multiple Clients

**Manual Steps:**

1. Open `http://localhost:3001` (Client A)
   - Avatar appears
   - Click avatar → closes

2. Open `http://localhost:3002` (Client B)
   - Avatar appears
   - Click avatar → modal opens

3. On Client A: open widget, switch to Account B
4. On Client B: open widget, should initially show Account A (independent sessions)
5. On Client B: switch to Account B
6. Refresh both: both show Account B (shared IDP session)

---

### 7.2 Security Test: Unregistered Origin

**Manual Steps:**

1. Temporarily remove one client from allowlist:
   - Edit `idp-server/config/widget-clients.ts`
   - Remove `http://localhost:3001`
   - Restart IDP server

2. Try to load widget on Client A:
   ```bash
   curl -i -H "Origin: http://localhost:3001" http://localhost:3000/widget/account-switcher | grep frame-ancestors
   ```
   - **Expected:** CSP header does NOT include `http://localhost:3001`

3. Open `http://localhost:3001` in browser:
   - Avatar may load (widget.js is public)
   - Click avatar → iframe should **fail to load** (CSP blocks)
   - Check DevTools: Blocked by CSP error message

4. Restore client to allowlist:
   - Add back `http://localhost:3001`
   - Restart IDP
   - Refresh Client A: avatar click now works again

---

## Final Verification Checklist

### Browser (Manual)
- [ ] Avatar button appears on Client A
- [ ] Avatar button appears on Client B
- [ ] Avatar click opens modal (not blank iframe)
- [ ] Modal shows active account section (avatar + email + greeting)
- [ ] Modal shows accounts list (collapsible "More Accounts")
- [ ] Click account → switches (no manual refresh)
- [ ] "Add another account" → redirects to login → returns with new account visible
- [ ] "Manage Account" → opens `/u/{index}` with correct account
- [ ] "Sign out of this app" → Client A logs out, Client B unaffected, IDP session alive
- [ ] "Sign out of all accounts" → all sessions destroyed, both clients redirect to login
- [ ] No console errors on any page

### API (Terminal)
- [ ] `/api/widget/accounts` returns list with indices
- [ ] `/api/widget/switch-account` updates session (no tokens)
- [ ] `/u/{index}` resolves to correct account
- [ ] `/api/widget/logout` (app mode) returns logoutUrl
- [ ] `/api/widget/logout` (global mode) destroys session
- [ ] `prompt=none` returns code (valid session) or 401 (no session)
- [ ] Client `/api/auth/silent-login` exchanges code → new tokens
- [ ] Client `/api/auth/logout-app` clears only app session

### Security
- [ ] CSP headers restrict to registered origins only (not `*`)
- [ ] widget.js prevents duplicate loads
- [ ] postMessage events origin-checked in console (no violations)
- [ ] Tokens never in JavaScript (only HttpOnly cookies)
- [ ] Unregistered origin CSP blocks iframe (verified in DevTools)

---

## Troubleshooting

| Issue | Debug Steps |
|-------|------------|
| Avatar doesn't appear | Check: widget.js loads (204 in Network tab), `__accountSwitcherLoaded` flag, console errors |
| Modal won't open | Check: iframe loads (Network tab), CSP headers allow origin, iframe src correct |
| Switch doesn't work | Check: `/api/widget/switch-account` called (Network tab), postMessage events, `/api/auth/silent-login` called |
| Logout doesn't work | Check: `/api/widget/logout` response, cookies cleared, session destroyed (`/api/widget/accounts` → 401) |
| "Manage Account" broken | Check: `/u/{index}` route exists, index resolves correctly, account details load |
| Cross-domain fails | Check: allowlist config, CSP headers include both origins, CORS headers on widget.js |

