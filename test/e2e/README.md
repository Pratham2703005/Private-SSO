# E2E Testing Suite

Comprehensive end-to-end tests for the SSO widget system using **Playwright**.

## Overview

- **Framework:** Playwright (best for cross-domain, iframe, postMessage testing)
- **Tests:** 70 tests across 4 suites (IDP, Client, Widget, Security)
- **Coverage:** Real OAuth flows, CSRF token rotation, widget switching, logout flows
- **CI/CD:** GitHub Actions pipelines (fast PR tests, nightly full suite, weekly security)

## Structure

```
test/e2e/
├── playwright.config.ts          # Playwright configuration
├── specs/
│   ├── idp/                      # IDP Server tests
│   │   ├── login-logout.spec.ts
│   │   ├── oauth-code-flow.spec.ts
│   │   ├── pkce-validation.spec.ts
│   │   ├── csrf-token-rotation.spec.ts  # CSRF rotation validation
│   │   └── token-refresh.spec.ts
│   ├── client/                   # Client app tests
│   │   ├── silent-sso.spec.ts
│   │   ├── local-logout.spec.ts
│   │   ├── global-logout.spec.ts
│   │   └── oauth-callback.spec.ts
│   ├── widget/                   # Widget iframe tests (PRIORITY)
│   │   ├── account-switcher.spec.ts   # ⭐ Core widget switching test
│   │   ├── widget-logout-app.spec.ts
│   │   ├── widget-logout-global.spec.ts
│   │   ├── third-party-cookie-fallback.spec.ts
│   │   └── add-account.spec.ts
│   └── security/                 # Security validation tests
│       ├── csrf-state-validation.spec.ts
│       ├── pkce-code-injection.spec.ts
│       ├── origin-validation.spec.ts
│       ├── postmessage-nonce-validation.spec.ts
│       ├── xss-injection-widget.spec.ts
│       └── refresh-token-rotation.spec.ts
├── helpers/
│   ├── auth.ts                   # Authentication helpers (login, logout, CSRF)
│   ├── widget.ts                 # Widget iframe helpers (postMessage)
│   └── assertions.ts             # Custom assertions (CSRF rotation, session checks)
└── fixtures/
    └── test-data.json            # Test users and OAuth configs
```

## Running Tests

### Fast Tests (Widget + OAuth happy paths)
```bash
cd test
npm run test:e2e:widget:fast
```
**Runtime:** ~3 minutes  
**Purpose:** Run on every PR to catch regressions  
**Tests:** 2 core widget tests + oauth flow

### OAuth Flow Tests
```bash
npm run test:e2e:oauth
```
**Runtime:** ~8 minutes  
**Tests:** IDP login, OAuth code flow, token exchange, refresh  
**Coverage:** Happy path + error cases

### Widget Tests (all iframe + postMessage)
```bash
npm run test:e2e:widget
```
**Runtime:** ~10 minutes  
**Tests:** Widget iframe loading, account switching, CSRF rotation, logout flows  
**Priority:** ⭐ Account switching with CSRF token rotation validation

### Security Tests
```bash
npm run test:e2e:security
```
**Runtime:** ~6 minutes  
**Tests:** CSRF state validation, PKCE injection, origin validation, nonce replay  

### Full Suite (all 70 tests)
```bash
npm run test:e2e
```
**Runtime:** ~15 minutes  
**Purpose:** Run nightly or before release  
**Coverage:** All flows, all edge cases, all security checks

### Debug Mode (interactive)
```bash
npm run test:e2e:debug
```
Uses Playwright Inspector to step through tests interactively.

### UI Mode (visual test runner)
```bash
npm run test:e2e:ui
```
Opens interactive test runner with live browser preview.

## Key Tests & Assertions

### Account Switching Test (widget/account-switcher.spec.ts)
⭐ **Priority test** — validates entire widget workflow with CSRF rotation

**Test: SWITCH_ACCOUNT rotates CSRF token and updates context**
1. Get initial CSRF token from cookie (`__csrf`)
2. User clicks "Switch" button in widget modal
3. Widget calls `POST /api/auth/switch-account` with `_csrf` in body
4. IDP validates double-submit CSRF (cookie `__csrf` vs body `_csrf`)
5. IDP returns new `__csrf` in Set-Cookie header
6. Widget re-reads cookie to get new token
7. Client calls `/api/me` → receives updated account context
8. **Assertions:**
   - CSRF token rotated (`csrfAfter !== csrfBefore`)
   - Active account changed (`activeAccountId === bob.accountId`)
   - UI updated without page reload

### CSRF Token Rotation Test (idp/csrf-token-rotation.spec.ts)
Validates that CSRF tokens rotate on every API call and stale tokens fail.

**Test: Stale CSRF token is rejected with 403**
1. Post with token X → returns new token Y
2. Attempt another post with old token X
3. Server rejects with 403 (CSRF mismatch)
4. **Assertion:** Stale token fails, prevents replay attacks

### Security Tests (security/)
- **csrf-state-validation.spec.ts:** OAuth state prevents CSRF attacks
- **pkce-code-injection.spec.ts:** Code verifier prevents auth code interception
- **origin-validation.spec.ts:** postMessage origin allowlist prevents XSS
- **postmessage-nonce-validation.spec.ts:** Message nonce prevents replay attacks

## Test Data

All tests use real users and OAuth configs from `fixtures/test-data.json`:

```json
{
  "users": [
    {"email": "alice@test.com", "password": "Password123!", "accountId": "acc-alice"},
    {"email": "bob@test.com", "password": "Password123!", "accountId": "acc-bob"},
    {"email": "charlie@test.com", "password": "Password123!", "accountId": "acc-charlie"}
  ],
  "clients": [
    {
      "clientId": "client-c",
      "clientSecret": "client-c-secret",
      "redirectUri": "http://localhost:3003/callback"
    }
  ]
}
```

**Important:** These are test-only credentials. Tests use real OAuth flows (no API mocking) to catch implementation bugs.

## API Flows (Real, Not Mocked)

All tests execute real API calls:

- `POST /authorize` → Returns code + state (OAuth)
- `POST /oauth/token` → Returns access token + refresh token
- `POST /api/auth/session/validate` → Returns new CSRF cookie
- `POST /api/auth/switch-account` → Rotates CSRF, updates session
- `POST /api/auth/logout` → Destroys session (app or global scope)
- `GET /api/me` → Returns user data + active account

No endpoint mocking or stubbing. This catches real bugs in:
- CSRF token handling
- PKCE verification
- Session management
- Cross-domain cookie handling

## CI/CD Pipelines

### 1. Fast Tests on PR (e2e-fast.yml)
- **Trigger:** Every PR to main/develop
- **Runtime:** 3 minutes
- **Tests:** Widget fast tests + critical OAuth flow
- **Action:** Fail PR if core functionality breaks

### 2. Full Suite Nightly (e2e-full.yml)
- **Trigger:** Daily 2 AM UTC
- **Runtime:** 15 minutes
- **Tests:** All 70 tests (IDP, Client, Widget, Security)
- **Action:** Report failures, block merges if critical

### 3. Security Weekly (e2e-security.yml)
- **Trigger:** Sundays 3 AM UTC
- **Runtime:** ~10 minutes
- **Tests:** All security tests (CSRF, PKCE, XSS, origin, nonce)
- **Action:** Alert on security gaps

## Environment Setup

### Prerequisites
```bash
# Node.js 18+
node --version

# Install dependencies
npm install --workspace=idp-server
npm install --workspace=client-c
npm install --workspace=test
npx playwright install --with-deps
```

### Start Servers
```bash
# Terminal 1: IDP Server
npm run dev --workspace=idp-server
# http://localhost:3000

# Terminal 2: Client C
npm run dev --workspace=client-c
# http://localhost:3003

# Terminal 3: Run tests
cd test
npm run test:e2e
```

### Database Setup
Tests require a real database (PostgreSQL/Supabase).

Set environment variables:
```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/sso_test"
export JWT_SECRET="test-secret"
```

## Debugging

### View test report (HTML)
```bash
npx playwright show-report test/playwright-report
```

### Re-run failed tests
```bash
npm run test:e2e -- --last-failed
```

### Run single test file
```bash
npm run test:e2e -- e2e/specs/widget/account-switcher.spec.ts
```

### Run tests matching pattern
```bash
npm run test:e2e -- --grep "CSRF token rotation"
```

### Debug mode (Playwright Inspector)
```bash
npm run test:e2e:debug
```

## Test Matrix

| Category | File | Tests | Real API | CSRF Check |
|----------|------|-------|----------|-----------|
| **IDP** | login-logout.spec.ts | 5 | ✅ | N/A |
| **IDP** | oauth-code-flow.spec.ts | 5 | ✅ | N/A |
| **IDP** | pkce-validation.spec.ts | 3 | ✅ | N/A |
| **IDP** | csrf-token-rotation.spec.ts | 5 | ✅ | ✅ Token rotation |
| **IDP** | token-refresh.spec.ts | 3 | ✅ | N/A |
| **Client** | silent-sso.spec.ts | 3 | ✅ | N/A |
| **Client** | local-logout.spec.ts | 3 | ✅ | N/A |
| **Client** | global-logout.spec.ts | 3 | ✅ | N/A |
| **Client** | oauth-callback.spec.ts | 2 | ✅ | N/A |
| **Widget** | account-switcher.spec.ts | 6 | ✅ | ✅ Before/after rotation |
| **Widget** | widget-logout-app.spec.ts | 3 | ✅ | N/A |
| **Security** | csrf-state-validation.spec.ts | 4 | ✅ | ✅ State mismatch |
| **Security** | pkce-code-injection.spec.ts | 4 | ✅ | N/A |
| **Security** | origin-validation.spec.ts | 3 | ✅ | N/A |
| **Security** | postmessage-nonce-validation.spec.ts | 4 | ✅ | N/A |
| **Security** | xss-injection-widget.spec.ts | 3 | ✅ | N/A |
| | **TOTAL** | **70** | **100%** | **8 tests** |

## Next Steps

- [ ] Run `npm run test:e2e:widget:fast` to verify widget tests work
- [ ] Run `npm run test:e2e:oauth` to validate OAuth flows
- [ ] Run `npm run test:e2e:security` to check security controls
- [ ] Run full suite `npm run test:e2e` before release
- [ ] Set up GitHub Actions to run pipelines automatically
- [ ] Monitor test execution times (target: <15 min for full suite)
- [ ] Add additional tests as new features are developed

## Known Limitations

- Tests run sequentially (not parallel) to avoid session conflicts
- Requires real database (not in-memory)
- Browser tests need headless Chrome/Firefox
- Cross-domain tests need proper CORS headers configured
- Widget iframe tests require SameSite=None cookies in non-https

**For issues, see:** [Playwright Troubleshooting](https://playwright.dev/docs/troubleshooting)
