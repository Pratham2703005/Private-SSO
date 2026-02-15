# E2E Test Checklist

## Client Tests (5 tests)
- [❌] `global-logout.spec.ts` - Tests global logout functionality across all clients
- [ ] `local-logout.spec.ts` - Tests client-specific logout without affecting other clients
- [ ] `oauth-callback.spec.ts` - Tests OAuth callback handling and session establishment
- [ ] `oauth-error-handling.spec.ts` - Tests error scenarios in OAuth flow
- [ ] `silent-sso.spec.ts` - Tests silent SSO token refresh without user interaction

## IDP Tests (9 tests)
- [ ] `account-management.spec.ts` - Tests account management (signup, profile updates)
- [ ] `cookie-security.spec.ts` - Tests secure cookie handling and attributes
- [ ] `csrf-token-rotation.spec.ts` - Tests CSRF token rotation on sensitive operations
- [ ] `login-logout.spec.ts` - Tests basic login and logout flows
- [ ] `multi-account-session.spec.ts` - Tests multiple accounts in same session
- [ ] `oauth-code-flow.spec.ts` - Tests OAuth authorization code flow
- [ ] `pkce-validation.spec.ts` - Tests PKCE (Proof Key for Code Exchange) validation
- [ ] `session-expiration.spec.ts` - Tests session timeout and expiration handling
- [ ] `token-refresh.spec.ts` - Tests access token refresh mechanism

## Integration Tests (0 tests)
> Currently empty - placeholder for cross-system integration tests

## Security Tests (8 tests)
- [ ] `cross-domain-security.spec.ts` - Tests cross-domain security boundaries
- [ ] `csrf-state-validation.spec.ts` - Tests CSRF state parameter validation
- [ ] `origin-validation.spec.ts` - Tests origin header validation
- [ ] `pkce-code-injection.spec.ts` - Tests protection against PKCE code injection attacks
- [ ] `postmessage-nonce-validation.spec.ts` - Tests postMessage nonce validation for iframe communication
- [ ] `refresh-token-rotation.spec.ts` - Tests refresh token rotation on use
- [ ] `token-handling.spec.ts` - Tests secure token storage and transmission
- [ ] `xss-injection-widget.spec.ts` - Tests XSS attack prevention in widget

## Widget Tests (8 tests)
- [ ] `account-state-persistence.spec.ts` - Tests widget account state persistence across page reloads
- [ ] `account-switcher.spec.ts` - Tests switching between multiple accounts in widget
- [ ] `add-account.spec.ts` - Tests adding new account via widget UI
- [ ] `message-protocol-validation.spec.ts` - Tests widget postMessage protocol validation
- [ ] `third-party-cookie-fallback.spec.ts` - Tests fallback when third-party cookies disabled
- [ ] `widget-iframe-loading.spec.ts` - Tests widget iframe initialization and loading
- [ ] `widget-logout-app.spec.ts` - Tests widget logout (app-specific)
- [ ] `widget-logout-global.spec.ts` - Tests widget logout (global session)

---

**Total: 30 test files** | Run and mark ✅ when passed, ❌ when failed
