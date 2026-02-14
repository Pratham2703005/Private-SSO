# Widget Development – Testcases (Stages 13-25)

**Previous stages (1-12):** Core OAuth2, PKCE, tokens, refresh, account switching foundation  
**These stages (13-25):** Widget UI, iframe delivery, account management popup, multi-account flows

---

# STAGE 13 — Widget API: Account List Endpoint

### Objective
IDP exposes `/api/widget/accounts` without exposing tokens.

### Implement (IDP)
- GET `/api/widget/accounts` → returns account list with indices

---

## ✅ Testcases

### Prep: Create multi-account session
```bash
# Account A login
curl -i -c cookies.txt \
  -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"account-a@example.com","password":"123456"}'

# Account B login (reuses IDP session)
curl -i -b cookies.txt -c cookies.txt \
  -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"account-b@example.com","password":"123456"}'
```

### Test 1: Fetch accounts list
```bash
curl -i -b cookies.txt http://localhost:3000/api/widget/accounts
```

**Expected:** 200 OK
```json
{
  "accounts": [
    {
      "index": 0,
      "id": "uuid-account-a",
      "email": "account-a@example.com",
      "name": "Account A",
      "avatar": "https://...",
      "isPrimary": true
    },
    {
      "index": 1,
      "id": "uuid-account-b",
      "email": "account-b@example.com",
      "name": "Account B",
      "avatar": "https://...",
      "isPrimary": false
    }
  ],
  "activeIndex": 1
}
```

### Test 2: Deterministic ordering
```bash
curl -i -b cookies.txt http://localhost:3000/api/widget/accounts
curl -i -b cookies.txt http://localhost:3000/api/widget/accounts
```

**Expected:** Identical `activeIndex` and account order (by `logged_in_at ASC`)

### Test 3: No tokens exposed
```bash
curl -i -b cookies.txt http://localhost:3000/api/widget/accounts | grep -i token
```

**Expected:** No `accessToken`, `token`, or `authorization` fields

### Test 4: No session = 401
```bash
curl -i http://localhost:3000/api/widget/accounts
```

**Expected:** 401 Unauthorized

---

# STAGE 14 — Widget API: Switch Account Endpoint

### Objective
POST endpoint to switch active account (session context only, no tokens).

### Implement (IDP)
- POST `/api/widget/switch-account` with `{ index: number }`

---

## ✅ Testcases

### Test 1: Switch account
```bash
curl -i -b cookies.txt -c cookies.txt \
  -X POST http://localhost:3000/api/widget/switch-account \
  -H "Content-Type: application/json" \
  -d '{"index": 0}'
```

**Expected:** 200 OK
```json
{
  "success": true,
  "newActiveIndex": 0,
  "activeId": "uuid-account-a"
}
```

### Test 2: Session updated
```bash
curl -i -b cookies.txt http://localhost:3000/api/widget/accounts
```

**Expected:** `activeIndex: 0` (changed from 1)

### Test 3: Invalid index
```bash
curl -i -b cookies.txt \
  -X POST http://localhost:3000/api/widget/switch-account \
  -H "Content-Type: application/json" \
  -d '{"index": 999}'
```

**Expected:** 403 Forbidden or 400 Bad Request

### Test 4: No tokens returned
```bash
curl -i -b cookies.txt -c cookies.txt \
  -X POST http://localhost:3000/api/widget/switch-account \
  -H "Content-Type: application/json" \
  -d '{"index": 1}' | grep -i token
```

**Expected:** No `accessToken`, `refreshToken` fields

---

# STAGE 15 — Account Indexing & /u/{index} Route

### Objective
Map index to account, provide account management UI at `/u/{index}`.

### Implement (IDP)
- `lib/account-indexing.ts` utility
- GET `/u/{index}` page

---

## ✅ Testcases

### Test 1: /u/0 resolves
```bash
curl -i -b cookies.txt http://localhost:3000/u/0
```

**Expected:** 200 OK, page shows Account A details

### Test 2: /u/1 resolves differently
```bash
curl -i -b cookies.txt http://localhost:3000/u/1
```

**Expected:** 200 OK, page shows Account B details

### Test 3: Invalid index
```bash
curl -i -b cookies.txt http://localhost:3000/u/999
```

**Expected:** 404 Not Found

### Test 4: Index stable (accessing /u/0 doesn't switch)
```bash
curl -i -b cookies.txt http://localhost:3000/api/widget/accounts | head -20
curl -i -b cookies.txt http://localhost:3000/u/0 > /dev/null
curl -i -b cookies.txt http://localhost:3000/api/widget/accounts | head -20
```

**Expected:** `activeIndex` unchanged

---

# STAGE 16 — Widget Logout API

### Objective
POST `/api/widget/logout` with `mode: "app" | "global"`

### Implement (IDP)
- Per-app logout (returns logoutUrl, keeps IDP session)
- Global logout (destroys IDP session)

---

## ✅ Testcases

### Test 1: App logout
```bash
curl -i -b cookies.txt \
  -X POST http://localhost:3000/api/widget/logout \
  -H "Content-Type: application/json" \
  -d '{"mode": "app"}'
```

**Expected:** 200 OK
```json
{
  "logoutUrl": "http://localhost:3001/api/auth/logout-app"
}
```

### Test 2: Session still valid after app logout
```bash
curl -i -b cookies.txt http://localhost:3000/api/widget/accounts
```

**Expected:** 200 OK (IDP session alive)

### Test 3: Global logout
```bash
curl -i -b cookies.txt -c cookies.txt \
  -X POST http://localhost:3000/api/widget/logout \
  -H "Content-Type: application/json" \
  -d '{"mode": "global"}'
```

**Expected:** 204 No Content (cookies cleared)

### Test 4: Session destroyed
```bash
curl -i -b cookies.txt http://localhost:3000/api/widget/accounts
```

**Expected:** 401 Unauthorized

---

# STAGE 17 — Silent OIDC (/authorize?prompt=none)

### Objective
Clients silently get auth code if IDP session exists.

### Implement (IDP)
- Update `/api/auth/authorize` to handle `prompt=none`

### Implement (Clients)
- GET `/api/auth/silent-login` endpoint

---

## ✅ Testcases

### Test 1: Silent auth (valid session)
```bash
# Setup session
curl -i -c cookies.txt \
  -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}'

# Request with prompt=none
curl -i -b cookies.txt \
  "http://localhost:3000/api/auth/authorize?prompt=none&client_id=client-a&redirect_uri=http://localhost:3001/api/auth/callback&response_type=code&scope=openid%20profile&state=abc&code_challenge=xyz&code_challenge_method=S256"
```

**Expected:** 200 OK (NOT redirect)
```json
{
  "code": "auth_code_xyz",
  "state": "abc"
}
```

### Test 2: Silent auth (no session)
```bash
curl -i \
  "http://localhost:3000/api/auth/authorize?prompt=none&client_id=client-a&redirect_uri=http://localhost:3001/api/auth/callback&response_type=code&scope=openid&state=abc&code_challenge=xyz&code_challenge_method=S256"
```

**Expected:** 401 Unauthorized (NOT redirect to login)

### Test 3: Client silent-login endpoint
```bash
# Setup IDP session
curl -i -c cookies.txt \
  -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}'

# Call client endpoint
curl -i -b cookies.txt http://localhost:3001/api/auth/silent-login
```

**Expected:** Redirect to `/dashboard` (with new access/refresh tokens in cookies)

---

# STAGE 18 — widget.js Script Loading

### Objective
Injectable script available for client embedding.

### Implement (IDP)
- GET `/api/widget.js` serves JavaScript

### Implement (Clients)
- Add `<script src="https://idp.com/api/widget.js"></script>` in layout

---

## ✅ Testcases

### Test 1: Script downloadable
```bash
curl -i http://localhost:3000/api/widget.js | head -20
```

**Expected:** 200 OK, Content-Type: application/javascript

### Test 2: Valid JavaScript (not HTML error)
```bash
curl -i http://localhost:3000/api/widget.js | grep -i "<html\|error"
```

**Expected:** No HTML or error tags

### Test 3: CORS headers
```bash
curl -i -H "Origin: http://localhost:3001" http://localhost:3000/api/widget.js | grep -i "access-control"
```

**Expected:** `Access-Control-Allow-Origin: *` (or specific origin)

### Test 4: Browser test – Avatar appears
- Open `http://localhost:3001`
- Check top-right corner
- **Expected:** Circular avatar button visible, no JS errors in console

---

# STAGE 19 — Widget iframe Account Switcher Page

### Objective
iframe content page that renders account switcher UI.

### Implement (IDP)
- GET `/widget/account-switcher` with React components
  - Fetches `/api/widget/accounts`
  - Renders active account section
  - Renders accounts list (collapsible)
  - Renders actions (switch, add, logout)

---

## ✅ Testcases

### Test 1: Page accessible
```bash
curl -i -b cookies.txt http://localhost:3000/widget/account-switcher
```

**Expected:** 200 OK, HTML response

### Test 2: Page fetches accounts
```bash
# Monitor in browser DevTools Network tab
# Open http://localhost:3001 → click avatar
# Look for: GET /api/widget/accounts
```

**Expected:** Request sent with cookies, returns account list

### Test 3: Browser test – Modal opens
- Open `http://localhost:3001`
- Click avatar button
- **Expected:**
  - Semi-transparent backdrop visible
  - Account switcher card appears (360px wide)
  - Shows: Active account section + accounts list + action buttons
  - No errors in console

### Test 4: CSP headers allow embedding
```bash
curl -i -H "Origin: http://localhost:3001" http://localhost:3000/widget/account-switcher | grep -i "content-security"
```

**Expected:** `frame-ancestors http://localhost:3001 ...` (NOT `'none'`)

---

# STAGE 20 — Widget Account Switching Flow

### Objective
Click account in modal → switches → client silently re-authenticates.

### Implement
- iframe account click → POST `/api/widget/switch-account`
- iframe sends postMessage: `{type: 'accountSwitched'}`
- Parent (widget.js) triggers client `/api/auth/silent-login`
- Client gets new tokens

---

## ✅ Testcases

### Test 1: Click account in modal
- Open widget (avatar click)
- Modal shows Account A (active) + Account B + others
- Click "Account B"
- **Check Network tab:**
  - `POST /api/widget/switch-account` (on idp.com)
  - `GET /api/auth/silent-login` (on client-a.com)
- **Expected:** No manual page refresh, seamless switch

### Test 2: Modal closes after switch
- After account switched, check if modal auto-closes
- Click avatar again
- **Expected:** Modal reopens, confirming switch successful

### Test 3: Tokens updated
```bash
# Check HTTP-only cookies via Network tab or Redux DevTools
# Cookie: access_token should be new (JWT decode in online tool if needed)
```

**Expected:** New access token contains switched account's `accountId`

### Test 4: Multi-client test
- Login Client A with Account A, Client B with Account A
- Go to Client A, switch to Account B
- Check Client B: still shows Account A (independent app sessions)
- Go to Client B, switch to Account B (same IDP session)
- Both now show Account B email
- **Expected:** Account switch works per-client, IDP session shared

---

# STAGE 21 — Widget Logout Flows

### Objective
Test logout buttons: per-app + global.

### Implement
- "Sign out of this app" → iframe postMessage `logoutApp`
- "Sign out of all accounts" → iframe postMessage `logoutGlobal`

---

## ✅ Testcases

### Test 1: App logout
- Open widget
- Click "Sign out of this app"
- **Expected:**
  - Client A shows login page
  - Switch to Client B: still logged in
  - Open widget on Client A: still shows accounts (IDP session alive)

### Test 2: Global logout
- Open widget
- Click "Sign out of all accounts"
- **Expected:**
  - All cookies cleared
  - Both Client A and Client B show login page
  - `/api/widget/accounts` returns 401

### Test 3: Re-login immediately
- After logout, try logging in again
- **Expected:** Login works, new session created

---

# STAGE 22 — Widget "Add Another Account" Flow

### Objective
"Add another account" → redirects to login → returns and updates widget.

### Implement
- Button redirects to `/login?return_to=<client_url>`
- After signup/login, redirect back
- Widget refreshes automatically

---

## ✅ Testcases

### Test 1: Click "Add another account"
- Open widget
- Click "Add another account"
- **Expected:** Redirected to IDP login page

### Test 2: After login, return to client
- Login with new email (Account C)
- **Expected:** Returned to original client page (no manual nav)

### Test 3: Widget shows new account
- Open widget again
- **Expected:** Account list now has 3 accounts

### Test 4: Can switch to new account
- Click new account in list
- **Expected:** Switches + client shows new account context

---

# STAGE 23 — Widget "Manage Account" Flow

### Objective
"Manage your Account" button opens account management.

### Implement
- Button in active account section
- Redirects to `/u/{index}` (IDP)

---

## ✅ Testcases

### Test 1: Click "Manage your Account"
- Open widget
- Click "Manage your Account" in active section
- **Expected:** Opens new tab to `/u/0` (IDP domain)

### Test 2: Shows correct account
- Check IDP page: email matches active account in widget
- **Expected:** `/u/0` shows Account A if Account A was active

### Test 3: Index correct for different active
- Switch to Account B in widget
- Click "Manage your Account"
- **Expected:** Opens `/u/1` (Account B's index)

---

# STAGE 24 — Cross-Domain Widget Testing

### Objective
Same widget.js works on Client A, Client B, etc.

### Implement
- Register both clients in allowlist
- Update CSP to allow both

---

## ✅ Testcases

### Test 1: widget.js on Client A
```bash
curl -i -H "Origin: http://localhost:3001" http://localhost:3000/api/widget.js
```

**Expected:** 200 OK

### Test 2: widget.js on Client B
```bash
curl -i -H "Origin: http://localhost:3002" http://localhost:3000/api/widget.js
```

**Expected:** 200 OK

### Test 3: iframe embeds on Client A
- Open `http://localhost:3001`
- Click avatar
- **Expected:** iframe loads, modal displays

### Test 4: iframe embeds on Client B
- Open `http://localhost:3002`
- Click avatar
- **Expected:** Same behavior as Client A

### Test 5: Account switch visible across clients
- Login both with Account A
- Switch to Account B on Client A
- Go to Client B, refresh
- Check widget
- **Expected:** Account B now active on Client B (same IDP session)

---

# STAGE 25 — Security & Origin Validation

### Objective
Widget rejects unregistered origins.

---

## ✅ Testcases

### Test 1: Unregistered origin
```bash
curl -i -H "Origin: http://attacker.com" http://localhost:3000/widget/account-switcher
```

**Expected:** CSP header does NOT include `http://attacker.com`

### Test 2: postMessage validation
- Open widget on Client A
- Simulate rogue script sending postMessage
- ```javascript
  window.parent.postMessage({type: 'accountSwitched'}, 'http://attacker.com');
  ```
- **Expected:** Parent ignores (origin check fails)

### Test 3: Only registered clients in CSP
```bash
curl -i http://localhost:3000/widget/account-switcher | grep -i "content-security"
```

**Expected:** includes `http://localhost:3001 http://localhost:3002` (NOT `*`)

---

# Final Checklist (Stages 13-25)

## API Layer (13-17)
- [ ] `/api/widget/accounts` returns list with indices
- [ ] `/api/widget/switch-account` updates session (no tokens)
- [ ] `/u/{index}` resolves to account page
- [ ] `/api/widget/logout` supports app + global modes
- [ ] `/authorize?prompt=none` works (valid session → code, no session → 401)
- [ ] Client `/api/auth/silent-login` works end-to-end

## Widget Delivery (18-19)
- [ ] `widget.js` loads without errors
- [ ] `widget.js` prevents duplicate loads (`__accountSwitcherLoaded` flag)
- [ ] `/widget/account-switcher` iframe page renders
- [ ] CSP headers only allow registered origins

## User Flows (20-23)
- [ ] Click account in modal → switches → new tokens (silent)
- [ ] App logout clears only client session
- [ ] Global logout destroys IDP session
- [ ] "Add another account" → login → returns with new account visible
- [ ] "Manage account" opens correct `/u/{index}` page

## Quality (24-25)
- [ ] Widget works on all registered clients
- [ ] Unregistered origins blocked by CSP
- [ ] postMessage origin validated
- [ ] No tokens exposed to JavaScript
- [ ] No console errors on client pages

