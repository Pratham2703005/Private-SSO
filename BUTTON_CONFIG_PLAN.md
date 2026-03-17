# Button Configuration - Implementation Plan

## Overview
Give domains (client-c, client-d) the ability to customize Sign In and Account Switcher button styling via configuration object passed through `SSOProvider`.

---

## Architecture Flow

```
Domain (client-d/layout.tsx)
    ↓
    SSOProvider (clientConfig prop)
    ↓
    postMessage to widget iframe
    ↓
    WidgetClient component
    ↓
    SignInButton / AccountsList uses config
```

---

## 1. Configuration Shape

### Button Styling Config
```typescript
// New file: src/shared/button-config.ts

export interface ButtonStyleConfig {
  // Colors & appearance
  backgroundColor?: string;    // Tailwind class or hex: 'bg-blue-600' or '#3b82f6'
  textColor?: string;          // Tailwind class or hex: 'text-white' or '#ffffff'
  hoverEffect?: string;        // 'hover:opacity-90' | 'hover:bg-blue-700' | 'hover:scale-105'
  borderRadius?: string;       // 'rounded-lg' | 'rounded-full' | 'rounded-none'
  padding?: string;            // 'px-4 py-2' | 'px-6 py-3'
  fontSize?: string;           // 'text-sm' | 'text-base' | 'text-lg'
  fontWeight?: string;         // 'font-medium' | 'font-bold'
  
  // Text & content
  label?: string;              // 'Sign In' | 'Login' | 'Log in'
  icon?: 'none' | 'arrow' | 'user'; // Icon to show with label
  
  // Border & shadow
  border?: string;             // 'border-2 border-blue-600' | 'border-none'
  shadow?: string;             // 'shadow-md' | 'shadow-none'
  
  // Width
  fullWidth?: boolean;         // true: w-full
}

export interface AccountSwitcherStyleConfig {
  // List container
  maxHeight?: string;          // 'max-h-64' | '300px'
  backgroundColor?: string;    // 'bg-white' | 'bg-gray-50'
  borderColor?: string;        // 'border-gray-200'
  shadow?: string;             // 'shadow-lg'
  
  // Account item styling
  accountItemHover?: string;   // 'hover:bg-blue-100' | 'hover:bg-gray-100'
  activeAccountBg?: string;    // 'bg-blue-50'
  textColor?: string;          // 'text-gray-900'
  
  // Account card
  showEmail?: boolean;         // Show email below name
  showAvatar?: boolean;        // Show user avatar
  avatarSize?: 'sm' | 'md' | 'lg';
  
  // Buttons in switcher
  signOutButtonConfig?: ButtonStyleConfig;
}

export interface WidgetStyleConfig {
  signInButton?: ButtonStyleConfig;
  accountSwitcher?: AccountSwitcherStyleConfig;
  
  // Override theme
  theme?: 'light' | 'dark' | 'custom';
  customTheme?: {
    primary?: string;
    secondary?: string;
    background?: string;
    text?: string;
  };
}
```

---

## 2. Update SSOProviderConfig

**File**: `src/shared/types.ts`

```typescript
export interface SSOProviderConfig {
  idpServer: string;
  clientId?: string;
  redirectUri?: string;
  scope?: string;
  enableWidget?: boolean;
  
  // NEW: Widget customization
  widgetConfig?: WidgetStyleConfig;  // ✨ NEW
  
  onSessionUpdate?: (session: SessionData | null) => void;
  onError?: (error: Error) => void;
}
```

---

## 3. Flow & Implementation

### Step 1: Define Configuration Type
- Create `src/shared/button-config.ts`
- Export from `src/shared/index.ts`
- Update `SSOProviderConfig` in `types.ts`

### Step 2: Update SSOProvider to Pass Config
**File**: `src/client/provider/SSOProvider.tsx`

```typescript
// Inside SSOProvider component
useEffect(() => {
  if (!enableWidget) return;

  const script = document.createElement('script');
  script.src = `${idpServer}/api/widget.js`;
  script.async = true;
  document.head.appendChild(script);

  const handleMessage = async (event: MessageEvent) => {
    if (!event.data?.type) return;

    // When widget is ready, send config
    if (event.data?.type === 'iframeReady') {
      console.log('[SSOProvider] Widget ready, sending config');
      if (widgetFrameRef.current) {
        widgetFrameRef.current.postMessage(
          {
            type: 'configWidget',
            config: widgetConfig,  // ✨ Pass here
          },
          idpServer
        );
      }
      return;
    }
    
    // ... rest of handlers
  };

  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, [enableWidget, idpServer, widgetConfig]); // ✨ Add widgetConfig to deps
```

### Step 3: Update WidgetClient to Receive & Apply Config
**File**: `idp-server/components/widget/widget-client.tsx`

```typescript
export default function WidgetClient({ initialAccounts, initialError }: WidgetClientProps) {
  const theme = getThemeClasses();
  const parentOriginRef = useRef<string | null>(null);
  const clientIdRef = useRef<string | null>(null);
  const [widgetConfig, setWidgetConfig] = useState<WidgetStyleConfig | undefined>();  // ✨ NEW
  
  useEffect(() => {
    // Listen for config message from parent
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'configWidget') {
        console.log('[WidgetClient] Received config:', event.data.config);
        setWidgetConfig(event.data.config);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);
  
  // Pass config to child components
  return (
    <div>
      {state.accounts.length === 0 || state.error ? (
        <SignInButton {...(widgetConfig?.signInButton || {})} />
      ) : (
        <AccountsList 
          accounts={state.accounts}
          config={widgetConfig?.accountSwitcher}
          onLogout={handleLogoutCurrent}
        />
      )}
    </div>
  );
}
```

### Step 4: Update SignInButton to Use Config
**File**: `idp-server/components/widget/sign-in-button.tsx`

```typescript
interface SignInButtonProps extends ButtonStyleConfig {
  // Existing props
}

export default function SignInButton({
  // New config props
  backgroundColor,
  textColor,
  hoverEffect,
  label = 'Sign in',
  icon,
  fullWidth,
  padding = 'px-6 py-2',
  borderRadius = 'rounded-lg',
  fontSize = 'text-sm',
  fontWeight = 'font-medium',
  // ... other stylesheet props
}: SignInButtonProps) {
  const handleSignIn = useCallback(() => {
    window.parent.postMessage({ type: 'startAuth' }, '*');
  }, []);

  const classes = `
    ${backgroundColor || 'bg-blue-600'}
    ${textColor || 'text-white'}
    ${hoverEffect || 'hover:opacity-90'}
    ${borderRadius}
    ${padding}
    ${fontSize}
    ${fontWeight}
    ${fullWidth ? 'w-full' : ''}
    transition-all duration-150
    cursor-pointer
    border-none
  `.trim().split(/\s+/).join(' ');

  return (
    <button onClick={handleSignIn} className={classes}>
      {icon === 'arrow' && '→ '}
      {icon === 'user' && '👤 '}
      {label}
    </button>
  );
}
```

### Step 5: Update AccountsList/AccountSwitcher
**File**: `idp-server/components/widget/accounts-list.tsx` (new or existing)

Apply `AccountSwitcherStyleConfig` to:
- Container styling (background, border, shadow)
- Account items (hover color, text color)
- Active account highlighting
- Sign out button styling (reuse `ButtonStyleConfig`)

---

## 4. Usage Examples

### Example 1: Minimal Config (client-d)
```typescript
// client-d/app/layout.tsx
<SSOProvider
  idpServer={process.env.NEXT_PUBLIC_IDP_SERVER!}
  clientId={process.env.NEXT_PUBLIC_CLIENT_ID!}
  redirectUri={process.env.NEXT_PUBLIC_REDIRECT_URI!}
  enableWidget={true}
  widgetConfig={{
    signInButton: {
      backgroundColor: 'bg-red-600',
      label: 'Login to Client D',
    },
  }}
>
  {children}
</SSOProvider>
```

### Example 2: Full Customization (client-c)
```typescript
// client-c/app/layout.tsx
<SSOProvider
  idpServer={process.env.NEXT_PUBLIC_IDP_SERVER!}
  clientId={process.env.NEXT_PUBLIC_CLIENT_ID!}
  redirectUri={process.env.NEXT_PUBLIC_REDIRECT_URI!}
  enableWidget={true}
  widgetConfig={{
    signInButton: {
      backgroundColor: 'bg-gradient-to-r from-purple-600 to-pink-600',
      textColor: 'text-white',
      label: 'Sign In with Pratham',
      icon: 'arrow',
      padding: 'px-8 py-3',
      fontSize: 'text-lg',
      fontWeight: 'font-bold',
      hoverEffect: 'hover:shadow-lg hover:scale-105',
      borderRadius: 'rounded-full',
      fullWidth: false,
    },
    accountSwitcher: {
      backgroundColor: 'bg-white',
      shadow: 'shadow-xl',
      accountItemHover: 'hover:bg-purple-50',
      activeAccountBg: 'bg-purple-100',
      showEmail: true,
      showAvatar: true,
      avatarSize: 'md',
      signOutButtonConfig: {
        backgroundColor: 'bg-red-50',
        textColor: 'text-red-600',
        label: 'Logout',
        fontSize: 'text-sm',
      },
    },
    theme: 'custom',
    customTheme: {
      primary: '#a855f7',
      secondary: '#ec4899',
    },
  }}
>
  {children}
</SSOProvider>
```

### Example 3: Tailwind-Only Config
```typescript
widgetConfig={{
  signInButton: {
    backgroundColor: '#3b82f6',      // Can use hex instead of Tailwind
    textColor: '#ffffff',
    hoverEffect: 'hover:opacity-80',
  },
}}
```

---

## 5. Implementation Checklist

- [ ] **Step 1**: Create `src/shared/button-config.ts` with all interfaces
- [ ] **Step 2**: Update `src/shared/types.ts` - add `widgetConfig` to `SSOProviderConfig`
- [ ] **Step 3**: Update `SSOProvider.tsx` - send config on `iframeReady` message
- [ ] **Step 4**: Update `widget-client.tsx` - listen for `configWidget` message
- [ ] **Step 5**: Update `sign-in-button.tsx` - accept and apply config props
- [ ] **Step 6**: Update `accounts-list.tsx` - accept and apply `AccountSwitcherStyleConfig`
- [ ] **Step 7**: Create example configs in README or separate file
- [ ] **Step 8**: Test with client-c and client-d

---

## 6. Benefits

✅ **Domains have full control** over button appearance  
✅ **Type-safe** with TypeScript interfaces  
✅ **Flexible** - supports Tailwind classes, CSS variables, or hex colors  
✅ **Backward compatible** - optional config, defaults to current styling  
✅ **Composable** - separate configs for sign-in vs account switcher  
✅ **Reusable** - components can use ButtonStyleConfig everywhere  

---

## 7. Open Questions / Considerations

1. **Tailwind vs CSS variables**: Should we support CSS-in-JS or stick to Tailwind classes?
   - Current plan: Accept both (classes like `bg-blue-600` AND hex like `#3025f3`)

2. **Font customization**: Should fonts be customizable or use domain's global font?
   - Current plan: Optional `fontSize` and `fontWeight` in config

3. **Icon support**: Simple icons (arrow, user) or full custom icon URL support?
   - Current plan: Predefined icons first, can extend later

4. **Responsive behavior**: Should button be `fullWidth` on mobile only?
   - Current plan: Fixed in phase 2, use CSS media queries

---

## Next Steps

1. ✅ Review this plan with user
2. 🔄 Implement Step 1-3 (config types & SSOProvider)
3. 🔄 Implement Step 4-6 (components)
4. 🔄 Test & iterate
5. 📝 Update SDK docs & examples
