/**
 * Widget Script Endpoint
 * Serves the injectable widget code that clients embed with:
 * <script src="https://idp.com/widget.js"></script>
 */

import { AVATAR_CHAR_COLOR_MAP } from '@/lib/avatar-colors';

export async function GET(request: Request) {
  const idpOrigin = process.env.NEXT_PUBLIC_IDP_URL || new URL(request.url).origin;
  const widgetUrl = `${idpOrigin}/widget/account-switcher`;
  const avatarColorMapJson = JSON.stringify(AVATAR_CHAR_COLOR_MAP);

  const widgetScript = `
(function(window) {
  "use strict";

  // Prevent duplicate loads
  if (window.__accountSwitcherLoaded) {
    console.log("[AccountSwitcher] Already loaded, skipping");
    return;
  }
  window.__accountSwitcherLoaded = true;

  const IDP_ORIGIN = '${idpOrigin}';
  const WIDGET_URL = '${widgetUrl}';
  const AVATAR_CHAR_COLOR_MAP = ${avatarColorMapJson};
  let iframeModal = null;
  let iframe = null;
  let parentOrigin = null;
  let isPopoverOpen = false;
  let button = null;
  let buttonContainer = null;

  // Integrated vs Floating mode detection (once at init)
  let isIntegratedMode = false;
  let mountPoint = null;

  // Cross-site session transport: cached sessionId from /api/me
  let cachedSessionId = null;
  let iframeIsReady = false;

  // Cached account state from iframe (source of truth)
  let currentAccountState = {
    hasActiveSession: false,
    hasRememberedAccounts: false,
    activeAccountPreview: null, // { name, email, avatarUrl }
    dataLoaded: false
  };

  // Sign-in button config (read from mount point data-* attributes)
  let signInConfig = {
    text: 'Sign in',
    style: ''  // Full custom CSS string from data-signin-style
  };

  // Detect parent origin from referrer or current location
  function getParentOrigin() {
    try {
      return window.location.origin;
    } catch (e) {
      return null;
    }
  }

  // Detect mount point ONCE during initialization
  // Also reads data-* attributes for sign-in button customization
  function detectMountPoint() {
    mountPoint = document.getElementById('__account_switcher_mount_point');
    if (mountPoint) {
      isIntegratedMode = true;
      console.log('[AccountSwitcher] Mount point detected - using integrated mode');

      // Read sign-in button customization from data-* attributes
      var text = mountPoint.getAttribute('data-signin-text');
      var customStyle = mountPoint.getAttribute('data-signin-style');
      if (text) signInConfig.text = text;
      if (customStyle) signInConfig.style = customStyle;
      console.log('[AccountSwitcher] Sign-in config:', signInConfig);
    } else {
      isIntegratedMode = false;
      console.log('[AccountSwitcher] No mount point - using floating mode');
    }
  }

  // Ensure consistent box-sizing across all widget elements
  function injectStyles() {
    if (document.getElementById('__account_switcher_styles')) {
      return; // Already injected
    }
    
    // Add prefetch link for the account-switcher page (speeds up iframe loading)
    const prefetchLink = document.createElement('link');
    prefetchLink.rel = 'prefetch';
    prefetchLink.href = WIDGET_URL;
    prefetchLink.as = 'document';
    document.head.appendChild(prefetchLink);
    
    const style = document.createElement('style');
    style.id = '__account_switcher_styles';
    
    // Generate CSS based on mode (integrated vs floating)
    const buttonSize = isIntegratedMode ? '40px' : '44px';
    const buttonContainerCSS = isIntegratedMode
      ? "position: relative; display: inline-flex; align-items: center; justify-content: center; z-index: auto;"
      : "position: fixed; top: 20px; right: 20px; z-index: 10001;";
    
    const popoverCSS = isIntegratedMode
      ? "position: fixed; width: 420px; max-width: 95vw; z-index: 50000;"
      : "position: fixed; top: 78px; right: 20px; width: 420px; max-width: calc(100vw - 40px); z-index: 10000;";
    
    style.textContent = \`
      #__account_switcher_button_container,
      #__account_switcher_popover,
      #__account_switcher_iframe {
        box-sizing: border-box;
      }
      
      #__account_switcher_popover {
        \${popoverCSS}
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        padding: 0;
        margin: 0;
        border: none;
        overflow: hidden;
        outline: none;
      }
      
      #__account_switcher_popover.hidden {
        visibility: hidden !important;
        pointer-events: none !important;
        opacity: 0 !important;
      }
      
      #__account_switcher_popover.visible {
        visibility: visible !important;
        pointer-events: auto !important;
        opacity: 1 !important;
      }
      
      #__account_switcher_iframe {
        display: block;
        width: 100%;
        height: auto;
        max-height: 80vh;
        border: none;
        margin: 0;
        padding: 0;
        background: white;
      }
      
      #__account_switcher_button_container {
        \${buttonContainerCSS}
      }
      
      #__account_switcher_button {
        width: \${buttonSize};
        height: \${buttonSize};
      }
      
      @keyframes __asSkeleton {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 1; }
      }

      /* Mobile: switch popover to bottom sheet for narrow viewports */
      @media (max-width: 480px) {
        #__account_switcher_popover {
          top: auto !important;
          right: 0 !important;
          left: 0 !important;
          bottom: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          border-radius: 16px 16px 0 0 !important;
          box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15) !important;
        }
        #__account_switcher_iframe {
          max-height: 85vh;
        }
      }
    \`;
    document.head.appendChild(style);
  }

  // Global message listener (single listener for all widget communication)
  window.addEventListener('message', function(event) {
    // Strict origin validation
    if (event.origin !== IDP_ORIGIN) {
      console.warn('[AccountSwitcher] Blocked message from untrusted origin:', event.origin);
      return;
    }

    // Handle: closeAccountSwitcher
    if (event.data.type === 'closeAccountSwitcher') {
      closeAccountSwitcher();
      return;
    }

    // Handle: ACCOUNT_SWITCHED
    if (event.data.type === 'ACCOUNT_SWITCHED') {
      console.log('[AccountSwitcher] Account switched:', event.data.jarIndex !== undefined ? 'jar index ' + event.data.jarIndex : 'no jar index');
      
      // Only handle redirects if we're on the IDP domain
      // On client apps, the client's widget-manager handles ACCOUNT_SWITCHED
      const isOnIdpDomain = window.location.origin === IDP_ORIGIN;
      
      if (isOnIdpDomain && event.data.jarIndex !== undefined) {
        // On IDP page: redirect to the account's jar index page, preserving current path
        // Example: /u/0/personal-info → /u/1/personal-info when switching from index 0 to 1
        var currentPath = window.location.pathname;
        var pathMatch = currentPath.match(/^\\/u\\/(\\d+)(\\/.*)?$/);
        
        var newPath;
        if (pathMatch) {
          // User is on /u/{oldIndex}/... or /u/{oldIndex}
          // Replace the index with the new one, keep remaining path
          var oldIndex = pathMatch[1];
          var remainingPath = pathMatch[2] || '';
          newPath = '/u/' + event.data.jarIndex + remainingPath;
        } else {
          // Not on a /u/{index} path, redirect to new account's dashboard
          newPath = '/u/' + event.data.jarIndex;
        }
        
        // Preserve query string and hash
        var fullUrl = IDP_ORIGIN + newPath + window.location.search + window.location.hash;
        
        console.log('[AccountSwitcher] On IDP domain, navigating to account page:', fullUrl);
        setTimeout(function() {
          window.location.href = fullUrl;
        }, 100);
      } else if (isOnIdpDomain && event.data.jarIndex === undefined) {
        // On IDP page but no jar index: trigger silent login
        triggerSilentLogin();
      } else {
        // On client app: widget-manager handles ACCOUNT_SWITCHED by triggering OAuth re-auth
        // which causes a full page redirect — no need to update button here (page will reload)
        console.log('[AccountSwitcher] On client domain, delegating to client widget-manager');
      }
      closeAccountSwitcher();
      return;
    }

    // Handle: logoutApp (client-only logout)
    if (event.data.type === 'logoutApp') {
      var logoutUrl = event.data.logoutUrl;
      console.log('[AccountSwitcher] Logging out of app, redirecting to:', logoutUrl);
      // Reset button to sign-in immediately
      currentAccountState = { hasActiveSession: false, activeAccountPreview: null, dataLoaded: true };
      updateButtonAppearance();
      closeAccountSwitcher();
      setTimeout(function() {
        window.location.href = logoutUrl;
      }, 100);
      return;
    }

    // Handle: logoutGlobal (full logout)
    if (event.data.type === 'logoutGlobal') {
      console.log('[AccountSwitcher] Global logout initiated, redirecting to IDP');
      // Reset button to sign-in immediately
      currentAccountState = { hasActiveSession: false, activeAccountPreview: null, dataLoaded: true };
      updateButtonAppearance();
      closeAccountSwitcher();
      setTimeout(function() {
        window.location.href = IDP_ORIGIN + '/login';
      }, 100);
      return;
    }

    // Handle: sessionUpdate (account switch or auth change) — refresh button via /api/me
    if (event.data.type === 'sessionUpdate') {
      console.log('[AccountSwitcher] Session updated, refreshing button state');
      var isOnClient = window.location.origin !== IDP_ORIGIN;
      if (isOnClient) {
        // Delay: page.tsx also calls /api/me on sessionUpdate. Two concurrent calls
        // can race on CSRF token rotation, causing one to fail.
        // Let page.tsx's call complete first, then refresh the button.
        setTimeout(function() {
          fetch('/api/me', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          })
            .then(function(r) { return r.json(); })
            .then(function(data) {
              if (data.authenticated && data.user) {
                currentAccountState = {
                  hasActiveSession: true,
                  hasRememberedAccounts: true,
                  activeAccountPreview: {
                    name: data.user.name || '?',
                    email: data.user.email || '',
                    avatarUrl: data.user.profile_image_url || null
                  },
                  dataLoaded: true
                };
                // Re-send sessionId to iframe (session may have changed)
                if (data.sessionId) {
                  cachedSessionId = data.sessionId;
                  if (iframe && iframe.contentWindow) {
                    iframe.contentWindow.postMessage(
                      { type: 'SSO_SESSION_UPDATE', sessionId: data.sessionId, timestamp: Date.now() },
                      IDP_ORIGIN
                    );
                  }
                }
              } else {
                // Preserve remembered-account state on transient /api/me misses.
                // This prevents false sign-in redirects right after a successful switch.
                currentAccountState = {
                  hasActiveSession: false,
                  hasRememberedAccounts: currentAccountState.hasRememberedAccounts !== false,
                  activeAccountPreview: currentAccountState.activeAccountPreview || null,
                  dataLoaded: true
                };
              }
              updateButtonAppearance();
            })
            .catch(function(err) {
              console.log('[AccountSwitcher] sessionUpdate /api/me failed:', err);
            });
        }, 800);
      }
      // Don't return — let other listeners (client page.tsx) also handle this
    }

    // Handle: accountStateChanged (iframe reports session state for button rendering)
    if (event.data.type === 'accountStateChanged') {
      currentAccountState = {
        hasActiveSession: !!event.data.hasActiveSession,
        hasRememberedAccounts: !!event.data.hasRememberedAccounts,
        activeAccountPreview: event.data.activeAccountPreview || null,
        dataLoaded: !!event.data.dataLoaded
      };
      console.log('[AccountSwitcher] Account state updated:', {
        hasActiveSession: currentAccountState.hasActiveSession,
        hasRememberedAccounts: currentAccountState.hasRememberedAccounts,
        name: currentAccountState.activeAccountPreview?.name || null,
        dataLoaded: currentAccountState.dataLoaded
      });
      updateButtonAppearance();
      return;
    }

    // Handle: iframeReady (iframe has loaded and rendered content)
    if (event.data.type === 'iframeReady') {
      console.log('[AccountSwitcher] Iframe ready');
      iframeIsReady = true;
      // If we already have a sessionId (from earlier /api/me), send it now
      if (cachedSessionId) {
        sendSessionToIframe(cachedSessionId);
      }
      return;
    }

    // Handle: contentHeightChanged (iframe content height changed)
    if (event.data.type === 'contentHeightChanged') {
      var newHeight = event.data.height;
      if (iframe && newHeight > 0) {
        var maxHeight = window.innerHeight * 0.8;
        iframe.style.height = Math.min(newHeight, maxHeight) + 'px';
        console.log('[AccountSwitcher] Iframe height updated to:', Math.min(newHeight, maxHeight));
      }
      return;
    }
  });

  // Handle button click — split behavior based on session state
  function handleButtonClick() {
    if (!currentAccountState.hasActiveSession && !currentAccountState.hasRememberedAccounts) {
      // No active session: directly initiate login (no modal)
      console.log('[AccountSwitcher] No active session — initiating sign-in flow');
      var isOnIdpDomain = window.location.origin === IDP_ORIGIN;
      if (isOnIdpDomain) {
        // On IDP domain: navigate directly to login
        window.location.href = IDP_ORIGIN + '/login';
      } else {
        // On client domain: directly call the client's auth start endpoint
        // widget.js runs in the client's window context, so fetch goes to client's own API
        fetch('/api/auth/start?prompt=login', { credentials: 'include' })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (data.url) {
              window.location.href = data.url;
            } else {
              console.error('[AccountSwitcher] No auth URL returned');
            }
          })
          .catch(function(err) {
            console.error('[AccountSwitcher] Auth start failed:', err);
          });
      }
      return;
    }
    // Has active session: toggle the account switcher popover
    openAccountSwitcher();
  }

  function openAccountSwitcher() {
    // Ensure iframe exists before trying to open
    if (!iframeModal || !iframe) {
      preloadIframe();
      if (!iframeModal) {
        console.error('[AccountSwitcher] Failed to create iframe');
        return;
      }
    }

    isPopoverOpen = !isPopoverOpen;
    
    if (isPopoverOpen) {
      iframeModal.classList.remove('hidden');
      iframeModal.classList.add('visible');
      
      // In integrated mode, position popover below the button
      if (isIntegratedMode && button) {
        const buttonRect = button.getBoundingClientRect();
        const popoverTop = buttonRect.bottom + 12; // 12px gap below button
        const popoverRight = window.innerWidth - buttonRect.right; // Align right edge with button
        
        iframeModal.style.top = popoverTop + 'px';
        iframeModal.style.right = popoverRight + 'px';
        console.log('[AccountSwitcher] Popover positioned at top:', popoverTop, 'right:', popoverRight);
      }
      
      console.log('[AccountSwitcher] Popover opened');
    } else {
      iframeModal.classList.add('hidden');
      iframeModal.classList.remove('visible');
      console.log('[AccountSwitcher] Popover closed');
    }
  }

  function closeAccountSwitcher() {
    isPopoverOpen = false;
    if (iframeModal) {
      iframeModal.classList.add('hidden');
      iframeModal.classList.remove('visible');
    }
  }

  // Pre-create and load iframe hidden (speeds up opening on first click)
  // Runs during initialization so iframe loads in background
  function preloadIframe() {
    if (iframeModal || iframe) {
      return; // Already created
    }

    console.log('[AccountSwitcher] Pre-creating iframe for faster loading...');

    // Create popover container (hidden initially)
    const popover = document.createElement('div');
    popover.id = '__account_switcher_popover';
    popover.className = 'hidden';
    document.body.appendChild(popover);
    iframeModal = popover;

    // Create iframe
    iframe = document.createElement('iframe');
    iframe.id = '__account_switcher_iframe';

    // Build iframe URL with parentOrigin
    const parentOriginParam = encodeURIComponent(getParentOrigin() || 'http://localhost:3003');
    let iframeUrl = WIDGET_URL + '?parentOrigin=' + parentOriginParam;

    // NEW: Add client_id if available (from window object)
    // Allows per-domain active account isolation
    const clientId = window.__CLIENT_ID || window.CLIENT_ID;
    if (clientId) {
      iframeUrl += '&client_id=' + encodeURIComponent(clientId);
      console.log('[AccountSwitcher] Adding client_id to iframe URL:', clientId);
    }

    iframe.src = iframeUrl;

    iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-top-navigation');
    iframe.setAttribute('allow', 'cross-origin-isolated');
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');

    // Handle iframe load/error events
    iframe.addEventListener('load', function() {
      console.log('[AccountSwitcher] Iframe loaded successfully');
    });

    iframe.addEventListener('error', function() {
      console.error('[AccountSwitcher] Failed to load iframe from:', iframeUrl);
      popover.innerHTML = '<div style="padding: 20px; text-align: center; color: #666; font-size: 14px;">Failed to load account switcher. Please refresh.</div>';
    });

    popover.appendChild(iframe);
    console.log('[AccountSwitcher] Iframe pre-created with src:', iframeUrl);
  }

  // Set up close handlers (click outside, Escape key)
  function setupCloseHandlers() {
    // Close popover when clicking outside
    document.addEventListener('mousedown', function(e) {
      if (isPopoverOpen && iframeModal && !iframeModal.contains(e.target) && buttonContainer && !buttonContainer.contains(e.target)) {
        closeAccountSwitcher();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && isPopoverOpen) {
        closeAccountSwitcher();
      }
    });
  }

  // Reposition popover when page scrolls/resizes (keep it anchored to button)
  function repositionPopover() {
    if (!isPopoverOpen || !isIntegratedMode || !iframeModal || !button) {
      return;
    }

    const buttonRect = button.getBoundingClientRect();
    const popoverTop = buttonRect.bottom + 12; // 12px gap below button
    const popoverRight = window.innerWidth - buttonRect.right; // Align right edge with button

    iframeModal.style.top = popoverTop + 'px';
    iframeModal.style.right = popoverRight + 'px';
  }

  function triggerSilentLogin() {
    // Fetch silent login endpoint on client
    const clientOrigin = getParentOrigin();
    const silentLoginUrl = clientOrigin + '/api/auth/silent-login';

    console.log('[AccountSwitcher] Fetching silent login from:', silentLoginUrl);

    fetch(silentLoginUrl, {
      method: 'GET',
      credentials: 'include',
      redirect: 'follow',
    })
      .then(function(res) {
        if (res.ok) {
          console.log('[AccountSwitcher] Silent login successful');
          // Reload page to reflect new session
          setTimeout(function() {
            window.location.reload();
          }, 100);
        } else {
          console.log('[AccountSwitcher] Silent login response status:', res.status);
        }
      })
      .catch(function(err) {
        console.error('[AccountSwitcher] Silent login failed:', err);
      });
  }

  // Send sessionId to iframe via postMessage (cross-site session transport)
  function sendSessionToIframe(sessionId) {
    if (!sessionId || !iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage(
      { type: 'SSO_SESSION', sessionId: sessionId, timestamp: Date.now() },
      IDP_ORIGIN
    );
    console.log('[AccountSwitcher] Sent sessionId to iframe');
  }

  // Fetch session from client's /api/me and send to iframe
  // Called immediately on client domains (not waiting for fallback timeout)
  function fetchAndSendSession() {
    fetch('/api/me', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.authenticated && data.sessionId) {
          cachedSessionId = data.sessionId;
          sendSessionToIframe(cachedSessionId);

          // Also update button state
          if (!currentAccountState.dataLoaded) {
            currentAccountState = {
              hasActiveSession: true,
              hasRememberedAccounts: true,
              activeAccountPreview: {
                name: data.user?.name || data.account?.name || '?',
                email: data.user?.email || data.account?.email || '',
                avatarUrl: data.user?.profile_image_url || null
              },
              dataLoaded: true
            };
            updateButtonAppearance();
          }
        } else if (data.authenticated && data.user) {
          // Authenticated but no sessionId in response (old SDK version)
          if (!currentAccountState.dataLoaded) {
            currentAccountState = {
              hasActiveSession: true,
              hasRememberedAccounts: true,
              activeAccountPreview: {
                name: data.user.name || '?',
                email: data.user.email || '',
                avatarUrl: data.user.profile_image_url || null
              },
              dataLoaded: true
            };
            updateButtonAppearance();
          }
        } else {
          // Not authenticated
          if (!currentAccountState.dataLoaded) {
            return resolveRememberedAccountsFallback();
          }
        }
      })
      .catch(function(err) {
        console.log('[AccountSwitcher] fetchAndSendSession failed:', err);
        if (!currentAccountState.dataLoaded) {
          resolveRememberedAccountsFallback().catch(function() {
            if (!currentAccountState.dataLoaded) {
              currentAccountState = { hasActiveSession: false, hasRememberedAccounts: false, activeAccountPreview: null, dataLoaded: true };
              updateButtonAppearance();
            }
          });
        }
      });
  }

  // Update button appearance based on cached account state
  // Called whenever accountStateChanged arrives from iframe
  // Only updates inner content — never recreates the button element
  function updateButtonAppearance() {
    if (!button) return;

    const state = currentAccountState;
    const buttonSize = isIntegratedMode ? '40px' : '44px';

    // === SKELETON MODE: data not yet loaded — show pulsing placeholder ===
    if (!state.dataLoaded) {
      button.setAttribute('aria-label', 'Loading...');
      button.title = '';
      button.innerHTML = '';
      button.disabled = true;
      button.style.cssText = [
        'width: ' + buttonSize,
        'height: ' + buttonSize,
        'border-radius: 50%',
        'background: #e0e0e0',
        'border: 2px solid #dadce0',
        'cursor: default',
        'display: flex',
        'align-items: center',
        'justify-content: center',
        'padding: 0',
        'outline: none',
        'box-shadow: none',
        'animation: __asSkeleton 1.5s ease-in-out infinite',
      ].join('; ') + ';';
      return;
    }

    // Re-enable button once data is loaded
    button.disabled = false;

    if ((state.hasActiveSession || state.hasRememberedAccounts) && state.activeAccountPreview) {
      // === AVATAR MODE: show the primary account preview when available ===
      const preview = state.activeAccountPreview;
      const allSignedOut = state.hasRememberedAccounts && !state.hasActiveSession;
      const titlePrefix = state.hasActiveSession ? 'Account: ' : 'Remembered account: ';
      button.setAttribute('aria-label', allSignedOut ? 'Account selector' : titlePrefix + preview.name);
      button.title = allSignedOut ? 'Choose an account' : preview.name + ' (' + preview.email + ')';
      button.innerHTML = '';

      // Full style reset (clears skeleton animation and sign-in styles)
      button.style.cssText = [
        'width: ' + buttonSize,
        'height: ' + buttonSize,
        'border-radius: 50%',
        'border: 2px solid #dadce0',
        'cursor: pointer',
        'display: flex',
        'align-items: center',
        'justify-content: center',
        'padding: 0',
        'outline: none',
        'box-shadow: none',
        'overflow: hidden',
        'background: transparent',
      ].join('; ') + ';';

      if (allSignedOut) {
        // Show generic user icon when all accounts are signed out
        button.style.background = '#f0f0f0';
        var userIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        userIcon.setAttribute('viewBox', '0 0 24 24');
        userIcon.setAttribute('fill', 'none');
        userIcon.setAttribute('stroke', '#5f6368');
        userIcon.setAttribute('stroke-width', '2');
        userIcon.setAttribute('stroke-linecap', 'round');
        userIcon.setAttribute('stroke-linejoin', 'round');
        userIcon.style.cssText = 'width: 18px; height: 18px; flex-shrink: 0; display: block; color: #5f6368;';
        
        // Create path element with proper SVG namespace
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2');
        path.setAttribute('stroke', '#5f6368');
        userIcon.appendChild(path);
        
        var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '12');
        circle.setAttribute('cy', '7');
        circle.setAttribute('r', '4');
        circle.setAttribute('stroke', '#000');
        userIcon.appendChild(circle);
        
        button.appendChild(userIcon);
        console.log('[AccountSwitcher] Button updated to generic user icon (all accounts signed out)');
      } else if (preview.avatarUrl) {
        // Image avatar
        var img = document.createElement('img');
        img.src = preview.avatarUrl;
        img.alt = preview.name;
        img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block;';
        img.onerror = function() {
          // Fallback to initial if image fails
          button.innerHTML = '';
          renderInitialAvatar(button, preview.name);
        };
        button.appendChild(img);
        console.log('[AccountSwitcher] Button updated to avatar:', preview.name, {
          hasActiveSession: state.hasActiveSession,
          hasRememberedAccounts: state.hasRememberedAccounts,
        });
      } else {
        // Gradient initial avatar
        renderInitialAvatar(button, preview.name);
        console.log('[AccountSwitcher] Button updated to avatar:', preview.name, {
          hasActiveSession: state.hasActiveSession,
          hasRememberedAccounts: state.hasRememberedAccounts,
        });
      }
    } else {
      // === SIGN-IN MODE: show sign-in button ===
      button.setAttribute('aria-label', signInConfig.text);
      button.title = signInConfig.text;
      button.innerHTML = '';

      // Apply default sign-in styles, then overlay custom styles
      button.style.cssText = [
        'border-radius: 20px',
        'width: auto',
        'height: ' + (isIntegratedMode ? '36px' : '40px'),
        'padding: 0 16px',
        'background: #1a73e8',
        'overflow: visible',
        'display: flex',
        'align-items: center',
        'justify-content: center',
        'cursor: pointer',
        'border: none',
        'box-shadow: none',
        'transition: none',
        'outline: none',
        signInConfig.style  // Custom CSS overrides go last
      ].filter(Boolean).join('; ') + ';';

      var label = document.createElement('span');
      label.textContent = signInConfig.text;
      label.style.cssText = 'font-size: 14px; font-weight: 500; color: inherit; white-space: nowrap; line-height: 1;';
      button.appendChild(label);

      // Set text color default if not overridden by custom style
      if (!signInConfig.style || signInConfig.style.indexOf('color') === -1) {
        button.style.color = 'white';
      }
      console.log('[AccountSwitcher] Button updated to sign-in');
    }
  }

  function resolveRememberedAccountsFallback() {
    return fetch(IDP_ORIGIN + '/api/widget/accounts', {
      credentials: 'include'
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (currentAccountState.dataLoaded) return;

        if (data && Array.isArray(data.accounts) && data.accounts.length > 0) {
          var remembered = data.accounts[0];
          currentAccountState = {
            hasActiveSession: false,
            hasRememberedAccounts: true,
            activeAccountPreview: {
              name: remembered.name || '?',
              email: remembered.email || '',
              avatarUrl: remembered.profile_image_url || null
            },
            dataLoaded: true
          };
          console.log('[AccountSwitcher] Fallback: remembered accounts found, showing avatar');
        } else {
          currentAccountState = {
            hasActiveSession: false,
            hasRememberedAccounts: false,
            activeAccountPreview: null,
            dataLoaded: true
          };
          console.log('[AccountSwitcher] Fallback: no remembered accounts');
        }

        updateButtonAppearance();
      });
  }

  // Render a solid-color circle with the user's initial inside the button
  // NOTE: Does NOT set width/height — caller's cssText already sets buttonSize
  function getAvatarColor(name) {
    var firstChar = ((name || '').trim().charAt(0) || '').toUpperCase();
    return AVATAR_CHAR_COLOR_MAP[firstChar] || '#475569';
  }

  function renderInitialAvatar(btn, name) {
    btn.style.background = getAvatarColor(name);
    var initial = document.createElement('span');
    initial.textContent = (name || '?').charAt(0).toUpperCase();
    initial.style.cssText = 'font-size: 18px; font-weight: 600; color: white; line-height: 1; user-select: none;';
    btn.appendChild(initial);
  }

  // Create avatar button - appended to mount point (integrated) or body (floating)
  function createButton() {
    const container = document.createElement('div');
    container.id = '__account_switcher_button_container';
    
    const btn = document.createElement('button');
    btn.id = '__account_switcher_button';
    btn.setAttribute('aria-label', 'Sign in');
    btn.title = 'Sign in';
    
    const buttonSize = isIntegratedMode ? '40px' : '44px';
    
    // Start in skeleton state — no content, pulsing gray circle
    // updateButtonAppearance() will immediately confirm this, then resolve to final state
    btn.style.cssText = [
      'width: ' + buttonSize,
      'height: ' + buttonSize,
      'border-radius: 50%',
      'background: #e0e0e0',
      'border: 2px solid #dadce0',
      'cursor: default',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'padding: 0',
      'outline: none',
      'box-shadow: none',
      'animation: __asSkeleton 1.5s ease-in-out infinite',
    ].join('; ') + ';';
    btn.disabled = true;

    // Click handler — split between sign-in and modal
    btn.addEventListener('click', handleButtonClick);

    container.appendChild(btn);
    
    // Append to mount point (integrated) or body (floating)
    if (isIntegratedMode && mountPoint) {
      mountPoint.appendChild(container);
      console.log('[AccountSwitcher] Button appended to mount point');
    } else {
      document.body.appendChild(container);
      console.log('[AccountSwitcher] Button appended to body (floating)');
    }
    
    button = btn;
    buttonContainer = container;
    
    return { button: btn, buttonContainer: container };
  }

  // Initialize widget on page load (detect mode, inject CSS, create button)
  function initializeWidget() {
    // Detect mount point FIRST (determines mode)
    detectMountPoint();
    
    // Inject CSS appropriate for the detected mode
    injectStyles();
    
    // Create button and container
    createButton();
    
    // Set initial button appearance (sign-in by default, updates when iframe reports state)
    updateButtonAppearance();
    
    // Pre-create iframe hidden (loads in background for instant opening on click)
    preloadIframe();
    
    // Set up close handlers (click outside, Escape key)
    setupCloseHandlers();
    
    // In integrated mode: reposition popover on scroll/resize to keep it anchored to button
    if (isIntegratedMode) {
      window.addEventListener('scroll', repositionPopover, true); // Use capture phase
      window.addEventListener('resize', repositionPopover);
    }
    
    // Session resolution strategy:
    // IDP domain: iframe has first-party cookies — wait for iframe to report state.
    // Client domain: third-party cookies blocked — immediately fetch /api/me to get
    //   sessionId and send it to iframe via postMessage.
    var isOnIdp = window.location.origin === IDP_ORIGIN;

    if (!isOnIdp) {
      // Client domain: fetch session immediately and send to iframe
      console.log('[AccountSwitcher] Client domain — fetching session via /api/me');
      fetchAndSendSession();
    }

    // Fallback timeout: resolve skeleton if nothing reported in time
    var fallbackDelay = isOnIdp ? 3000 : 2000;
    setTimeout(function() {
      if (currentAccountState.dataLoaded) return;
      if (isOnIdp) {
        console.log('[AccountSwitcher] Iframe did not report state — defaulting to sign-in');
        currentAccountState = { hasActiveSession: false, hasRememberedAccounts: false, activeAccountPreview: null, dataLoaded: true };
        updateButtonAppearance();
      }
      // Client fallback already handled by fetchAndSendSession()
    }, fallbackDelay);
    
    console.log('[AccountSwitcher] Widget loaded successfully');
    console.log('[AccountSwitcher] Mode:', isIntegratedMode ? 'INTEGRATED' : 'FLOATING');
    console.log('[AccountSwitcher] IDP Origin:', IDP_ORIGIN);
    console.log('[AccountSwitcher] Widget URL:', WIDGET_URL);
    console.log('[AccountSwitcher] Iframe pre-created and loading in background');
    console.log('[AccountSwitcher] API available at window.__accountSwitcher');
  }

  // Start initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWidget);
  } else {
    // DOM is already ready
    setTimeout(initializeWidget, 0);
  }

  // Optional: Add configuration API
  window.__accountSwitcher = {
    open: openAccountSwitcher,
    close: closeAccountSwitcher,
    configure: function(config) {
      if (config.buttonText && button) {
        button.textContent = config.buttonText;
      }
      if (config.buttonPosition && buttonContainer) {
        const pos = config.buttonPosition;
        buttonContainer.style.top = pos.top || buttonContainer.style.top;
        buttonContainer.style.right = pos.right || buttonContainer.style.right;
        buttonContainer.style.bottom = pos.bottom || 'auto';
        buttonContainer.style.left = pos.left || 'auto';
      }
      if (config.buttonStyle && button) {
        Object.assign(button.style, config.buttonStyle);
      }
    }
  };
})(window);
  `.trim();

  return new Response(widgetScript, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  });
}