/**
 * Widget runtime entry. Composes the pure leaf modules (styles, mount-detect,
 * button renderers) with the controller logic (message routing, popover,
 * session resolution) that still lives here.
 *
 * Bundled by tsup into dist/widget.built.js; /api/widget.js replaces the
 * __IDP_ORIGIN__ / __WIDGET_URL__ / __AVATAR_COLOR_MAP_JSON__ tokens at request time.
 */

import { renderAvatar, renderSignIn, renderSkeleton } from './button/render';
import { AVATAR_CHAR_COLOR_MAP, IDP_ORIGIN, WIDGET_URL } from './config';
import { detectMountPoint } from './mount-detect';
import { injectStyles } from './styles';
import type {
  AccountState,
  AccountsResponse,
  ConfigureOptions,
  IncomingMessage,
  MeResponse,
  SignInConfig,
  WidgetMode,
} from './types';

(function(window: Window) {
  "use strict";

  // Prevent duplicate loads
  if (window.__accountSwitcherLoaded) {
    console.log("[AccountSwitcher] Already loaded, skipping");
    return;
  }
  window.__accountSwitcherLoaded = true;

  let iframeModal: HTMLDivElement | null = null;
  let iframe: HTMLIFrameElement | null = null;
  let isPopoverOpen = false;
  let button: HTMLButtonElement | null = null;
  let buttonContainer: HTMLDivElement | null = null;

  // Integrated vs Floating mode detection (once at init)
  let isIntegratedMode = false;
  let mountPoint: HTMLElement | null = null;

  // Cross-site session transport: cached sessionId from /api/me
  let cachedSessionId: string | null = null;
  let iframeIsReady = false;

  // Cached account state from iframe (source of truth)
  let currentAccountState: AccountState = {
    hasActiveSession: false,
    hasRememberedAccounts: false,
    activeAccountPreview: null,
    dataLoaded: false,
  };

  // Sign-in button config (populated by detectMountPoint from data-* attributes)
  const signInConfig: SignInConfig = {
    text: 'Sign in',
    style: '',
  };

  function currentMode(): WidgetMode {
    return isIntegratedMode ? 'integrated' : 'floating';
  }

  function getParentOrigin(): string | null {
    try {
      return window.location.origin;
    } catch (e) {
      return null;
    }
  }

  // Global message listener (single listener for all widget communication)
  window.addEventListener('message', function(event: MessageEvent<IncomingMessage>) {
    // Strict origin validation
    if (event.origin !== IDP_ORIGIN) {
      console.warn('[AccountSwitcher] Blocked message from untrusted origin:', event.origin);
      return;
    }

    const msg = event.data;

    // Handle: closeAccountSwitcher
    if (msg.type === 'closeAccountSwitcher') {
      closeAccountSwitcher();
      return;
    }

    // Handle: ACCOUNT_SWITCHED
    if (msg.type === 'ACCOUNT_SWITCHED') {
      console.log('[AccountSwitcher] Account switched:', msg.jarIndex !== undefined ? 'jar index ' + msg.jarIndex : 'no jar index');

      // Only handle redirects if we're on the IDP domain
      // On client apps, the client's widget-manager handles ACCOUNT_SWITCHED
      const isOnIdpDomain = window.location.origin === IDP_ORIGIN;

      if (isOnIdpDomain && msg.jarIndex !== undefined) {
        // On IDP page: redirect to the account's jar index page, preserving current path
        // Example: /u/0/personal-info → /u/1/personal-info when switching from index 0 to 1
        const currentPath = window.location.pathname;
        const pathMatch = currentPath.match(/^\/u\/(\d+)(\/.*)?$/);

        let newPath: string;
        if (pathMatch) {
          const remainingPath = pathMatch[2] || '';
          newPath = '/u/' + msg.jarIndex + remainingPath;
        } else {
          newPath = '/u/' + msg.jarIndex;
        }

        // Preserve query string and hash
        const fullUrl = IDP_ORIGIN + newPath + window.location.search + window.location.hash;

        console.log('[AccountSwitcher] On IDP domain, navigating to account page:', fullUrl);
        setTimeout(function() {
          window.location.href = fullUrl;
        }, 100);
      } else if (isOnIdpDomain && msg.jarIndex === undefined) {
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
    if (msg.type === 'logoutApp') {
      const logoutUrl = msg.logoutUrl;
      console.log('[AccountSwitcher] Logging out of app, redirecting to:', logoutUrl);
      currentAccountState = { hasActiveSession: false, hasRememberedAccounts: false, activeAccountPreview: null, dataLoaded: true };
      updateButtonAppearance();
      closeAccountSwitcher();
      setTimeout(function() {
        window.location.href = logoutUrl;
      }, 100);
      return;
    }

    // Handle: logoutGlobal (full logout)
    if (msg.type === 'logoutGlobal') {
      console.log('[AccountSwitcher] Global logout initiated, redirecting to IDP');
      currentAccountState = { hasActiveSession: false, hasRememberedAccounts: false, activeAccountPreview: null, dataLoaded: true };
      updateButtonAppearance();
      closeAccountSwitcher();
      setTimeout(function() {
        window.location.href = IDP_ORIGIN + '/login';
      }, 100);
      return;
    }

    // Handle: sessionUpdate (account switch or auth change) — refresh button via /api/me
    if (msg.type === 'sessionUpdate') {
      console.log('[AccountSwitcher] Session updated, refreshing button state');
      const isOnClient = window.location.origin !== IDP_ORIGIN;
      if (isOnClient) {
        // Delay: page.tsx also calls /api/me on sessionUpdate. Two concurrent calls
        // can race on CSRF token rotation, causing one to fail.
        setTimeout(function() {
          fetch('/api/me', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          })
            .then(function(r) { return r.json() as Promise<MeResponse>; })
            .then(function(data) {
              if (data.authenticated && data.user) {
                currentAccountState = {
                  hasActiveSession: true,
                  hasRememberedAccounts: true,
                  activeAccountPreview: {
                    name: data.user.name || '?',
                    email: data.user.email || '',
                    avatarUrl: data.user.profile_image_url || null,
                  },
                  dataLoaded: true,
                };
                if (data.sessionId) {
                  cachedSessionId = data.sessionId;
                  if (iframe && iframe.contentWindow) {
                    iframe.contentWindow.postMessage(
                      { type: 'SSO_SESSION_UPDATE', sessionId: data.sessionId, timestamp: Date.now() },
                      IDP_ORIGIN,
                    );
                  }
                }
              } else {
                // Preserve remembered-account state on transient /api/me misses.
                currentAccountState = {
                  hasActiveSession: false,
                  hasRememberedAccounts: currentAccountState.hasRememberedAccounts !== false,
                  activeAccountPreview: currentAccountState.activeAccountPreview || null,
                  dataLoaded: true,
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
    if (msg.type === 'accountStateChanged') {
      currentAccountState = {
        hasActiveSession: !!msg.hasActiveSession,
        hasRememberedAccounts: !!msg.hasRememberedAccounts,
        activeAccountPreview: msg.activeAccountPreview || null,
        dataLoaded: !!msg.dataLoaded,
      };
      console.log('[AccountSwitcher] Account state updated:', {
        hasActiveSession: currentAccountState.hasActiveSession,
        hasRememberedAccounts: currentAccountState.hasRememberedAccounts,
        name: currentAccountState.activeAccountPreview?.name || null,
        dataLoaded: currentAccountState.dataLoaded,
      });
      updateButtonAppearance();
      return;
    }

    // Handle: iframeReady (iframe has loaded and rendered content)
    if (msg.type === 'iframeReady') {
      console.log('[AccountSwitcher] Iframe ready');
      iframeIsReady = true;
      if (cachedSessionId) {
        sendSessionToIframe(cachedSessionId);
      }
      return;
    }

    // Handle: contentHeightChanged (iframe content height changed)
    if (msg.type === 'contentHeightChanged') {
      const newHeight = msg.height;
      if (iframe && newHeight > 0) {
        const maxHeight = window.innerHeight * 0.8;
        iframe.style.height = Math.min(newHeight, maxHeight) + 'px';
        console.log('[AccountSwitcher] Iframe height updated to:', Math.min(newHeight, maxHeight));
      }
      return;
    }
  });

  // Handle button click — split behavior based on session state
  function handleButtonClick() {
    if (!currentAccountState.hasActiveSession && !currentAccountState.hasRememberedAccounts) {
      console.log('[AccountSwitcher] No active session — initiating sign-in flow');
      const isOnIdpDomain = window.location.origin === IDP_ORIGIN;
      if (isOnIdpDomain) {
        window.location.href = IDP_ORIGIN + '/login';
      } else {
        // widget.js runs in the client's window context, so fetch goes to client's own API
        fetch('/api/auth/start?prompt=login', { credentials: 'include' })
          .then(function(r) { return r.json() as Promise<{ url?: string }>; })
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
    openAccountSwitcher();
  }

  function openAccountSwitcher() {
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

      if (isIntegratedMode && button) {
        const buttonRect = button.getBoundingClientRect();
        const popoverTop = buttonRect.bottom + 12;
        const popoverRight = window.innerWidth - buttonRect.right;

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
  function preloadIframe() {
    if (iframeModal || iframe) {
      return; // Already created
    }

    console.log('[AccountSwitcher] Pre-creating iframe for faster loading...');

    const popover = document.createElement('div');
    popover.id = '__account_switcher_popover';
    popover.className = 'hidden';
    document.body.appendChild(popover);
    iframeModal = popover;

    iframe = document.createElement('iframe');
    iframe.id = '__account_switcher_iframe';

    const parentOriginParam = encodeURIComponent(getParentOrigin() || 'http://localhost:3003');
    let iframeUrl = WIDGET_URL + '?parentOrigin=' + parentOriginParam;

    const clientId = window.__CLIENT_ID || window.CLIENT_ID;
    if (clientId) {
      iframeUrl += '&client_id=' + encodeURIComponent(clientId);
      console.log('[AccountSwitcher] Adding client_id to iframe URL:', clientId);
    }

    iframe.src = iframeUrl;

    iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-top-navigation');
    iframe.setAttribute('allow', 'cross-origin-isolated');
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');

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
    document.addEventListener('mousedown', function(e) {
      const target = e.target as Node | null;
      if (isPopoverOpen && iframeModal && target && !iframeModal.contains(target) && buttonContainer && !buttonContainer.contains(target)) {
        closeAccountSwitcher();
      }
    });

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
    const popoverTop = buttonRect.bottom + 12;
    const popoverRight = window.innerWidth - buttonRect.right;

    iframeModal.style.top = popoverTop + 'px';
    iframeModal.style.right = popoverRight + 'px';
  }

  function triggerSilentLogin() {
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
  function sendSessionToIframe(sessionId: string) {
    if (!sessionId || !iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage(
      { type: 'SSO_SESSION', sessionId: sessionId, timestamp: Date.now() },
      IDP_ORIGIN,
    );
    console.log('[AccountSwitcher] Sent sessionId to iframe');
  }

  // Fetch session from client's /api/me and send to iframe.
  // Called immediately on client domains (not waiting for fallback timeout).
  function fetchAndSendSession() {
    fetch('/api/me', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then(function(r) { return r.json() as Promise<MeResponse>; })
      .then(function(data) {
        if (data.authenticated && data.sessionId) {
          cachedSessionId = data.sessionId;
          sendSessionToIframe(cachedSessionId);

          if (!currentAccountState.dataLoaded) {
            currentAccountState = {
              hasActiveSession: true,
              hasRememberedAccounts: true,
              activeAccountPreview: {
                name: data.user?.name || data.account?.name || '?',
                email: data.user?.email || data.account?.email || '',
                avatarUrl: data.user?.profile_image_url || null,
              },
              dataLoaded: true,
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
                avatarUrl: data.user.profile_image_url || null,
              },
              dataLoaded: true,
            };
            updateButtonAppearance();
          }
        } else {
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

  // Update button appearance based on cached account state.
  // Called whenever accountStateChanged arrives from iframe.
  // Only updates inner content — never recreates the button element.
  function updateButtonAppearance() {
    if (!button) return;
    const btn = button;
    const state = currentAccountState;
    const mode = currentMode();

    if (!state.dataLoaded) {
      renderSkeleton(btn, mode);
      return;
    }

    if ((state.hasActiveSession || state.hasRememberedAccounts) && state.activeAccountPreview) {
      const preview = state.activeAccountPreview;
      const allSignedOut = state.hasRememberedAccounts && !state.hasActiveSession;
      renderAvatar(
        btn,
        preview,
        { hasActiveSession: state.hasActiveSession, hasRememberedAccounts: state.hasRememberedAccounts },
        mode,
        AVATAR_CHAR_COLOR_MAP,
      );
      if (allSignedOut) {
        console.log('[AccountSwitcher] Button updated to generic user icon (all accounts signed out)');
      } else {
        console.log('[AccountSwitcher] Button updated to avatar:', preview.name, {
          hasActiveSession: state.hasActiveSession,
          hasRememberedAccounts: state.hasRememberedAccounts,
        });
      }
    } else {
      renderSignIn(btn, signInConfig, mode);
      console.log('[AccountSwitcher] Button updated to sign-in');
    }
  }

  function resolveRememberedAccountsFallback(): Promise<void> {
    return fetch(IDP_ORIGIN + '/api/widget/accounts', {
      credentials: 'include',
    })
      .then(function(r) { return r.json() as Promise<AccountsResponse>; })
      .then(function(data) {
        if (currentAccountState.dataLoaded) return;

        if (data && Array.isArray(data.accounts) && data.accounts.length > 0) {
          const remembered = data.accounts[0];
          currentAccountState = {
            hasActiveSession: false,
            hasRememberedAccounts: true,
            activeAccountPreview: {
              name: remembered.name || '?',
              email: remembered.email || '',
              avatarUrl: remembered.profile_image_url || null,
            },
            dataLoaded: true,
          };
          console.log('[AccountSwitcher] Fallback: remembered accounts found, showing avatar');
        } else {
          currentAccountState = {
            hasActiveSession: false,
            hasRememberedAccounts: false,
            activeAccountPreview: null,
            dataLoaded: true,
          };
          console.log('[AccountSwitcher] Fallback: no remembered accounts');
        }

        updateButtonAppearance();
      });
  }

  // Create avatar button - appended to mount point (integrated) or body (floating)
  function createButton(): { button: HTMLButtonElement; buttonContainer: HTMLDivElement } {
    const container = document.createElement('div');
    container.id = '__account_switcher_button_container';

    const btn = document.createElement('button');
    btn.id = '__account_switcher_button';
    renderSkeleton(btn, currentMode());

    btn.addEventListener('click', handleButtonClick);
    container.appendChild(btn);

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

  // Initialize widget on page load
  function initializeWidget() {
    const detection = detectMountPoint(document);
    mountPoint = detection.element;
    isIntegratedMode = detection.mode === 'integrated';
    signInConfig.text = detection.signInConfig.text;
    signInConfig.style = detection.signInConfig.style;
    if (isIntegratedMode) {
      console.log('[AccountSwitcher] Mount point detected - using integrated mode');
      console.log('[AccountSwitcher] Sign-in config:', signInConfig);
    } else {
      console.log('[AccountSwitcher] No mount point - using floating mode');
    }

    injectStyles(document, currentMode(), WIDGET_URL);
    createButton();
    updateButtonAppearance();
    preloadIframe();
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
    const isOnIdp = window.location.origin === IDP_ORIGIN;

    if (!isOnIdp) {
      console.log('[AccountSwitcher] Client domain — fetching session via /api/me');
      fetchAndSendSession();
    }

    // Fallback timeout: resolve skeleton if nothing reported in time
    const fallbackDelay = isOnIdp ? 3000 : 2000;
    setTimeout(function() {
      if (currentAccountState.dataLoaded) return;
      if (isOnIdp) {
        console.log('[AccountSwitcher] Iframe did not report state — defaulting to sign-in');
        currentAccountState = { hasActiveSession: false, hasRememberedAccounts: false, activeAccountPreview: null, dataLoaded: true };
        updateButtonAppearance();
      }
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
    setTimeout(initializeWidget, 0);
  }

  // Public configuration API
  window.__accountSwitcher = {
    open: openAccountSwitcher,
    close: closeAccountSwitcher,
    configure: function(config: ConfigureOptions) {
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
    },
  };
})(window);
