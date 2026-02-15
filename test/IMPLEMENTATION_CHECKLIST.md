# Implementation Checklist - Guided by E2E Tests

This document outlines what needs to be implemented in IDP Server and Client App, based on failing E2E tests.

## IDP Server (`idp-server/`)

### Phase 1: Authentication (Blocking all tests)
- [ ] **POST /api/auth/login**
  - Input: email, password
  - Output: Set `__sso_session` cookie (httpOnly, sameSite=strict)
  - Test: `IDP: Login & Logout` ✓ (NEEDS IMPLEMENTATION)

- [ ] **POST /api/auth/logout** 
  - Input: scope (app | global)
  - Output: Clear session cookie
  - Test: `IDP: Login & Logout` ✓ (NEEDS IMPLEMENTATION)

### Phase 2: CSRF Protection (Blocking widget tests)
- [ ] **GET /authorize** (OAuth)
  - Returns HTML form + sets `__csrf` cookie
  - Cookie format: 32-char hex string
  - Test: `IDP: CSRF Token Rotation` (FAILING - no __csrf)

- [ ] **POST /api/auth/session/validate**
  - Validates `__csrf` token via double-submit CSRF
  - Returns new `__csrf` in Set-Cookie (rotation)
  - Test: `IDP: CSRF Token Rotation` (FAILING - endpoint missing)

### Phase 3: OAuth Flow  
- [ ] **GET /authorize**
  - Parameters: client_id, response_type, redirect_uri, state, [code_challenge, code_challenge_method]
  - Returns: authorization code + state
  - Validates: client_id, redirect_uri
  - Test: `IDP: OAuth Code Flow` (FAILING - endpoint not implemented)

- [ ] **POST /api/auth/token**
  - Grant types: authorization_code, refresh_token
  - Returns: access_token, refresh_token (rotated), expires_in
  - Validates: code (single-use), client_id, PKCE verifier
  - Test: `IDP: Token Refresh` (FAILING - endpoint not implemented)

### Phase 4: Account Management
- [ ] **POST /api/auth/switch-account**
  - Parameters: accountId (in body)
  - CSRF validation required  
  - Returns: new CSRF token in Set-Cookie
  - Test: `Widget: Account Switching` (FAILING - endpoint missing)

- [ ] **GET /api/auth/accounts**
  - Returns: list of linked accounts for user
  - Test: `IDP: Account Management` (FAILING - endpoint missing)

### Phase 5: Session Management
- [ ] **GET /api/auth/session/validate**
  - Returns: current user, account, accounts array
  - Test: `IDP: Login & Logout` ✓ (NEEDS ENDPOINT)

### Phase 6: Widget Server
- [ ] **GET /widget/widget.js**
  - Embedded in client iframe
  - Sends WIDGET_READY postMessage on load
  - Security headers: X-Frame-Options, CSP
  - Test: `Widget: iframe Loading` (FAILING - not served)

## Client App (`client-c/`)

### Phase 1: OAuth Callback
- [ ] **GET /callback**
  - Parameters: code, state
  - Exchanges code for tokens via IDP
  - Sets `app_session_c` cookie
  - Redirects to /dashboard
  - Test: `Client: OAuth Callback` (FAILING - endpoint missing)

- [ ] **POST /callback** 
  - Same as GET (support form submission)

### Phase 2: Session & Auth
- [ ] **GET /api/me**
  - Returns: current user, account, list of accounts
  - Test: `Client: Silent SSO` (FAILING - endpoint missing)

- [ ] **POST /api/auth/logout**
  - Scope: app (local) | global (all clients)
  - Clears app_session_c (app scope)
  - Clears __sso_session (global scope) via IDP
  - Test: `Client: Local Logout` (FAILING - endpoint unimplemented)

### Phase 3: Dashboard & Widget
- [ ] **GET /dashboard**
  - HTML page with embedded widget iframe
  - Iframe: `<iframe id="account-switcher-widget" src="http://localhost:3000/widget?...">`
  - Listens for postMessage from widget
  - Test: `Widget: Account Switching` (FAILING - iframe not embedded)

- [ ] **Session Cookie Handling**
  - Sets `app_session_c` cookie on login
  - Httponly, SameSite=Strict
  - Path=/
  - Test: `Widget: iframe Loading` (FAILING - cookie not set)

## Test Execution Strategy

### Run tests to guide implementation:
```bash
# 1. First: Basic login (PASSING - validates framework)
npm run test:e2e -- e2e/specs/idp/login-logout.spec.ts

# 2. Then: CSRF (core widget security)
npm run test:e2e -- e2e/specs/idp/csrf-token-rotation.spec.ts

# 3. Then: OAuth (code flow)
npm run test:e2e -- e2e/specs/idp/oauth-code-flow.spec.ts

# 4. Then: Token management
npm run test:e2e -- e2e/specs/idp/token-refresh.spec.ts

# 5. Then: Client OAuth callback
npm run test:e2e -- e2e/specs/client/oauth-callback.spec.ts

# 6. Then: Widget tests (requires /dashboard + iframe)
npm run test:e2e -- e2e/specs/widget/widget-iframe-loading.spec.ts
```

### Full test runs:
```bash
# IDP + client OAuth tests
npm run test:e2e:oauth

# All widget tests (after phase 3)
npm run test:e2e:widget

# All security tests
npm run test:e2e:security

# Everything
npm run test:e2e
```

## Test Data (Use in Implementation)

From `test/e2e/fixtures/test-data.json`:

### Test Users
```json
{
  "email": "alice@test.com",
  "password": "Password123!",
  "accountId": "acc-alice"
}
```

### OAuth Client
```json
{
  "clientId": "client-c",
  "clientSecret": "client-c-secret",
  "redirectUri": "http://localhost:3003/callback"
}
```

## Key Implementation Notes

### CSRF Token Rotation
- Must rotate after EVERY API call that modifies state
- Widget reads `__csrf` from `document.cookie` BEFORE request
- Widget must re-read `__csrf` from Set-Cookie AFTER response
- Old tokens must be rejected with 403

### OAuth PKCE
- Support code_challenge param with S256 method
- Validate code_verifier matches SHA256(code_verifier) == code_challenge
- Reject code exchange if verifier missing or wrong

### Widget Security
- Iframe sandbox: `allow-scripts allow-same-origin` (NOT `allow-top-navigation`)
- Nonce: 32-char hex, unique per request
- RequestId: Unique ID to match request/response
- postMessage origin validation required

### Session Scope
- `app` scope logout: Clears only app_session_c, __sso_session remains
- `global` scope logout: Clears __sso_session (affects all clients)
- Default: `global` unless specified

## Progress Tracking

```
[ ] Phase 1: Basic Auth + Login (blockingevery test)
    [ ] POST /api/auth/login
    [ ] POST /api/auth/logout
    [ ] IDP login page
    
[ ] Phase 2: CSRF Protection (blocking widget)
    [ ] __csrf cookie generation
    [ ] POST /api/auth/session/validate
    
[ ] Phase 3: OAuth 
    [ ] GET /authorize (OAuth code flow)
    [ ] POST /api/auth/token (exchange code for tokens)
    [ ] Client /callback endpoint
    
[ ] Phase 4: Widget
    [ ] /widget/widget.js server
    [ ] Client /dashboard page
    [ ] Widget iframe embed
    [ ] postMessage communication
    
[ ] Phase 5: Account Management
    [ ] POST /api/auth/switch-account
    [ ] Account listing
    [ ] Multi-account session
    
[ ] Phase 6: Full Test Coverage
    [ ] All 160 tests passing
```

## Running Tests During Development

Watch mode - tests rerun as you implement:
```bash
npm run test:e2e:watch
```

UI mode - visual test debugging:
```bash
npm run test:e2e:ui
```

Debug mode with inspector:
```bash
npm run test:e2e:debug
```
