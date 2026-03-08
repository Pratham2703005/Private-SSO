# Authorize Endpoint Parameter Lifecycle

Complete trace of each search parameter through `/api/auth/authorize`

---

## 🔵 1. **clientId**

**Source:** `searchParams.get("client_id")`

### Lifecycle Flow:
```typescript
// EXTRACTION (Line 36)
const clientId = searchParams.get("client_id");

// VALIDATION 1: Check if provided (Line 44)
if (!clientId || !redirectUri) {
  return error "Missing client_id or redirect_uri"
}

// USAGE 1: Look up OAuth client from database (Line 56)
const oauthClient = await getOAuthClient(clientId);
// Query: SELECT * FROM oauth_clients WHERE client_id = clientId

// VALIDATION 2: Check if client exists (Line 58)
if (!oauthClient) {
  return error "invalid_client" "Client not found"
}

// VALIDATION 3: Check if client is active (Line 64)
if (!oauthClient.is_active) {
  return error "invalid_client" "Client is inactive"
}

// VALIDATION 4: Check if redirect_uri is in allowed list (Line 74)
const allowedRedirectUris = oauthClient.allowed_redirect_uris || [];
const isRedirectUriAllowed = allowedRedirectUris.includes(redirectUri);
// Uses oauthClient data retrieved by clientId

// USAGE 2: Pass to createAuthorizationCode (Line 135)
const authCode = await createAuthorizationCode(
  user.id,
  clientId,        // ← Passed here
  redirectUri,
  codeChallenge,
  state,
  scopesArray,
  ttlSeconds
);

// USAGE 3: Pass to login redirect (Line 167)
loginUrl.searchParams.set("client_id", clientId);

// USAGE 4: Include in callback redirect (Line 145)
const callbackUrl = new URL(redirectUri);
callbackUrl.searchParams.set("code", authCode);
callbackUrl.searchParams.set("state", state);
// clientId is stored in authorization_codes table via createAuthorizationCode
```

### ✅ **Is it needed and consumed?**
- **YES** ✅ - Critical parameter
- Used for: Client validation, authorization code generation, database storage
- Failures if missing cause immediate 400 error

---

## 🔵 2. **redirectUri**

**Source:** `searchParams.get("redirect_uri")`

### Lifecycle Flow:
```typescript
// EXTRACTION (Line 37)
const redirectUri = searchParams.get("redirect_uri");

// VALIDATION 1: Check if provided (Line 44)
if (!clientId || !redirectUri) {
  return error "Missing client_id or redirect_uri"
}

// VALIDATION 2: Verify against allowed list from OAuth client (Line 73-74)
const allowedRedirectUris = oauthClient.allowed_redirect_uris || [];
const isRedirectUriAllowed = allowedRedirectUris.includes(redirectUri);

if (!isRedirectUriAllowed) {
  return error "invalid_redirect_uri" "Redirect URI not allowed"
}
// This prevents open redirects / phishing attacks

// USAGE 1: Pass to createAuthorizationCode (Line 136)
const authCode = await createAuthorizationCode(
  user.id,
  clientId,
  redirectUri,     // ← Stored in authorization_codes table
  codeChallenge,
  state,
  scopesArray,
  ttlSeconds
);

// USAGE 2: Pass to login redirect (Line 168)
loginUrl.searchParams.set("redirect_uri", redirectUri);

// USAGE 3: Create callback URL to redirect user back to client (Line 144)
const callbackUrl = new URL(redirectUri);
callbackUrl.searchParams.set("code", authCode);
callbackUrl.searchParams.set("state", state);

return NextResponse.redirect(callbackUrl);
// User is redirected to: redirectUri?code=AUTH_CODE&state=STATE
```

### ✅ **Is it needed and consumed?**
- **YES** ✅ - Critical parameter
- Used for: Client validation, security check, code storage, final redirect
- Failures if missing cause 400 error
- Most important for security: prevents attackers from stealing auth codes

---

## 🔵 3. **scopes**

**Source:** `searchParams.get("scopes")!` (with non-null assertion)

### Lifecycle Flow:
```typescript
// EXTRACTION (Line 38)
const scopes = searchParams.get("scopes")!;  // Non-null assertion!

// PROCESSING: Convert comma-separated string to array (Line 130)
const scopesArray = scopes.split(",").map((s) => s.trim());
// Example: "openid,profile,email" → ["openid", "profile", "email"]

// USAGE 1: Pass to createAuthorizationCode (Line 139)
const authCode = await createAuthorizationCode(
  user.id,
  clientId,
  redirectUri,
  codeChallenge,
  state,
  scopesArray,      // ← Array format
  ttlSeconds
);
// Stored in authorization_codes table

// USAGE 2: Pass to login redirect (Line 169)
loginUrl.searchParams.set("scopes", scopes);  // Original string format

// Later in db.ts createAuthorizationCode (Line ~450):
const { error } = await supabase
  .from("authorization_codes")
  .insert([
    {
      code,
      client_id: clientId,
      user_id: userId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge || "",
      code_challenge_method: "S256",
      state,
      scopes,           // ← Stored here
      expires_at: expiresAt.toISOString(),
      is_redeemed: false,
    },
  ]);
```

### ⚠️ **Is it needed and consumed?**
- **PARTIALLY** ⚠️
- **Needed for:** Authorization code generation, storage
- **NOT VALIDATED:** The endpoint doesn't validate whether requested scopes are allowed
- **MISSING:** Should check against client's allowed scopes before issuing code
- **Recommendation:** Add validation like:
```typescript
// ADD THIS VALIDATION
const allowedScopes = oauthClient.allowed_scopes || [];
const requestedScopes = scopesArray;
const hasUnallowedScopes = requestedScopes.some(s => !allowedScopes.includes(s));

if (hasUnallowedScopes) {
  return error "invalid_scope" "Client requested unauthorized scopes"
}
```

---

## 🔵 4. **state**

**Source:** `searchParams.get("state")!` (with non-null assertion)

### Lifecycle Flow:
```typescript
// EXTRACTION (Line 39)
const state = searchParams.get("state")!;  // Non-null assertion!

// USAGE 1: Pass to createAuthorizationCode (Line 138)
const authCode = await createAuthorizationCode(
  user.id,
  clientId,
  redirectUri,
  codeChallenge,
  state,            // ← Stored in authorization_codes table
  scopesArray,
  ttlSeconds
);

// In db.ts (Line ~461):
const { error } = await supabase
  .from("authorization_codes")
  .insert([
    {
      code,
      client_id: clientId,
      user_id: userId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge || "",
      code_challenge_method: "S256",
      state,           // ← Stored here
      scopes,
      expires_at: expiresAt.toISOString(),
      is_redeemed: false,
    },
  ]);

// USAGE 2: Included in JSON response for prompt=none (Line 147)
if (prompt === 'none') {
  const response = NextResponse.json(
    { code: authCode, state },   // ← Returned here
    { status: 200 }
  );
  return addCorsHeaders(response, request);
}

// USAGE 3: Included in redirect URL (Line 152)
const callbackUrl = new URL(redirectUri);
callbackUrl.searchParams.set("code", authCode);
callbackUrl.searchParams.set("state", state);   // ← Passed back to client
// Client verifies that returned state matches original state (CSRF protection)

// USAGE 4: Passed to login if user needs to authenticate (Line 170)
loginUrl.searchParams.set("state", state);
```

### ✅ **Is it needed and consumed?**
- **YES** ✅ - Critical for security
- Used for: CSRF protection (client verifies returned state matches original)
- Stored in authorization_codes table
- Returned to client in redirect or JSON response
- **Non-null assertion is appropriate** since state is required by OAuth spec

---

## 🔵 5. **codeChallenge**

**Source:** `searchParams.get("code_challenge")`

### Lifecycle Flow:
```typescript
// EXTRACTION (Line 40)
const codeChallenge = searchParams.get("code_challenge");

// VALIDATION: NOT VALIDATED HERE
// Should check:
// - If code_challenge_method provided, code_challenge must exist
// - code_challenge format (S256: 43-128 characters)
// Currently missing this validation!

// USAGE 1: Pass to createAuthorizationCode (Line 137)
const authCode = await createAuthorizationCode(
  user.id,
  clientId,
  redirectUri,
  codeChallenge,     // ← Can be null or string
  state,
  scopesArray,
  ttlSeconds
);

// In db.ts createAuthorizationCode (Line ~465):
const { error } = await supabase
  .from("authorization_codes")
  .insert([
    {
      code,
      client_id: clientId,
      user_id: userId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge || "",  // Convert null to empty string
      code_challenge_method: "S256",
      state,
      scopes,
      expires_at: expiresAt.toISOString(),
      is_redeemed: false,
    },
  ]);

// USAGE 2: Preserved in login redirect if provided (Line 174-176)
if (codeChallenge) {
  loginUrl.searchParams.set("code_challenge", codeChallenge);
}

// Later during token exchange (in /callbacks route):
// The code_challenge is used to verify code_verifier sent with token request
```

### ⚠️ **Is it needed and consumed?**
- **PARTIALLY** ⚠️
- **Needed for:** PKCE flow (Proof Key for Public Clients)
- **OPTIONAL:** Not required for confidential clients
- **NOT VALIDATED:** Should validate format when provided:
```typescript
// ADD THIS VALIDATION
if (codeChallenge) {
  // S256 code challenges should be 43-128 characters
  if (codeChallenge.length < 43 || codeChallenge.length > 128) {
    return error "invalid_request" "Invalid code_challenge length"
  }
}
```
- **CONSUMED:** Stored for later verification during token exchange

---

## 🔵 6. **ttlSecondsParam & ttlSeconds**

**Source:** `searchParams.get("ttl_seconds")`

### Lifecycle Flow:
```typescript
// EXTRACTION (Line 41-42)
const ttlSecondsParam = searchParams.get("ttl_seconds");  // For testing
const ttlSeconds = ttlSecondsParam 
  ? parseInt(ttlSecondsParam, 10) 
  : 600;  // Default 10 minutes

// USAGE 1: Pass to createAuthorizationCode (Line 140)
const authCode = await createAuthorizationCode(
  user.id,
  clientId,
  redirectUri,
  codeChallenge,
  state,
  scopesArray,
  ttlSeconds         // ← Passed here
);

// In db.ts createAuthorizationCode (Line ~440):
const ttlSeconds: number = 600; // function parameter
const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
// Sets expiration time: now + (ttlSeconds * 1000 milliseconds)

const { error } = await supabase
  .from("authorization_codes")
  .insert([
    {
      code,
      ...
      expires_at: expiresAt.toISOString(),  // Stored for later validation
      ...
    },
  ]);

// Used during getAuthorizationCode validation (db.ts line ~700):
const expiresAtString = authCode.expires_at.endsWith('Z') 
  ? authCode.expires_at 
  : authCode.expires_at + 'Z';

const now = new Date();
const expiresAt = new Date(expiresAtString);

if (expiresAt < now) {
  console.log("[getAuthorizationCode] ❌ CODE EXPIRED");
  return null;  // Code rejected if expired
}
```

### ⚠️ **Is it needed and consumed?**
- **PARTIALLY** ⚠️
- **Needed for:** Authorization code expiration
- **DEFAULT:** 600 seconds (10 minutes) if not provided
- **VALIDATION ISSUE:** No validation on ttlSecondsParam value
  - Client could send `ttl_seconds=999999999` (very long TTL)
  - Should enforce min/max: `Math.max(300, Math.min(3600, ttlSeconds))`
- **Recommendation:** Add validation:
```typescript
// SECURE VERSION
const ttlSeconds = ttlSecondsParam 
  ? Math.max(300, Math.min(3600, parseInt(ttlSecondsParam, 10)))  // Between 5 min - 1 hour
  : 600;  // Default 10 minutes
```

---

## 🔵 7. **prompt**

**Source:** `searchParams.get("prompt")`

### Lifecycle Flow:
```typescript
// EXTRACTION (Line 43)
const prompt = searchParams.get("prompt");  // Can be null, "login", "none"

// FLOW CONTROL 1: Check if explicit login request (Line 87)
if (prompt === 'login') {
  // User explicitly requests login page
  // Falls through to login redirect at end
} else if (sessionId) {
  // Only try silent auth if prompt !== 'login'
  // ... process existing session ...
}

// FLOW CONTROL 2: Return JSON instead of redirect for silent auth (Line 146)
if (prompt === 'none') {
  const response = NextResponse.json(
    { code: authCode, state },
    { status: 200 }
  );
  return addCorsHeaders(response, request);
}

// FLOW CONTROL 3: Return 401 if no session and prompt=none (Line 159)
if (prompt === 'none') {
  const errorResponse = NextResponse.json(
    { success: false, error: 'No valid session', error_description: 'prompt=none but no active session' },
    { status: 401 }
  );
  return addCorsHeaders(errorResponse, request);
}

// DEFAULT: Redirect to login (no prompt or other values)
const loginUrl = new URL("/login", request.nextUrl.origin);
// ... set other params ...
return NextResponse.redirect(loginUrl);
```

### ✅ **Is it needed and consumed?**
- **YES** ✅ - Important for controlling auth flow
- **Values:**
  - `null` / undefined: Normal flow (redirect to login if needed)
  - `"login"`: Force re-authentication (skip cached session)
  - `"none"`: Silent auth (JSON response, 401 if fails)
- **Consumed:** Controls 3 distinct code paths
- **Recommendation:** Consider adding `"consent"` for explicit scope approval

---

## 📊 Parameter Summary Table

| Parameter | Required | Validated | Used For | Issues |
|-----------|----------|-----------|----------|--------|
| **clientId** | ✅ YES | ✅ YES | Client lookup, code generation | None - Good |
| **redirectUri** | ✅ YES | ✅ YES | Security check, redirect target | None - Good |
| **scopes** | ✅ YES | ❌ NO | Code storage | Missing allowed scopes validation |
| **state** | ✅ YES | ✅ YES | CSRF protection | None - Good |
| **codeChallenge** | ❌ NO | ❌ NO | PKCE flow | Missing format validation when provided |
| **ttlSeconds** | ❌ NO | ❌ NO | Code expiration | Missing min/max validation |
| **prompt** | ❌ NO | ✅ YES | Flow control | None - Good |

---

## 🔒 Security Recommendations

### 1. **Add Scopes Validation:**
```typescript
// After line 73 (client validation)
const allowedScopes = oauthClient.allowed_scopes || [];
const requestedScopes = scopesArray;
const invalidScopes = requestedScopes.filter(s => !allowedScopes.includes(s));

if (invalidScopes.length > 0) {
  const errorResponse = NextResponse.json(
    { success: false, error: "invalid_scope", error_description: `Invalid scopes: ${invalidScopes.join(', ')}` },
    { status: 400 }
  );
  return addCorsHeaders(errorResponse, request);
}
```

### 2. **Add Code Challenge Validation:**
```typescript
// After line 78 (redirectUri validation)
if (codeChallenge) {
  // S256 challenges must be 43-128 characters (base64url encoded)
  if (codeChallenge.length < 43 || codeChallenge.length > 128) {
    const errorResponse = NextResponse.json(
      { success: false, error: "invalid_request", error_description: "Invalid code_challenge length" },
      { status: 400 }
    );
    return addCorsHeaders(errorResponse, request);
  }
}
```

### 3. **Add TTL Validation:**
```typescript
// After line 42 (ttlSeconds parsing)
const ttlSeconds = ttlSecondsParam 
  ? Math.max(300, Math.min(3600, parseInt(ttlSecondsParam, 10)))
  : 600;
```

### 4. **Require Non-Null Scopes and State:**
```typescript
// Line 38-39 already use ! (non-null assertion)
// This is correct - scopes and state are required by OAuth spec
// But add better error handling:

if (!scopes || scopes.trim().length === 0) {
  return error "invalid_request" "scopes is required"
}

if (!state || state.trim().length === 0) {
  return error "invalid_request" "state is required"
}
```

---

## 📋 Complete Request Example

```bash
# Full authorize request with all parameters
GET /api/auth/authorize?
  client_id=my-app-xyz \
  redirect_uri=https://myapp.com/callback \
  scopes=openid,profile,email \
  state=abc123xyz \
  code_challenge=E9Mrozoa2owUedPyAPfra-KK287HMwAMVrfgJdrqst0 \
  code_challenge_method=S256 \
  ttl_seconds=900 \
  prompt=none
```

### Response Flows:

**✅ Success (valid session, prompt=none):**
```json
{ "code": "auth_code_xxx", "state": "abc123xyz" }
```

**✅ Success (needs login):**
```
Redirect to /login?client_id=...&redirect_uri=...&state=...
```

**❌ Error (invalid client):**
```json
{ "success": false, "error": "invalid_client" }
```

---

