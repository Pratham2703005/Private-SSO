-- Session Binding and CSRF Protection
-- Adds session binding (user agent hash) for token theft prevention
-- Uses double-submit CSRF cookies (no server-side table needed)

-- ============================================================================
-- 1. Session Binding Column (Prevent Token Theft)
-- ============================================================================
-- Stores hash of user agent at time of token issue
-- If attacker steals app_session cookie, they cannot use it on different device
-- NOTE: Treat as SOFT CHECK - UA can change legitimately (browser updates, mobile WebView, proxies)
-- For stronger security, also bind to stable device_id cookie
ALTER TABLE IF EXISTS refresh_tokens
  ADD COLUMN IF NOT EXISTS session_binding_hash VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session_binding 
  ON refresh_tokens(session_binding_hash);

-- ============================================================================
-- 2. CSRF Protection Strategy (Double-Submit Cookies)
-- ============================================================================
-- Uses browser-sent cookies for CSRF prevention (no server-side table needed)
-- 
-- Flow:
-- 1. Server generates __csrf token (32 random bytes)
-- 2. Server returns it in Set-Cookie: __csrf=token; SameSite=None; Secure; non-HttpOnly
-- 3. Browser sends it automatically in next request (cookie)
-- 4. Widget reads __csrf cookie value
-- 5. Widget includes in request body: { ..., _csrf: "cookie-value" }
-- 6. Server validates: request.cookies.__csrf == request.body._csrf
-- 7. If attacker steals cookie, they can read __csrf (non-HttpOnly)
--    But attacker from different origin CANNOT read it (SameSite=None + Origin allowlist)
--
-- NO SERVER-SIDE TABLE NEEDED - just double-submit validation
-- Pick ONE approach: either double-submit (simpler) OR server-side tokens (more secure)
-- Mixing both complicates debugging significantly

-- ============================================================================
-- 3. Summary of Changes
-- ============================================================================
-- New Columns:
--   - refresh_tokens.session_binding_hash: SHA256 hash of UA at token issue time
--   - Used to detect if token stolen and used on different device (SOFT CHECK)
--   - UA changes are legitimate - log suspicious but don't reject
--
-- CSRF Strategy:
--   - Double-submit cookies (simpler, sufficient for SameSite + Origin validation)
--   - No server-side token table (avoid mixing approaches)
--   - Server generates __csrf token in Set-Cookie
--   - Widget reads from cookie, includes in request body
--   - Server validates both match
--
-- Security Flow:
--   1. POST /api/session/switch-account
--   2. Widget sends: User-Agent header + __csrf cookie + _csrf body field
--   3. Server:
--      a. Computes SHA256(User-Agent) for binding check
--      b. Looks up refresh_token in DB
--      c. Verifies session_binding_hash (SOFT - logs suspicious, allows)
--      d. Verifies __csrf cookie == request.body._csrf (CSRF protection)
--      e. Proceeds if both valid
--
-- Backward Compatibility:
--   - session_binding_hash is NULL for old tokens (optional validation)
--   - Existing refresh tokens work without binding check

