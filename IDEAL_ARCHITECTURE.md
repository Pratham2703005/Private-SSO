SSO ARCHITECTURE (Google-Style) — OAuth2 + OpenID Connect
Flow: Authorization Code + PKCE (Ideal + Secure)

Actors:
- Browser (User)
- Client App A (ex: http://localhost:3001)
- Client App B (ex: http://localhost:3002)
- IDP / Auth Server (ex: http://localhost:3000)
- Resource Server / API (optional, protected endpoints)

──────────────────────────────────────────────────────────────────────────────
STATE 0: USER OPENS APP A
──────────────────────────────────────────────────────────────────────────────
Browser  ── GET /dashboard ───────────────────────────────>  App A
App A checks cookie:
  - appA_session ❌ missing
App A decides:
  - user not logged in

App A returns:
  - 302 Redirect to IDP /authorize

──────────────────────────────────────────────────────────────────────────────
STATE 1: APP A REDIRECTS TO IDP (/authorize)
──────────────────────────────────────────────────────────────────────────────
Browser  ── GET /oauth/authorize? ────────────────────────>  IDP
  client_id=appA
  redirect_uri=https://appA.com/api/auth/callback
  response_type=code
  scope=openid profile email
  state=RANDOM_STATE_123
  code_challenge=PKCE_HASH_ABC
  code_challenge_method=S256

App A (before redirect) STORES:
  - state=RANDOM_STATE_123
  - code_verifier=PKCE_SECRET_XYZ
Storage (recommended):
  - httpOnly cookie OR server session

──────────────────────────────────────────────────────────────────────────────
STATE 2: IDP CHECKS MASTER LOGIN SESSION
──────────────────────────────────────────────────────────────────────────────
IDP checks browser cookie:
  - idp_session (master SSO cookie)

CASE A: idp_session ❌ missing/invalid
  -> show login screen

CASE B: idp_session ✅ valid
  -> skip login and continue

──────────────────────────────────────────────────────────────────────────────
STATE 3: USER LOGS IN ON IDP (ONLY IF NEEDED)
──────────────────────────────────────────────────────────────────────────────
Browser  ── POST /login (email+password / google auth etc) ─>  IDP

IDP creates:
  - idp_session cookie (httpOnly, secure, SameSite)
  - stores session in DB/Redis
  - links session -> userId

Browser now has:
  - idp_session=MASTER_SSO_SESSION

──────────────────────────────────────────────────────────────────────────────
STATE 4: IDP ISSUES AUTHORIZATION CODE + REDIRECTS BACK
──────────────────────────────────────────────────────────────────────────────
IDP generates:
  - authorization_code=AUTH_CODE_ABC
  - stores it in DB/Redis (short TTL, single-use)
  - binds it with:
      userId, clientId, redirectUri, scopes, code_challenge

IDP returns:
  - 302 Redirect to App A callback

Browser  ── GET https://appA.com/api/auth/callback? ───────>  App A
  code=AUTH_CODE_ABC
  state=RANDOM_STATE_123

IMPORTANT:
  ✅ ONLY code + state in URL
  ❌ NO access_token in URL
  ❌ NO refresh_token in URL

──────────────────────────────────────────────────────────────────────────────
STATE 5: APP A VALIDATES CSRF STATE
──────────────────────────────────────────────────────────────────────────────
App A callback receives:
  - code=AUTH_CODE_ABC
  - state=RANDOM_STATE_123

App A checks:
  incoming_state == stored_state ?
    YES -> continue
    NO  -> reject (CSRF attack protection)

──────────────────────────────────────────────────────────────────────────────
STATE 6: APP A EXCHANGES CODE FOR TOKENS (SERVER-TO-SERVER)
──────────────────────────────────────────────────────────────────────────────
App A backend  ── POST /oauth/token ───────────────────────>  IDP
  grant_type=authorization_code
  code=AUTH_CODE_ABC
  redirect_uri=https://appA.com/api/auth/callback
  client_id=appA
  code_verifier=PKCE_SECRET_XYZ

IDP validates:
  - code exists + not expired + not used
  - redirect_uri matches
  - client_id matches
  - PKCE(code_verifier) matches code_challenge

IDP responds with:
  - access_token   (short expiry, ex: 5-15 min)
  - refresh_token  (long expiry, revocable)
  - id_token       (OIDC identity token)
  - expires_in

──────────────────────────────────────────────────────────────────────────────
STATE 7: APP A CREATES ITS OWN LOCAL SESSION
──────────────────────────────────────────────────────────────────────────────
App A stores (recommended):
  - appA_session cookie (httpOnly)
  - refresh_token stored encrypted in DB (optional but recommended)
  - user profile in DB/cache

Browser now has:
  - appA_session=APP_A_SESSION_COOKIE
  - idp_session=MASTER_SSO_COOKIE

User is now logged into App A.

──────────────────────────────────────────────────────────────────────────────
STATE 8: USER OPENS APP B (SSO TEST)
──────────────────────────────────────────────────────────────────────────────
Browser  ── GET /dashboard ───────────────────────────────>  App B
App B checks:
  - appB_session ❌ missing

App B returns:
  - 302 redirect to IDP /authorize (same flow)

Browser  ── GET /oauth/authorize?... ─────────────────────>  IDP

──────────────────────────────────────────────────────────────────────────────
STATE 9: IDP AUTO-LOGIN (SSO MAGIC)
──────────────────────────────────────────────────────────────────────────────
IDP checks:
  - idp_session ✅ valid (from earlier App A login)

So:
  - NO login screen
  - directly generates new auth code for App B

IDP returns:
  - 302 redirect to App B callback

Browser  ── GET https://appB.com/api/auth/callback? ───────>  App B
  code=AUTH_CODE_DEF
  state=RANDOM_STATE_999

──────────────────────────────────────────────────────────────────────────────
STATE 10: APP B EXCHANGES CODE + CREATES SESSION
──────────────────────────────────────────────────────────────────────────────
App B validates state
App B exchanges code with PKCE
App B receives tokens
App B sets:
  - appB_session cookie (httpOnly)

Browser now has:
  - idp_session (master SSO)
  - appA_session
  - appB_session

User is now logged in everywhere seamlessly.

──────────────────────────────────────────────────────────────────────────────
LOGOUT ARCHITECTURE (Google style)
──────────────────────────────────────────────────────────────────────────────
LOGOUT FROM APP A:
  - delete appA_session only
  - user still logged into IDP, so SSO still works

GLOBAL LOGOUT:
  - call IDP /logout
  - delete idp_session
  - revoke refresh tokens (optional)
  - apps may still have sessions, but will fail refresh/token checks

──────────────────────────────────────────────────────────────────────────────
CRITICAL SECURITY RULES (NON-NEGOTIABLE)
──────────────────────────────────────────────────────────────────────────────
1) NEVER send access_token in URL
2) NEVER send refresh_token in URL
3) Only send: code + state in callback
4) Always validate:
   - state (CSRF)
   - redirect_uri exact match
   - PKCE verification
5) Authorization code:
   - short lived
   - single use
6) Refresh token:
   - stored server-side
   - revocable
   - never exposed to browser JS

──────────────────────────────────────────────────────────────────────────────
ONE-LINE SUMMARY
──────────────────────────────────────────────────────────────────────────────
SSO = "IDP has master session cookie; each app gets login via code exchange"
