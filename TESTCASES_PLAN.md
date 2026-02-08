# SSO Build Plan (API‑First) — Stages + Terminal Testcases  
**Goal:** Build a Google‑style SSO (OAuth2 + OpenID Connect) in small stages.  
**Approach:** Har stage ke end me terminal se testcases run honge. UI last me.

---

## 🧱 Actors (consistent naming)
- **IDP (Auth Server):** `http://localhost:3000`
- **Client App A:** `http://localhost:3001`
- **Client App B:** `http://localhost:3002`

---

## 🔐 Non‑Negotiable Security Rules (start se)
- ✅ **Authorization Code + PKCE**
- ✅ `state` must be validated (CSRF)
- ❌ Never send `access_token` in URL
- ❌ Never send `refresh_token` in URL
- ✅ Auth code: short TTL + single use
- ✅ Refresh token: server-side store + revocable

---

# STAGE 0 — Repo & Environment Baseline
### Objective
Project structure stable ho + env vars fixed.

### End Result
- IDP server starts
- Client apps start
- `.env.local` working

### Testcases
- `GET http://localhost:3000/health` → 200  
- `GET http://localhost:3001/health` → 200  

---

# STAGE 1 — IDP Master Session (Core SSO Cookie)
### Objective
IDP can create a **master login session** cookie.

### Implement (IDP routes)
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET  /api/auth/session`

### Storage
- Cookie: `idp_session` (httpOnly, secure in prod, SameSite=Lax)
- DB/Redis: `sessions`

### End Result
Login works purely via API.

## ✅ Testcases (terminal)

### 1) Login should set cookie
```bash
curl -i -c cookies.txt   -X POST http://localhost:3000/api/auth/login   -H "Content-Type: application/json"   -d '{"email":"test@example.com","password":"123456"}'
```

Expected:
- `Set-Cookie: idp_session=...`
- `200 OK`

### 2) Session should be valid with cookie
```bash
curl -i -b cookies.txt   http://localhost:3000/api/auth/session
```

Expected:
- `200 OK`

### 3) Logout should clear cookie
```bash
curl -i -b cookies.txt -c cookies.txt   -X POST http://localhost:3000/api/auth/logout
```

Expected:
- cookie cleared

### 4) Session should fail after logout
```bash
curl -i -b cookies.txt   http://localhost:3000/api/auth/session
```

Expected:
- `401`

---

# STAGE 2 — Client Registry (OAuth Clients)
### Objective
IDP knows which apps are allowed.

### Implement
DB table: `oauth_clients`
- `client_id`
- `redirect_uris[]`
- `allowed_scopes[]`

### End Result
IDP rejects unknown clients.

## ✅ Testcases

### 1) Unknown client rejected
```bash
curl -i   "http://localhost:3000/oauth/authorize?client_id=unknown&redirect_uri=http://localhost:3001/api/auth/callback&response_type=code&scope=openid&state=abc&code_challenge=xyz&code_challenge_method=S256"
```

Expected:
- `400/401 invalid_client`

---

# STAGE 3 — /authorize Route (only CODE + STATE)
### Objective
Implement `/oauth/authorize`.

### End Result
IDP returns:
- If no session → redirect to login
- If session → redirect back with `code + state`

## ✅ Testcases

### Prep: Login first
```bash
curl -i -c cookies.txt   -X POST http://localhost:3000/api/auth/login   -H "Content-Type: application/json"   -d '{"email":"test@example.com","password":"123456"}'
```

### 1) /authorize returns 302 with code
```bash
curl -i -b cookies.txt   "http://localhost:3000/oauth/authorize?client_id=client-a&redirect_uri=http://localhost:3001/api/auth/callback&response_type=code&scope=openid%20profile%20email&state=STATE123&code_challenge=CHALLENGE123&code_challenge_method=S256"
```

Expected:
- `302`
- Location contains `?code=...&state=STATE123`

---

# STAGE 4 — PKCE (real)
### Objective
PKCE correctly computed + verified.

## ✅ Testcase (generate PKCE)
```bash
node -e "const crypto=require('crypto'); const v=crypto.randomBytes(32).toString('base64url'); const c=crypto.createHash('sha256').update(v).digest('base64url'); console.log('verifier:',v); console.log('challenge:',c);"
```

---

# STAGE 5 — /token Route (code → tokens)
### Objective
Implement `/oauth/token` (authorization_code).

### End Result
Returns:
- access_token
- refresh_token
- id_token

## ✅ Testcases

### 1) Exchange code for tokens
```bash
curl -i -X POST http://localhost:3000/oauth/token   -H "Content-Type: application/json"   -d '{
    "grant_type":"authorization_code",
    "client_id":"client-a",
    "redirect_uri":"http://localhost:3001/api/auth/callback",
    "code":"PASTE_CODE_HERE",
    "code_verifier":"PASTE_VERIFIER_HERE"
  }'
```

Expected:
- `200 OK`

### 2) Reuse same code (must fail)
Expected:
- `400 invalid_grant`

---

# STAGE 6 — Client A callback (state validation)
### Objective
Client validates `state`, exchanges code, creates app session.

### End Result
Client has:
- `appA_session` cookie

---

# STAGE 7 — Userinfo / Protected API
### Objective
Access token can be used.

## ✅ Testcase
```bash
curl -i http://localhost:3000/oauth/userinfo   -H "Authorization: Bearer PASTE_ACCESS_TOKEN"
```

Expected:
- `200 OK`

---

# STAGE 8 — Refresh Token
### Objective
Implement refresh_token grant.

## ✅ Testcase
```bash
curl -i -X POST http://localhost:3000/oauth/token   -H "Content-Type: application/json"   -d '{
    "grant_type":"refresh_token",
    "client_id":"client-a",
    "refresh_token":"PASTE_REFRESH_TOKEN"
  }'
```

Expected:
- `200 OK`

---

# STAGE 9 — Real SSO (App A → App B)
### Objective
User logs in once, App B auto-login.

### End Result
App B authorize does NOT show login if `idp_session` exists.

---

# STAGE 10 — Logout Modes
### Objective
Local logout vs global logout.

---

# STAGE 11 — Account Switching
### Objective
Google-like multiple accounts.

---

# STAGE 12 — UI (LAST)
### Objective
Only after all stages pass.

---

# Final Checklist
- [ ] `/authorize` returns only `code + state`
- [ ] `/token` validates PKCE
- [ ] `state` mismatch fails
- [ ] code reuse fails
- [ ] refresh works
- [ ] tokens never appear in URL
- [ ] App B logs in without re-entering credentials
