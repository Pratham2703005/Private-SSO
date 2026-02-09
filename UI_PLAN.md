# MyOwn SSO — UI & Implementation Plan (IDP-Centric)

## Overview
**Goal:** Pure IDP-centric SSO where ALL authentication UI + client management happens at `localhost:3000`. Clients (3001, 3002) are "dumb" apps that only redirect to IDP.

**Key Principle:** Users never see login UI on client domains. They visit IDP, authenticate once, and get SSO across all registered clients.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  IDP Server (localhost:3000) - Single Source of Truth           │
│                                                                 │
│  ├─ Public Pages                                                │
│  │  ├─ GET  /                  → Landing page                   │
│  │  ├─ GET  /login             → Login form                     │
│  │  ├─ POST /login             → Handle login                   │
│  │  ├─ GET  /signup            → Signup form                    │
│  │  ├─ POST /signup            → Handle signup                  │
│  │  └─ GET  /forgot-password   → Reset flow (optional)          │
│  │                                                               │
│  ├─ Protected Routes (Logged-in Users)                           │
│  │  ├─ GET  /dashboard         → User home + accounts           │
│  │  ├─ POST /logout            → Logout + revoke session        │
│  │  └─ GET  /verify-email      → Email confirmation (optional)  │
│  │                                                               │
│  ├─ Admin Routes (role='admin' ONLY)                             │
│  │  ├─ GET  /admin             → Admin gateway                  │
│  │  ├─ GET  /admin/clients     → List registered clients        │
│  │  ├─ GET  /admin/clients/new → New client form                │
│  │  ├─ POST /admin/clients     → Register new client            │
│  │  ├─ GET  /admin/clients/:id → Edit client                    │
│  │  ├─ POST /admin/clients/:id → Update client                  │
│  │  ├─ POST /admin/clients/:id/revoke → Revoke client           │
│  │  ├─ GET  /admin/users       → User management (optional)     │
│  │  └─ POST /admin/users/:id/role → Change user role (optional) │
│  │                                                               │
│  └─ OAuth2 Endpoints (Already Built ✅)                          │
│     ├─ GET  /authorize         → OAuth authorization            │
│     ├─ POST /api/auth/token    → Token exchange                 │
│     └─ POST /api/auth/logout   → Revoke tokens                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Client Apps (3001, 3002, etc.)  - "Dumb" Clients              │
│                                                                 │
│  ├─ GET  /                      → Check session → Redirect      │
│  ├─ GET  /dashboard             → User profile + switcher       │
│  ├─ GET  /api/auth/silent-login → Start OAuth flow             │
│  ├─ GET  /api/auth/callback     → Handle OAuth callback        │
│  ├─ POST /api/auth/logout       → Logout from app              │
│  ├─ GET  /api/user              → Get profile                  │
│  └─ GET  /api/accounts          → List user accounts           │
│                                                                 │
│  ❌ NO LOGIN FORM                                                │
│  ❌ NO SIGNUP FORM                                               │
│  ❌ NO AUTH UI AT ALL                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## PHASE 0: What's Already Built ✅

### Infrastructure Complete:
- ✅ OAuth2 + PKCE authorization flow
- ✅ Token management (access + refresh) with rotation
- ✅ Account switching in DB
- ✅ Session management
- ✅ Database schema ready

### API Routes Ready:
- ✅ `/api/auth/authorize` - OAuth authorization endpoint
- ✅ `/api/auth/token` - Token exchange
- ✅ `/api/auth/login` - Login handler (POST)
- ✅ `/api/auth/signup` - Signup handler (POST)
- ✅ `/api/auth/logout` - Logout handler (POST)
- ✅ `/api/user/profile` - Get user profile

---

## PHASE 1: IDP Landing Page + Login/Signup (Priority: HIGH)

### 1.1 Landing Page
**Route:** `GET /`

**What to Build:**
- Hero section with branding
- Main CTA: "Sign In" button → `/login` (Also remember when move to login to signup or vice versa, so don't loose url params that time)
- Optional: "Sign Up" link → `/signup`
- Minimal navbar with logo

**Redirect Logic:**
- If user already logged in (valid session) → redirect `/dashboard`
- Else → Show landing page

**File:** `idp-server/app/page.tsx`

---

### 1.2 Login Page
**Route:** `GET /login` (show form) | `POST /login` (handle)

**What to Build:**
- Email + Password form
- "Don't have account?" → `/signup`
- "Forgot password?" → `/forgot-password`
- Error message display

**Behavior on Success:**
1. Create IDP session cookie (`idp_session=...`)
2. Store session in DB
3. Check URL params for OAuth flow:
   - If `client_id` present → Redirect to `/authorize?client_id=xxx&...`
   - Else → Redirect to `/dashboard`

**URL Params (from OAuth flow):**
```
GET /login?client_id=client-a&redirect_uri=...&state=...&code_challenge=...
```

**File:** `idp-server/app/login/page.tsx`

---

### 1.3 Signup Page
**Route:** `GET /signup` (show form) | `POST /signup` (handle)

**What to Build:**
- Name + Email + Password + Confirm Password form
- Email uniqueness validation
- Password strength validation
- "Already have account?" → `/login`

**Behavior on Success:**
1. Create user record
2. Create default user account
3. Create IDP session
4. Redirect same as login (to `/authorize` or `/dashboard`)

**File:** `idp-server/app/signup/page.tsx`

---

### 1.4 User Dashboard
**Route:** `GET /dashboard`

**Protected:** Must have valid `idp_session` cookie

**What to Build:**
- Welcome section (user name)
- Your Accounts section:
  - List all user accounts
  - Highlight active account
  - Button to switch account
  - "+ Add Account" button
- Connected Apps section (future)
- Account Settings section with links
- "Sign Out" button

**File:** `idp-server/app/dashboard/page.tsx`

---

## PHASE 2: Admin Panel (Priority: HIGH)

### 2.1 Admin Gateway
**Route:** `GET /admin`

**Protected:** `requireLogin` + `requireRole('admin')`

**What to Build:**
- Simple page with admin menu
- Links to Client Management + User Management
- Redirect if not admin (403)

**File:** `idp-server/app/admin/page.tsx`

---

### 2.2 Client Registration List
**Route:** `GET /admin/clients`

**What to Build:**
- Table showing all registered OAuth clients:
  - Client Name | Client ID | Redirect URIs | Created By | Status | Actions
- "Register New Client" button
- Edit/Revoke buttons per client

**File:** `idp-server/app/admin/clients/page.tsx`

---

### 2.3 Register New Client Form
**Route:** `GET /admin/clients/new` (form) | `POST /admin/clients` (submit)

**What to Build:**
- Client Name input
- Description textarea
- Redirect URIs (multi-input, add/remove)
- CORS Origins (multi-input, optional)
- Submit button

**On Submit:**
- Generate client_id + client_secret
- Show modal with secret (SHOWN ONCE)
- Redirect to client list

**⚠️ Important:** Secret cannot be retrieved again

**File:** `idp-server/app/admin/clients/new/page.tsx`

---

### 2.4 Edit Client / Revoke
**Route:** `GET /admin/clients/:clientId` | `POST /admin/clients/:clientId`

**What to Build:**
- Edit form (same as create, pre-filled)
- "Rotate Secret" button (advanced)
- "Revoke Client" button (Danger Zone)
- "Delete Client" button (Danger Zone)

**File:** `idp-server/app/admin/clients/[clientId]/page.tsx`

---

### 2.5 User Management (Optional for MVP)
**Route:** `GET /admin/users`

**What to Build:**
- List all users with Role + Last Login
- Dropdown to change role per user
- "Revoke Tokens" button per user

**File:** `idp-server/app/admin/users/page.tsx`

---

## PHASE 3: Account Center (Priority: HIGH)

### Overview
Google Accounts-style personal account management. Users can manage their profile, security, connected apps, and privacy settings.

### 3.1 Account Overview
**Route:** `GET /account`

**Protected:** `requireLogin`

**What to Build:**
- Account summary card (name, email, photo)
- Quick links to all account sections:
  - Personal info
  - Security (with risk warnings if needed)
  - Connected apps
  - Privacy & data
- Last login info
- Active sessions count

**File:** `idp-server/app/account/page.tsx`

---

### 3.2 Profile Management
**Route:** `GET /account/profile` (form) | `POST /account/profile` (update)

**What to Build:**
- Edit name
- Edit profile photo (upload + preview)
- Edit email (with verification if changing)
- Display user ID
- Show last updated timestamp

**File:** `idp-server/app/account/profile/page.tsx`

---

### 3.3 Security Dashboard
**Route:** `GET /account/security`

**What to Build:**
- Quick security status (password strength, unreviewed apps, etc.)
- Active sessions count
- Recent activity graph (last 30 days)
- Links to sub-sections:
  - "Manage all sessions" → `/account/security/sessions`
  - "Change password" → `/account/security/password`
  - "Connected apps" → `/account/apps`
  - "Recovery options" (optional)

**File:** `idp-server/app/account/security/page.tsx`

---

### 3.4 Sessions Management
**Route:** `GET /account/security/sessions`

**Protected:** `requireLogin`

**What to Build:**
- List all active sessions with metadata:
  - Device info (User-Agent, browser/OS)
  - IP address (with approx location from GeoIP, optional)
  - Last active time
  - Created date
  - "Revoke" button per session
  - "Revoke All Other Sessions" button

Session metadata fields:
```
- session_id (hidden)
- user_id (hidden)
- ip_address (e.g., "192.168.1.1")
- user_agent (e.g., "Chrome on Windows")
- created_at (e.g., "Feb 9, 2 weeks ago")
- last_active_at (e.g., "Feb 9, 2 min ago")
- revoked_at (nullable, for displaying revoked sessions)
- revoked_reason (optional, e.g., "User revoked" / "Security reset")
```

**File:** `idp-server/app/account/security/sessions/page.tsx`

**Endpoints:**
- `GET /api/account/sessions` - List all sessions
- `POST /api/account/sessions/:sessionId/revoke` - Revoke one session
- `POST /api/account/sessions/revoke-all` - Logout all other devices

---

### 3.5 Password Management
**Route:** `GET /account/security/password` (form) | `POST /account/security/password` (update)

**What to Build:**
- Current password input (required for verification)
- New password input (with strength indicator)
- Confirm password input
- "Update Password" button
- Show success message on success
- Auto-logout all other sessions after password change (security best practice)

**File:** `idp-server/app/account/security/password/page.tsx`

---

## PHASE 4: Connected Apps (OAuth Grants Management)

### 4.1 Connected Apps List
**Route:** `GET /account/apps`

**Protected:** `requireLogin`

**What to Build:**
- List all authorized clients (apps where user granted permission)
- For each app show:
  - App name (Client A, Client B, etc.)
  - Scopes granted (e.g., "profile, email")
  - Last used date (e.g., "Feb 7, 3 days ago")
  - Granted date (e.g., "Jan 20")
  - "Revoke Access" button (red/danger button)

**File:** `idp-server/app/account/apps/page.tsx`

**Endpoint:** `GET /api/account/apps`

---

### 4.2 Revoke App Access
**Route:** `POST /account/apps/:clientId/revoke`

**Behavior:**
1. Set `revoked_at` timestamp in oauth_grants table
2. Invalidate all refresh tokens for this client (user_id + client_id)
3. Next time user tries to use that app, they'll see "Access revoked" + "Re-authorize"
4. Show success message to user

**Endpoint:** `POST /api/account/apps/:clientId/revoke`

---

## PHASE 5: Privacy & Data (Optional for MVP)

### 5.1 Privacy Dashboard
**Route:** `GET /account/privacy`

**Protected:** `requireLogin`

**What to Build:**
- Data export section
- Account deletion section
- Cookie/tracking preferences (optional)

**File:** `idp-server/app/account/privacy/page.tsx`

---

### 5.2 Export My Data
**Route:** `POST /account/privacy/export`

**Behavior:**
1. Collect user data:
   - Profile (name, email, created_at, etc.)
   - All accounts
   - All sessions (with dates)
   - All connected apps (grants)
   - Login history (if tracked)
2. Generate JSON file
3. Send as download
4. Log this action (audit log)

**Endpoint:** `POST /api/account/privacy/export`

---

### 5.3 Delete Account
**Route:** `POST /account/privacy/delete`

**⚠️ Danger Zone**

**Behavior:**
1. Require confirmation (double-click or text-match)
2. Require current password verification
3. Delete:
   - User record
   - All accounts
   - All sessions
   - All grants
   - Invalidate all tokens
4. Log deletion (audit log)
5. Redirect to `/` (landing page)
6. Send "Account Deleted" email (optional)

**Endpoint:** `POST /api/account/privacy/delete`

---

## PHASE 6: Database Schema Updates

### New Table: oauth_grants (or user_authorized_clients)
```sql
CREATE TABLE oauth_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
  granted_scopes TEXT[] NOT NULL, -- e.g., ['email', 'profile']
  granted_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP, -- Updated when user authenticates to this client
  revoked_at TIMESTAMP, -- NULL = active, NOT NULL = revoked
  revoked_reason TEXT, -- e.g., 'user_revoked', 'security_reset'
  
  UNIQUE(user_id, client_id)
);

CREATE INDEX idx_oauth_grants_user ON oauth_grants(user_id);
CREATE INDEX idx_oauth_grants_client ON oauth_grants(client_id);
```

### Update Table: sessions
```sql
-- Add session metadata columns
ALTER TABLE sessions ADD COLUMN ip_address TEXT;
ALTER TABLE sessions ADD COLUMN user_agent TEXT;
ALTER TABLE sessions ADD COLUMN last_active_at TIMESTAMP DEFAULT NOW();
ALTER TABLE sessions ADD COLUMN revoked_reason TEXT;

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_revoked ON sessions(revoked_at);
```

### Update Table: oauth_clients
```sql
-- Add is_active flag (if not already present)
ALTER TABLE oauth_clients ADD COLUMN is_active BOOLEAN DEFAULT true;

-- Add creation tracking
ALTER TABLE oauth_clients ADD COLUMN created_by_admin_id UUID;
ALTER TABLE oauth_clients ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE oauth_clients ADD COLUMN updated_at TIMESTAMP;
```

---

## PHASE 7: New API Endpoints (Account Center)

### GET /api/account/sessions
```typescript
// List all active sessions for current user
// Protected: requireLogin

Response:
[
  {
    id: 'session-uuid',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
    ip_address: '192.168.1.100',
    created_at: '2024-02-01T10:00:00Z',
    last_active_at: '2024-02-09T15:30:00Z',
    revoked_at: null
  },
  ...
]
```

### POST /api/account/sessions/:sessionId/revoke
```typescript
// Revoke one specific session
// Protected: requireLogin

Response:
{ success: true, message: 'Session revoked' }
```

### POST /api/account/sessions/revoke-all
```typescript
// Logout all OTHER sessions (keep current active)
// Protected: requireLogin

Request:
{ keep_current: true } // optional

Response:
{ success: true, message: '3 other sessions revoked' }
```

### GET /api/account/apps
```typescript
// List all authorized clients
// Protected: requireLogin

Response:
[
  {
    client_id: 'client-a',
    name: 'Client A',
    granted_scopes: ['email', 'profile'],
    granted_at: '2024-01-15T08:00:00Z',
    last_used_at: '2024-02-09T12:30:00Z',
    revoked_at: null
  },
  ...
]
```

### POST /api/account/apps/:clientId/revoke
```typescript
// Revoke access to one app
// Protected: requireLogin

Response:
{ success: true, message: 'App access revoked' }
```

### POST /api/account/profile
```typescript
// Update user profile
// Protected: requireLogin

Request:
{
  name?: string,
  email?: string,
  profile_image?: string (URL)
}

Response:
{ success: true, user: { id, name, email, profile_image } }
```

### POST /api/account/privacy/export
```typescript
// Export user data as JSON
// Protected: requireLogin

Response:
// Streams a JSON file with all user data
```

### POST /api/account/privacy/delete
```typescript
// Delete user account
// Protected: requireLogin

Request:
{
  password: string (required for verification),
  confirm: 'DELETE' (confirmation text)
}

Response:
{ success: true, message: 'Account deleted' }
// Then user is logged out + redirected to /
```

---

## Security Notes

### Critical Rules for Account Center & Token Management

**1. Tokens Never in URL**
- ❌ Don't pass access_token in URL query params
- ✅ Always use Authorization header or httpOnly cookies
- ✅ Query params should only contain code + state for OAuth flow

**2. Strict Redirect URI Validation**
- Exact match required (no wildcards)
- Https only in production
- Validate on every auth endpoint
- Check origin header for CSRF protection

**3. Admin Panel Protection**
- ✅ Check `role = 'admin'` on every admin route
- ✅ Log all admin actions (client registration, client revocation, secret rotation)
- ❌ Don't expose client secrets in API responses (show only on creation)
- Store secrets hashed in database (never plain text)

**4. Session Security**
- Store only session_id in cookie (not tokens)
- Keep tokens server-side in database
- Set secure + httpOnly + sameSite=strict flags
- Rotate session IDs on privilege escalation
- Revoke all sessions when password changes

**5. Token Revocation**
- When user revokes app access → Invalidate all refresh tokens for that client
- When user revokes session → Set revoked_at timestamp
- When admin revokes client → All user tokens for that client immediately invalid
- Check revocation status on every token refresh

**6. Rate Limiting**
- `/api/auth/token` - Max 10 requests per minute per IP
- `/api/auth/login` - Max 5 failed attempts per 15 minutes
- `/api/account/sessions/revoke-all` - Max 3 times per hour
- `/api/auth/authorize` - Max 20 redirects per hour per client

**7. Single-Show Client Secret**
- Generate new client secret randomly
- Show secret only ONCE on creation
- Don't show in client list or edit pages
- Provide "Rotate Secret" button to generate new one
- Old secret still works during rotation period (5 min grace)

**8. Audit Logging**
- Log all sensitive actions:
  - Admin registers client
  - Admin revokes client
  - User revokes app access
  - User revokes session
  - User changes password
  - User deletes account
  - Failed login attempts
- Include: timestamp, user_id, ip_address, user_agent, action

---

## UI Requirements

### Landing Page Design (/)
- Minimal, Google-inspired design
- "Sign in with MyOwn" button
- No signup button (explain signup on login page)
- Links: Legal docs, About, API docs
- Keep it simple - purpose is OAuth entry point

### Dashboard Design (/account)
- Clean settings-style UI (similar to Google Account)
- Left sidebar with sections:
  - Profile
  - Security
  - Apps
  - Privacy
- Each section has icon + label
- Account card at top with quick info (avatar, name, email)

### Account Center Aesthetic
- Use consistent spacing (16px base unit)
- Cards/sections for grouping (Figma-style spacing)
- Red danger buttons for destructive actions
- Green confirmation messages
- Inline validation (password strength, email format)
- Mobile responsive (mobile-first design)

### Tables (Session List, Apps List)
- Sortable columns (created_at, last_active, etc.)
- Pagination for 50+ items
- Bulk actions (Revoke All Sessions button)
- Loading states + error boundaries
- Empty states with helpful messaging

---

## Optional / Future Features

### Not in MVP, but consider for Phase 2:

1. **Two-Factor Authentication (2FA / TOTP)**
   - Page: `/account/security/2fa`
   - Generate QR code for authenticator apps
   - Backup codes for account recovery
   - Request during high-risk actions

2. **Backup Codes**
   - Generate 8-10 one-time codes
   - User downloads PDF
   - Can invalidate all and regenerate

3. **Device Trust / Remember This Device**
   - Skip 2FA on trusted devices
   - List trusted devices
   - Revoke device trust

4. **Activity Log**
   - Page: `/account/security/activity`
   - All login events with IP, device, location
   - Filter by date range
   - Export as CSV

5. **Consent Screen (OAuth Scopes)**
   - When app requests scopes, show consent screen
   - User reviews what app will access
   - Can grant partial scopes
   - Remember choice for future logins

6. **Email Verification**
   - Send verification email on signup + email change
   - Click link to verify
   - Unverified emails can't be used for login

7. **Password Reset (Forgot Password)**
   - Send reset link to email
   - Link is one-time use (expire in 1 hour)
   - Must verify old password before setting new one

8. **Account Recovery**
   - If user forgets password + loses 2FA device
   - Use backup codes to recover
   - Or security questions (name of first pet, etc.)

---

## PHASE 8: Middleware & Protection

### 8.1 requireLogin Middleware
```typescript
// idp-server/lib/middleware/requireLogin.ts

export function requireLogin(handler) {
  return async (request: NextRequest) => {
    const sessionId = request.cookies.get('idp_session')?.value;
    if (!sessionId) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    request.user = await getUserById(session.user_id);
    return handler(request);
  };
}
```

### 8.2 requireRole Middleware
```typescript
// idp-server/lib/middleware/requireRole.ts

export function requireRole(role: string) {
  return (handler) => requireLogin(async (request) => {
    if (request.user.role !== role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return handler(request);
  });
}
```

---

## PHASE 9: Database Migrations

### Migration 1: Add role column
```sql
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';
CREATE INDEX idx_users_role ON users(role);

-- Seed first admin
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
```

### Migration 2: Add admin tracking
```sql
ALTER TABLE oauth_clients ADD COLUMN created_by_admin_id UUID;
ALTER TABLE oauth_clients ADD CONSTRAINT fk_created_by_admin
  FOREIGN KEY (created_by_admin_id) REFERENCES users(id);
```

### Migration 3: Add status column
```sql
ALTER TABLE oauth_clients ADD COLUMN is_active BOOLEAN DEFAULT true;
CREATE INDEX idx_oauth_clients_active ON oauth_clients(is_active);
```

---

## PHASE 10: Admin API Endpoints (Protected Routes)

### GET /api/admin/clients
- Return all oauth_clients with admin info
- Protected: requireRole('admin')

### POST /api/admin/clients
- Create new OAuth client
- Generate client_id + client_secret
- Protected: requireRole('admin')

### GET /api/admin/clients/:clientId
- Get client details
- Protected: requireRole('admin')

### POST /api/admin/clients/:clientId
- Update client (name, URIs, origins)
- Protected: requireRole('admin')

### POST /api/admin/clients/:clientId/revoke
- Set is_active = false + invalidate tokens
- Protected: requireRole('admin')

### POST /api/admin/clients/:clientId/rotate-secret
- Generate new secret
- Protected: requireRole('admin')

---

## PHASE 11: Client-Side Changes (Clients 3001 & 3002)

### ❌ Remove These:
- `/login` page
- `/signup` page
- Login/Signup components

### ✅ Keep/Update These:
- `/` → Home (check session + redirect)
- `/dashboard` → User profile
- `/api/auth/callback` → OAuth callback
- `/api/auth/silent-login` → Start OAuth
- `/api/auth/logout` → Logout
- `/api/user` → Get profile
- `/api/accounts` → List accounts (needs work)

### New Client Endpoint: GET /api/accounts
- Call IDP `/api/user/profile` with Bearer token
- Return accounts list for AccountSwitcher

---

## PHASE 12: Testing Plan

### Test Scenarios:

1. **Fresh User Login**
   - Visit Client A → Redirect to IDP → Login → Redirected to Client A
   - ✅ User logged in

2. **SSO (Single Sign-On)**
   - Logged in on Client A → Visit Client B → Auto login (no login form)
   - ✅ SSO works

3. **Admin Registers Client**
   - Admin goes to `/admin/clients/new` → Fill form → Submit
   - ✅ Client created + secret shown

4. **Account Switching**
   - Click account switcher → Select account → User switched
   - ✅ Account switch works

5. **Client Revocation**
   - Admin clicks "Revoke" on client → Client becomes inactive
   - ✅ Client revocation works

---

## Implementation Timeline

**Total Effort:** ~24-28 hours (increased from 16-20 to include Account Center)

| Phase | Task | Hours |
|-------|------|-------|
| 1 | Landing + Login/Signup | 3 |
| 1 | User Dashboard | 2 |
| 2 | Admin Gateway + Client List | 2 |
| 2 | Client Registration Form | 2 |
| 2 | Client Edit/Revoke | 1.5 |
| 3 | Account Center Overview | 1 |
| 4 | Sessions Management UI | 2 |
| 4 | Session Revoke API | 1 |
| 5 | Connected Apps UI | 1.5 |
| 5 | App Revocation API | 0.5 |
| 5 | Privacy (Export/Delete) | 2 |
| 6 | Database Schema (oauth_grants + sessions metadata) | 0.5 |
| 7 | Account Center API Endpoints | 2 |
| 8 | Middleware | 1 |
| 9 | Database Migrations | 0.5 |
| 10 | Admin API Endpoints | 2 |
| 11 | Client Cleanup | 1 |
| 12 | Testing | 2 |

---

## Next Steps

1. ✅ **Approve UI Plan** - Review Account Center additions
2. **Build Phase 1** - Landing page + Login/Signup on IDP
3. **Build Phase 2** - Admin panel
4. **Build Phases 3-7** - Account Center + Sessions + Apps
5. **Build Phases 8-12** - Middleware, migrations, client cleanup, testing

Ready to start building?