# Client-d SSO Integration Guide

## Overview

Client-d is now fully integrated with the **Pratham SSO SDK**. This document explains:
- What was set up
- How the OAuth2 flow works
- How to test the integration
- How to troubleshoot issues

---

## What Was Implemented

### 1. API Routes (Server-side)

#### `/api/auth/start` - Initiate OAuth2 Flow
**File:** `app/api/auth/start/route.ts`

Delegates to `startAuth` from the SDK. When a user clicks "Sign In":
1. Generates a random state (CSRF protection)
2. Creates PKCE code challenge (security for public clients)
3. Signs state with HMAC-SHA256
4. Stores PKCE verifier in secure httpOnly cookie
5. Redirects to IDP authorization endpoint

**Example request:**
```
GET http://localhost:3002/api/auth/start
```

**Redirect:**
```
http://localhost:3001/oauth/authorize?client_id=client-d&state=...&code_challenge=...
```

---

#### `/api/auth/callback` - Exchange Code for Session
**File:** `app/api/auth/callback/route.ts`

Delegated to `handleCallback` from the SDK. After user authorizes on IDP:
1. Receives: `?code=...&state=...`
2. Verifies state signature (CSRF check)
3. Retrieves PKCE verifier from cookie
4. Exchanges code + verifier at IDP token endpoint
5. Extracts session ID from response
6. Stores session ID in secure httpOnly cookie
7. Redirects to home page

**Example request:**
```
GET http://localhost:3002/api/auth/callback?code=abc123&state=xyz789
```

**Result:**
- Session cookie stored (`httpOnly`, `secure`, `sameSite=strict`)
- User is now authenticated

---

#### `/api/me` - Validate Session
**File:** `app/api/me/route.ts`

Delegates to `validateSession` from the SDK. Called by SSOProvider on mount and periodically:
1. Extracts session ID from cookie
2. Validates session at IDP endpoint
3. Returns user data if valid
4. Returns empty if invalid/expired

**Example request:**
```
GET http://localhost:3002/api/me
```

**Success response (200):**
```json
{
  "id": "user-123",
  "email": "user@example.com",
  "name": "John Doe",
  "picture": "https://..."
}
```

**Unauthorized response (200 with empty body):**
```json
{}
```

---

### 2. UI Components (Client-side)

#### `LoginButton.tsx`
Simple button that switches between "Sign In" and "Sign Out" based on session state.

**Features:**
- Shows "Loading..." while checking session
- Shows "Sign Out" if authenticated
- Shows "Sign In" if not authenticated
- Uses `useSSO` hook for auth methods

**Usage in page.tsx:**
```tsx
<LoginButton />
```

---

#### `UserProfile.tsx`
Displays authenticated user's information.

**Shows:**
- User name
- User email
- User avatar (if available)
- Loading state
- "Not signed in" message if no session

**Usage in page.tsx:**
```tsx
<UserProfile />
```

---

### 3. Layout & Page Setup

#### `app/layout.tsx`
Wrapped entire app with `SSOProvider` from the SDK.

**Key props:**
- `apiUrl`: Base URL for API calls (http://localhost:3002)
- `idpServer`: IDP server URL (from env: NEXT_PUBLIC_IDP_SERVER)
- `clientId`: OAuth2 client ID (from env: NEXT_PUBLIC_CLIENT_ID)

```tsx
<SSOProvider
  apiUrl="http://localhost:3002"
  idpServer={process.env.NEXT_PUBLIC_IDP_SERVER}
  clientId={process.env.NEXT_PUBLIC_CLIENT_ID}
>
  {children}
</SSOProvider>
```

#### `app/page.tsx`
Clean, focused authentication demo page showing:
- SSO title & description
- User profile display
- Login/logout button
- Feature list

---

## Configuration

### Environment Variables
File: `.env.local`

```env
# IDP server running on port 3001
NEXT_PUBLIC_IDP_SERVER=http://localhost:3001

# OAuth2 client ID registered with IDP
NEXT_PUBLIC_CLIENT_ID=client-d

# Redirect URI after authorization
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3002/api/auth/callback

# Secret for signing state (CSRF protection)
# Generate: openssl rand -hex 32
OAUTH_SECRET=your_random_32_char_secret_here
```

### Dependency Setup
File: `package.json`

SDK is linked via local file path:
```json
{
  "dependencies": {
    "pratham-sso": "file:../pratham-sso"
  }
}
```

This enables local development - changes to SDK immediately reflected in client-d.

---

## OAuth2 Flow Diagram

```
┌─────────────┐                                    ┌────────────┐
│  Client-d   │                                    │    IDP     │
│  (Browser)  │                                    │  Server    │
└──────┬──────┘                                    └────────────┘
       │                                                 
       │ 1. Click "Sign In"                             
       │ -> useSSO.signIn()                             
       │                                                
       │ 2. GET /api/auth/start                         
       ├─────────────────────────────────────────────>│
       │                                           generate state
       │                                           generate PKCE
       │                                                 
       │ 3. Redirect to IDP authorize                   
       │ <- /oauth/authorize?code_challenge=...        
       │<─────────────────────────────────────────────┤
       │                                                 
       │ 4. Show login form                             
       │ (User enters credentials)                       
       │                                                 
       │ 5. GET /api/auth/callback?code=...&state=...   
       ├─────────────────────────────────────────────>│
       │                                       verify state
       │                                   exchange code + PKCE
       │                                                 
       │ 6. Receive session cookie                      
       │ (httpOnly, secure)                             
       │<─────────────────────────────────────────────┤
       │                                                 
       │ 7. SSOProvider automatically:                  
       │ - Calls /api/me on mount                       
       │ - Receives user data                           
       │ - Updates session state                        
       │ - LoginButton & UserProfile re-render          
       │                                                 
       └─────────────────────────────────────────────┘
```

---

## Testing the Integration

### Prerequisites
1. **IDP Server Running**
   ```bash
   cd idp-server
   npm run dev
   # Should run on http://localhost:3001
   ```

2. **Fill in .env.local**
   ```
   OAUTH_SECRET=<generate with: openssl rand -hex 32>
   ```

### Test Steps

#### 1. Start Development Server
```bash
cd client-d
npm run dev
# Should run on http://localhost:3002
```

#### 2. Open in Browser
```
http://localhost:3002
```

You should see:
- "Pratham SSO" title
- "Not signed in" message
- "Sign In" button

#### 3. Click "Sign In"
- Should redirect to IDP login page (localhost:3001)
- URL should change to `.../oauth/authorize?...`

#### 4. Log In on IDP
- Use test credentials (varies by IDP setup)

#### 5. Verify Callback
- After login, should redirect back to `localhost:3002`
- Should see user profile (name, email, avatar if available)
- Button should change to "Sign Out"

#### 6. Test Session Persistence
- Refresh page (F5)
- User should still be logged in
- Profile should show again (calls /api/me)

#### 7. Test Sign Out
- Click "Sign Out" button
- Session should be cleared
- Should see "Not signed in" again

---

## Troubleshooting

### Problem: "Sign In" redirects to 404
**Cause:** /api/auth/start not working
**Solution:** 
- Check `npm run dev` is running in client-d
- Check console for errors
- Verify environment variables are set

---

### Problem: IDP login works but redirects to wrong URL
**Cause:** Redirect URI mismatch
**Solution:**
- Check NEXT_PUBLIC_REDIRECT_URI in .env.local matches:
  - URL registered with IDP
  - Actual callback route path
- Both must be exact match (protocol, domain, path)

---

### Problem: "State signature verification failed"
**Cause:** OAUTH_SECRET mismatch or missing
**Solution:**
- Ensure OAUTH_SECRET is set in .env.local
- Must be same secret used in IDP configuration
- If changed, user must sign in again (old state invalid)

---

### Problem: User profile not showing after login
**Cause:** /api/me not returning data
**Solution:**
- Check IDP is running (localhost:3001)
- Check session cookie is set (DevTools → Application → Cookies)
- Check IDP can validate the session
- Check logs for API call failures

---

### Problem: "Attempted import outside root"
**Cause:** Incorrect tsconfig path aliases
**Solution:**
- Check `tsconfig.json` has correct paths
- Example: `"@/*": ["./*"]`
- Restart dev server after changes

---

## Architecture

### Client-Side (React)
```
SSOProvider (app/layout.tsx)
├── Session state management
├── Auto refresh on mount/focus
├── Widget iframe handling
├── Event emission (logout, accountSwitch, etc.)
│
└─> LoginButton (components/LoginButton.tsx)
    ├── useSSO hook → session, loading, signIn, logout
    └─> Calls /api/auth/start on sign in
    
└─> UserProfile (components/UserProfile.tsx)
    └─> useSSO hook → session data display
```

### Server-Side (Next.js App Router)
```
/api/auth/start
├── Calls startAuth from SDK
├── Generates state + PKCE
└─> Redirects to IDP authorize

/api/auth/callback
├── Calls handleCallback from SDK
├── Validates state + exchanges code
└─> Stores session cookie

/api/me
├── Calls validateSession from SDK
├── Checks session with IDP
└─> Returns user data or empty
```

### SDK (pratham-sso)
- **Entry point**: Main export (SSOProvider, useSSO, hooks)
- **Server utilities**: From `pratham-sso/server` (startAuth, handleCallback, etc.)
- **Shared**: From `pratham-sso/shared` (types, config, utils)

---

## Key Security Features

✅ **PKCE (Proof Key for Public Clients)**
- Prevents authorization code interception attacks
- Required because browser is public client (can't keep secrets)

✅ **State Parameter**
- Signed with HMAC-SHA256
- Prevents CSRF attacks
- Verified on callback

✅ **httpOnly Cookies**
- Session ID never exposed to JavaScript
- Protects against XSS attacks
- Automatically sent with API requests

✅ **CORS & Origin Validation**
- Widget iframe only accepts messages from IDP origin
- API routes validate request origins

✅ **Session Validation**
- Every /api/me call re-validates with IDP
- Expired sessions detected immediately
- No token in browser

---

## What's Next?

### Optional Enhancements
1. **Add Account Switcher**
   - Import `AccountSwitcher` from 'pratham-sso'
   - Allows users to switch between multiple accounts
   
2. **Subscribe to Events**
   - `useSSO().on('logout', callback)`
   - `useSSO().on('accountSwitch', callback)`
   - Clean up resources on auth changes

3. **Error Handling**
   - `useSSO().error` contains auth errors
   - Log to monitoring service
   - Show user-friendly error messages

4. **Protected Routes**
   - Wrap routes that require authentication
   - Redirect to login if session invalid

5. **Multi-Tenant Support**
   - Create additional clients in IDP
   - Switch between them via environment

---

## Reference

**SDK Documentation:** See ../pratham-sso/README.md
**IDP Server Guide:** See ../idp-server/README.md
**Environment Setup:** See .env.local
