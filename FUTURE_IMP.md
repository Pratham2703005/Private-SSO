## 🚀 Future Improvements

### Silent Login (Phase 2)

**What**: Hidden iframe checks IDP session without user interaction  
**Why**: Better UX for multi-tab/multi-window scenarios  
**When needed**: If users complain about stale states across tabs

#### Implementation Concept

```typescript
// GET /api/auth/silent (returns only status, no redirect)
export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie") || "";
  
  const res = await fetch(`${IDP_SERVER}/api/auth/session/check`, {
    method: "POST",
    headers: { "Cookie": cookieHeader },
  });

  return NextResponse.json({
    authenticated: res.ok,
    timestamp: Date.now(),
  });
}
```

#### Usage
```typescript
// Hidden iframe runs periodically
const checkAuth = setInterval(async () => {
  const res = await fetch('/api/auth/silent', { credentials: 'include' });
  const { authenticated } = await res.json();
  
  // If session exists but not logged in locally → auto-fetch user
  if (authenticated && !session) {
    performSessionFetch().then(processSessionData);
  }
}, 30000); // Every 30s
```

#### Benefits
- ✅ Auto-detect IDP login/logout in background
- ✅ Cross-tab session sync
- ✅ No loading spinner (instant check)
- ✅ Seamless account switch awareness

#### Trade-offs
- ❌ Extra polling requests
- ❌ Overkill for single-tab apps
- ❌ Only useful with multiple windows open

**Recommendation**: Add only if you observe users with multiple tabs/windows having stale states. For now, widget-based switching is sufficient.
