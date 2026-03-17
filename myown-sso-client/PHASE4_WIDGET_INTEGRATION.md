# Phase 4: Widget Integration ✅

## Overview
Widget iframe communication, account switching, and cross-origin messaging implemented.

## What's Built

### 1. Widget Types (`src/shared/widget-types.ts`)
- `WidgetMessageType` - Message protocol types
- `WidgetMessage<T>` - PostMessage envelope
- `AccountSwitchMessage` - Account switch payload
- `WidgetConfig` - Widget configuration options

### 2. Iframe Messenger (`src/client/widget/iframe-messenger.ts`)
Utility class for iframe communication:
- `send(type, data)` - Send message to widget
- `on(type, callback)` - Listen for widget messages
- `handleMessage(event)` - Route incoming messages
- Origin validation for security

### 3. Account Switcher (`src/client/widget/account-switcher.tsx`)
React component for account switching UI:
- Dropdown showing all user accounts
- Highlights current active account
- Handles account switch with `switchAccount()` hook
- Auto-hides if only 1 account exists

## Integration

The SSOProvider already has widget script loading + postMessage listener built-in. Use AccountSwitcher component in your app:

```tsx
import { AccountSwitcher, useSSO } from 'myown-sso-client';

function Header() {
  const { session } = useSSO();
  return (
    <header>
      {session && <AccountSwitcher />}
    </header>
  );
}
```

## Widget Communication Protocol

Messages sent/received via postMessage:
- `sessionUpdate` - Session refreshed
- `logout` - User logged out
- `accountSwitch` - User switched account
- `getAccounts` - Request account list
- `error` - Error occurred

## Files Created
✅ src/shared/widget-types.ts
✅ src/client/widget/iframe-messenger.ts
✅ src/client/widget/account-switcher.tsx
✅ src/client/widget/index.ts (updated)

## Status: Phase 4 ✅ Complete | Phase 5 🚧 Build & Packaging
