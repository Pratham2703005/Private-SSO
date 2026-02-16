/**
 * Widget Script Endpoint
 * Serves the injectable widget code that clients embed with:
 * <script src="https://idp.com/widget.js"></script>
 */

export async function GET() {
  const idpOrigin = process.env.NEXT_PUBLIC_IDP_URL || 'http://localhost:3000';
  const widgetUrl = `${idpOrigin}/widget/account-switcher`;

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
  let iframeModal = null;
  let iframe = null;
  let parentOrigin = null;
  let isPopoverOpen = false;
  let button = null;
  let buttonContainer = null;

  // Detect parent origin from referrer or current location
  function getParentOrigin() {
    try {
      return window.location.origin;
    } catch (e) {
      return null;
    }
  }

  // Ensure consistent box-sizing across all widget elements
  function injectStyles() {
    if (document.getElementById('__account_switcher_styles')) {
      return; // Already injected
    }
    
    const style = document.createElement('style');
    style.id = '__account_switcher_styles';
    style.textContent = \`
      #__account_switcher_button_container,
      #__account_switcher_popover,
      #__account_switcher_iframe {
        box-sizing: border-box;
      }
      
      #__account_switcher_popover {
        position: fixed;
        top: 78px;
        right: 20px;
        width: 420px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        padding: 0;
        margin: 0;
        border: none;
        overflow: hidden;
        outline: none;
      }
      
      #__account_switcher_popover.hidden {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
      
      #__account_switcher_popover.visible {
        display: block !important;
        visibility: visible !important;
        pointer-events: auto !important;
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
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10001;
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

    // Handle: accountSwitched (trigger silent login on client)
    if (event.data.type === 'accountSwitched') {
      console.log('[AccountSwitcher] Account switched, triggering silent login');
      triggerSilentLogin();
      closeAccountSwitcher();
      return;
    }

    // Handle: logoutApp (client-only logout)
    if (event.data.type === 'logoutApp') {
      const logoutUrl = event.data.logoutUrl;
      console.log('[AccountSwitcher] Logging out of app, redirecting to:', logoutUrl);
      closeAccountSwitcher();
      setTimeout(() => {
        window.location.href = logoutUrl;
      }, 100);
      return;
    }

    // Handle: logoutGlobal (full logout)
    if (event.data.type === 'logoutGlobal') {
      console.log('[AccountSwitcher] Global logout initiated, redirecting to IDP');
      closeAccountSwitcher();
      setTimeout(() => {
        window.location.href = IDP_ORIGIN + '/login';
      }, 100);
      return;
    }

    // Handle: iframeReady (iframe has loaded and rendered content)
    if (event.data.type === 'iframeReady') {
      console.log('[AccountSwitcher] Iframe ready');
      return;
    }

    // Handle: contentHeightChanged (iframe content height changed)
    if (event.data.type === 'contentHeightChanged') {
      const newHeight = event.data.height;
      if (iframe && newHeight > 0) {
        iframe.style.height = newHeight + 'px';
        console.log('[AccountSwitcher] Iframe height updated to:', newHeight);
      }
      return;
    }
  });

  function openAccountSwitcher() {
    isPopoverOpen = !isPopoverOpen;
    
    if (!iframeModal) {
      // Create popover container (created once)
      const popover = document.createElement('div');
      popover.id = '__account_switcher_popover';
      popover.className = 'hidden';
      document.body.appendChild(popover);
      iframeModal = popover;
      
      // Create iframe directly inside popover (don't reposition)
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = '__account_switcher_iframe';
        
        // Build iframe URL with parentOrigin
        const parentOriginParam = encodeURIComponent(getParentOrigin() || 'http://localhost:3003');
        iframe.src = WIDGET_URL + '?parentOrigin=' + parentOriginParam;
        
        iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-top-navigation');
        iframe.setAttribute('allow', 'cross-origin-isolated');
        iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        
        // Handle iframe load/error events
        iframe.addEventListener('load', function() {
          console.log('[AccountSwitcher] Iframe loaded successfully');
        });
        
        iframe.addEventListener('error', function() {
          console.error('[AccountSwitcher] Failed to load iframe from:', WIDGET_URL);
          popover.innerHTML = '<div style="padding: 20px; text-align: center; color: #666; font-size: 14px;">Failed to load account switcher. Please refresh.</div>';
        });
        
        popover.appendChild(iframe);
        console.log('[AccountSwitcher] Iframe created with src:', WIDGET_URL);
      }

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

    if (isPopoverOpen) {
      iframeModal.classList.remove('hidden');
      iframeModal.classList.add('visible');
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
      .then((res) => {
        if (res.ok) {
          console.log('[AccountSwitcher] Silent login successful');
          // Reload page to reflect new session
          setTimeout(() => {
            window.location.reload();
          }, 100);
        } else {
          console.log('[AccountSwitcher] Silent login response status:', res.status);
        }
      })
      .catch((err) => {
        console.error('[AccountSwitcher] Silent login failed:', err);
      });
  }

  // Create floating avatar button (Google-style) and button container
  function createButton() {
    const container = document.createElement('div');
    container.id = '__account_switcher_button_container';
    
    const btn = document.createElement('button');
    btn.id = '__account_switcher_button';
    btn.setAttribute('aria-label', 'Account Switcher');
    btn.title = 'Account Switcher';
    btn.style.cssText = \`
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: 2px solid #dadce0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      cursor: pointer;
      font-size: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      color: white;
      font-weight: 600;
      line-height: 1;
      padding: 0;
      outline: none;
    \`;

    // Initial text (can be customized via config)
    btn.textContent = '👤';

    // Hover effects
    btn.addEventListener('mouseenter', function() {
      btn.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.25)';
      btn.style.transform = 'scale(1.08)';
    });

    btn.addEventListener('mouseleave', function() {
      btn.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.15)';
      btn.style.transform = 'scale(1)';
    });

    // Active state
    btn.addEventListener('mousedown', function() {
      btn.style.transform = 'scale(0.95)';
    });

    btn.addEventListener('mouseup', function() {
      btn.style.transform = 'scale(1.08)';
    });

    // Click handler
    btn.addEventListener('click', openAccountSwitcher);

    container.appendChild(btn);
    document.body.appendChild(container);
    
    button = btn;
    buttonContainer = container;
    
    return { button: btn, buttonContainer: container };
  }

  // Initialize widget on page load
  function initializeWidget() {
    // Inject consistent CSS first
    injectStyles();
    
    // Create button and container
    createButton();
    
    console.log('[AccountSwitcher] Widget loaded successfully');
    console.log('[AccountSwitcher] IDP Origin:', IDP_ORIGIN);
    console.log('[AccountSwitcher] Widget URL:', WIDGET_URL);
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