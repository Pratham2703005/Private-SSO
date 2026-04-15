# Future Improvements / Observations

Quick brain-dump of bugs, smells, and optimization opportunities noticed while working on the callback bootstrap optimization. Not urgent — park here for later.

## Security / Correctness

- **No rate limiting on auth routes.** `/api/auth/token`, `/api/auth/login`, `/api/auth/session`, `/api/auth/authorize` are all open. Credential stuffing / brute force is wide open. Add Upstash Ratelimit keyed on IP + email.
- **Session binding is soft-only.** `session/route.ts:181-202` logs UA mismatches but never blocks. Intentional (mobile UA churn), but there is no hard guard at all — even a wildly different UA passes. Consider blocking when *both* UA and IP diverge.
- **Bootstrap cookie is JS-readable.** It has to be (SPA reads it), but it contains `user.id` / `email` / account list. Same data `/api/me` returns, so no new exposure — just noting.
- **Cookie size.** Bootstrap JSON can grow with many accounts. Current cap is browser ~4KB per cookie. If users have 20+ accounts this breaks silently. Truncate to primary + N others, or fall back to /api/me when serialization exceeds ~3KB.
- **CSRF token rotation race.** `widget.js:262` already has a comment about this — two concurrent `/api/me` calls race on CSRF rotation. Bootstrap helps reduce it (one fewer call), but the underlying race still exists for visibility/focus refreshes.

## Latency / Perf

- **Widget script loads on every page.** `SSOProvider` appends `${idp}/api/widget.js` script always. Could lazy-load on first widget interaction, or inline critical CSS.
- **Pre-create iframe.** `widget.js` already does this. Good.
- **`/api/me` still runs on visibility/focus change.** Could debounce or skip if last check < 30s ago.
- **Token exchange now computes accounts even for clients that don't need bootstrap.** Negligible (1 DB query already being made).

## Code Smells / Cleanup

- **Extensive `console.log` in `token/route.ts`** with full codes, PKCE verifiers substrings, etc. Strip in prod or wrap in `if (debug)`.
- **`setTimeout(500)` in `switchAccount`** (SSOProvider.tsx:380) — waits blind for postMessage round-trip. Use a real handshake (await an `ACCOUNT_SWITCHED` message).
- **Inconsistent SameSite.** PKCE cookies `lax`, session `none` in prod. Defensible but worth a doc comment explaining why.
- **`validate-session.ts` forwards cookie via header AND body.** Either pick one, or doc why both.
- **`SessionData.issuedAt`** is used nowhere that matters. Bootstrap path sets it to `Date.now()` which may be misleading (it's the hydration time, not session issue time). Either remove the field or populate it from server.

## Nice-to-haves

- **Typed env vars** in both apps. Currently stringly-typed `process.env.*` everywhere.
- **Integration test** for the full callback → bootstrap → /api/me skip flow. Would catch cookie-format regressions.
- **Telemetry.** Record "bootstrap hit" vs "bootstrap miss" to measure real-world impact of the optimization.
- **Clear bootstrap cookie on the server side too** (already deleted client-side, but as defense-in-depth next request could clear it if present and older than 60s — belt & suspenders).

## Mobile / Widget UX

- **Bottom-sheet drag-to-close** would feel native on mobile. Currently only backdrop tap closes.
- **Reduce motion** — respect `prefers-reduced-motion` on the switching spinner.
- **Long email overflow** still possible on very narrow screens despite `truncate`; avatar + name + badge row may wrap awkwardly.
