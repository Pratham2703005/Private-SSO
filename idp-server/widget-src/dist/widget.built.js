"use strict";
(() => {
  // widget-src/src/config.ts
  var IDP_ORIGIN = "__IDP_ORIGIN__";
  var WIDGET_URL = "__WIDGET_URL__";
  var AVATAR_COLOR_MAP_JSON = "__AVATAR_COLOR_MAP_JSON__";
  var AVATAR_CHAR_COLOR_MAP = JSON.parse(AVATAR_COLOR_MAP_JSON);
  var BUTTON_SIZE_PX = {
    integrated: "40px",
    floating: "44px"
  };
  var SIGN_IN_HEIGHT_PX = {
    integrated: "36px",
    floating: "40px"
  };
  var DEFAULT_AVATAR_FALLBACK_COLOR = "#475569";

  // widget-src/src/button/render.ts
  function getAvatarColor(name, colorMap) {
    const firstChar = ((name || "").trim().charAt(0) || "").toUpperCase();
    return colorMap[firstChar] || DEFAULT_AVATAR_FALLBACK_COLOR;
  }
  function renderInitialAvatar(btn, name, colorMap) {
    btn.style.background = getAvatarColor(name, colorMap);
    const initial = document.createElement("span");
    initial.textContent = (name || "?").charAt(0).toUpperCase();
    initial.style.cssText = "font-size: 18px; font-weight: 600; color: white; line-height: 1; user-select: none;";
    btn.appendChild(initial);
  }
  function renderSkeleton(btn, mode) {
    const size = BUTTON_SIZE_PX[mode];
    btn.setAttribute("aria-label", "Loading...");
    btn.title = "";
    btn.innerHTML = "";
    btn.disabled = true;
    btn.style.cssText = [
      "width: " + size,
      "height: " + size,
      "border-radius: 50%",
      "background: #e0e0e0",
      "border: 2px solid #dadce0",
      "cursor: default",
      "display: flex",
      "align-items: center",
      "justify-content: center",
      "padding: 0",
      "outline: none",
      "box-shadow: none",
      "animation: __asSkeleton 1.5s ease-in-out infinite"
    ].join("; ") + ";";
  }
  function renderAvatar(btn, preview, options, mode, colorMap) {
    const size = BUTTON_SIZE_PX[mode];
    const allSignedOut = options.hasRememberedAccounts && !options.hasActiveSession;
    btn.disabled = false;
    btn.setAttribute(
      "aria-label",
      allSignedOut ? "Account selector" : "Account: " + preview.name
    );
    btn.title = allSignedOut ? "Choose an account" : preview.name + " (" + preview.email + ")";
    btn.innerHTML = "";
    btn.style.cssText = [
      "width: " + size,
      "height: " + size,
      "border-radius: 50%",
      "border: 2px solid #dadce0",
      "cursor: pointer",
      "display: flex",
      "align-items: center",
      "justify-content: center",
      "padding: 0",
      "outline: none",
      "box-shadow: none",
      "overflow: hidden",
      "background: transparent"
    ].join("; ") + ";";
    if (allSignedOut) {
      renderGenericUserIcon(btn);
      return;
    }
    if (preview.avatarUrl) {
      const img = document.createElement("img");
      img.src = preview.avatarUrl;
      img.alt = preview.name;
      img.style.cssText = "width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block;";
      img.onerror = function() {
        btn.innerHTML = "";
        renderInitialAvatar(btn, preview.name, colorMap);
      };
      btn.appendChild(img);
      return;
    }
    renderInitialAvatar(btn, preview.name, colorMap);
  }
  function renderSignIn(btn, config, mode) {
    btn.disabled = false;
    btn.setAttribute("aria-label", config.text);
    btn.title = config.text;
    btn.innerHTML = "";
    btn.style.cssText = [
      "border-radius: 20px",
      "width: auto",
      "height: " + SIGN_IN_HEIGHT_PX[mode],
      "padding: 0 16px",
      "background: #1a73e8",
      "overflow: visible",
      "display: flex",
      "align-items: center",
      "justify-content: center",
      "cursor: pointer",
      "border: none",
      "box-shadow: none",
      "transition: none",
      "outline: none",
      config.style
      // Custom CSS overrides go last
    ].filter(Boolean).join("; ") + ";";
    const label = document.createElement("span");
    label.textContent = config.text;
    label.style.cssText = "font-size: 14px; font-weight: 500; color: inherit; white-space: nowrap; line-height: 1;";
    btn.appendChild(label);
    if (!config.style || config.style.indexOf("color") === -1) {
      btn.style.color = "white";
    }
  }
  function renderGenericUserIcon(btn) {
    btn.style.background = "#f0f0f0";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "#5f6368");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.style.cssText = "width: 18px; height: 18px; flex-shrink: 0; display: block; color: #5f6368;";
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2");
    path.setAttribute("stroke", "#5f6368");
    svg.appendChild(path);
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "12");
    circle.setAttribute("cy", "7");
    circle.setAttribute("r", "4");
    circle.setAttribute("stroke", "#000");
    svg.appendChild(circle);
    btn.appendChild(svg);
  }

  // widget-src/src/mount-detect.ts
  function detectMountPoint(doc) {
    const element = doc.getElementById("__account_switcher_mount_point");
    const signInConfig = { text: "Sign in", style: "" };
    if (!element) {
      return { mode: "floating", element: null, signInConfig };
    }
    const text = element.getAttribute("data-signin-text");
    const customStyle = element.getAttribute("data-signin-style");
    if (text) signInConfig.text = text;
    if (customStyle) signInConfig.style = customStyle;
    return { mode: "integrated", element, signInConfig };
  }

  // widget-src/src/styles.ts
  var STYLE_ELEMENT_ID = "__account_switcher_styles";
  function buildStylesheet(mode) {
    const isIntegrated = mode === "integrated";
    const buttonSize = BUTTON_SIZE_PX[mode];
    const buttonContainerCSS = isIntegrated ? "position: relative; display: inline-flex; align-items: center; justify-content: center; z-index: auto;" : "position: fixed; top: 20px; right: 20px; z-index: 10001;";
    const popoverCSS = isIntegrated ? "position: fixed; width: 420px; max-width: 95vw; z-index: 50000;" : "position: fixed; top: 78px; right: 20px; width: 420px; max-width: calc(100vw - 40px); z-index: 10000;";
    return `
      #__account_switcher_button_container,
      #__account_switcher_popover,
      #__account_switcher_iframe,
      #__account_switcher_backdrop {
        box-sizing: border-box;
      }

      /*
       * Backdrop: full-viewport overlay that sits behind the popover.
       * Desktop: transparent and pointer-events: none \u2014 clicks pass through
       * so the rest of the page stays interactive while the popover is open.
       * Mobile: tinted + interactive so tapping outside the centered modal
       * closes it (existing document mousedown handler catches the click).
       */
      #__account_switcher_backdrop {
        position: fixed;
        inset: 0;
        z-index: 9999;
        background: transparent;
        pointer-events: none;
        opacity: 0;
        transition: opacity 160ms ease, background-color 160ms ease;
      }

      #__account_switcher_backdrop.hidden {
        display: none;
      }

      #__account_switcher_backdrop.visible {
        opacity: 1;
      }

      #__account_switcher_popover {
        ${popoverCSS}
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        padding: 0;
        margin: 0;
        border: none;
        overflow: hidden;
        outline: none;
        transition: opacity 160ms ease;
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
        max-height: 80dvh;
        border: none;
        margin: 0;
        padding: 0;
        background: white;
        transition: height 200ms ease-out;
      }

      #__account_switcher_button_container {
        ${buttonContainerCSS}
      }

      #__account_switcher_button {
        width: ${buttonSize};
        height: ${buttonSize};
      }

      @keyframes __asSkeleton {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 1; }
      }

      /*
       * Mobile (\u2264480px): centered modal with tinted backdrop.
       * Overrides the desktop anchored-to-button positioning (set inline by JS).
       */
      @media (max-width: 480px) {
        #__account_switcher_backdrop.visible {
          background: rgba(0, 0, 0, 0.5);
          pointer-events: auto;
        }

        #__account_switcher_popover {
          top: 50% !important;
          left: 50% !important;
          right: auto !important;
          bottom: auto !important;
          transform: translate(-50%, -50%);
          width: calc(100% - 32px) !important;
          max-width: 420px !important;
          border-radius: 16px !important;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3) !important;
        }

        #__account_switcher_iframe {
          max-height: 80dvh;
        }
      }
    `;
  }
  function injectStyles(doc, mode, widgetUrl) {
    if (doc.getElementById(STYLE_ELEMENT_ID)) {
      return;
    }
    const prefetchLink = doc.createElement("link");
    prefetchLink.rel = "prefetch";
    prefetchLink.href = widgetUrl;
    prefetchLink.as = "document";
    doc.head.appendChild(prefetchLink);
    const style = doc.createElement("style");
    style.id = STYLE_ELEMENT_ID;
    style.textContent = buildStylesheet(mode);
    doc.head.appendChild(style);
  }

  // widget-src/src/entry.ts
  (function(window2) {
    "use strict";
    if (window2.__accountSwitcherLoaded) {
      console.log("[AccountSwitcher] Already loaded, skipping");
      return;
    }
    window2.__accountSwitcherLoaded = true;
    let iframeModal = null;
    let iframe = null;
    let backdrop = null;
    let isPopoverOpen = false;
    let button = null;
    let buttonContainer = null;
    let isIntegratedMode = false;
    let mountPoint = null;
    let cachedSessionId = null;
    let iframeIsReady = false;
    let currentAccountState = {
      hasActiveSession: false,
      hasRememberedAccounts: false,
      activeAccountPreview: null,
      dataLoaded: false
    };
    const signInConfig = {
      text: "Sign in",
      style: ""
    };
    function currentMode() {
      return isIntegratedMode ? "integrated" : "floating";
    }
    let previousBodyOverflow = null;
    const MOBILE_QUERY = "(max-width: 480px)";
    function lockBodyScroll() {
      if (previousBodyOverflow !== null) return;
      if (!window2.matchMedia(MOBILE_QUERY).matches) return;
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    function unlockBodyScroll() {
      if (previousBodyOverflow === null) return;
      document.body.style.overflow = previousBodyOverflow;
      previousBodyOverflow = null;
    }
    function getParentOrigin() {
      try {
        return window2.location.origin;
      } catch (e) {
        return null;
      }
    }
    window2.addEventListener("message", function(event) {
      var _a;
      if (event.origin !== IDP_ORIGIN) {
        console.warn("[AccountSwitcher] Blocked message from untrusted origin:", event.origin);
        return;
      }
      const msg = event.data;
      if (msg.type === "closeAccountSwitcher") {
        closeAccountSwitcher();
        return;
      }
      if (msg.type === "ACCOUNT_SWITCHED") {
        console.log("[AccountSwitcher] Account switched:", msg.jarIndex !== void 0 ? "jar index " + msg.jarIndex : "no jar index");
        const isOnIdpDomain = window2.location.origin === IDP_ORIGIN;
        if (isOnIdpDomain && msg.jarIndex !== void 0) {
          const currentPath = window2.location.pathname;
          const pathMatch = currentPath.match(/^\/u\/(\d+)(\/.*)?$/);
          let newPath;
          if (pathMatch) {
            const remainingPath = pathMatch[2] || "";
            newPath = "/u/" + msg.jarIndex + remainingPath;
          } else {
            newPath = "/u/" + msg.jarIndex;
          }
          const fullUrl = IDP_ORIGIN + newPath + window2.location.search + window2.location.hash;
          console.log("[AccountSwitcher] On IDP domain, navigating to account page:", fullUrl);
          setTimeout(function() {
            window2.location.href = fullUrl;
          }, 100);
        } else if (isOnIdpDomain && msg.jarIndex === void 0) {
          triggerSilentLogin();
        } else {
          console.log("[AccountSwitcher] On client domain, delegating to client widget-manager");
        }
        closeAccountSwitcher();
        return;
      }
      if (msg.type === "logoutApp") {
        const logoutUrl = msg.logoutUrl;
        console.log("[AccountSwitcher] Logging out of app, redirecting to:", logoutUrl);
        currentAccountState = { hasActiveSession: false, hasRememberedAccounts: false, activeAccountPreview: null, dataLoaded: true };
        updateButtonAppearance();
        closeAccountSwitcher();
        setTimeout(function() {
          window2.location.href = logoutUrl;
        }, 100);
        return;
      }
      if (msg.type === "logoutGlobal") {
        console.log("[AccountSwitcher] Global logout initiated, redirecting to IDP");
        currentAccountState = { hasActiveSession: false, hasRememberedAccounts: false, activeAccountPreview: null, dataLoaded: true };
        updateButtonAppearance();
        closeAccountSwitcher();
        setTimeout(function() {
          window2.location.href = IDP_ORIGIN + "/login";
        }, 100);
        return;
      }
      if (msg.type === "sessionUpdate") {
        console.log("[AccountSwitcher] Session updated, refreshing button state");
        const isOnClient = window2.location.origin !== IDP_ORIGIN;
        if (isOnClient) {
          setTimeout(function() {
            fetch("/api/me", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({})
            }).then(function(r) {
              return r.json();
            }).then(function(data) {
              if (data.authenticated && data.user) {
                currentAccountState = {
                  hasActiveSession: true,
                  hasRememberedAccounts: true,
                  activeAccountPreview: {
                    name: data.user.name || "?",
                    email: data.user.email || "",
                    avatarUrl: data.user.profile_image_url || null
                  },
                  dataLoaded: true
                };
                if (data.sessionId) {
                  cachedSessionId = data.sessionId;
                  if (iframe && iframe.contentWindow) {
                    iframe.contentWindow.postMessage(
                      { type: "SSO_SESSION_UPDATE", sessionId: data.sessionId, timestamp: Date.now() },
                      IDP_ORIGIN
                    );
                  }
                }
              } else {
                currentAccountState = {
                  hasActiveSession: false,
                  hasRememberedAccounts: currentAccountState.hasRememberedAccounts !== false,
                  activeAccountPreview: currentAccountState.activeAccountPreview || null,
                  dataLoaded: true
                };
              }
              updateButtonAppearance();
            }).catch(function(err) {
              console.log("[AccountSwitcher] sessionUpdate /api/me failed:", err);
            });
          }, 800);
        }
      }
      if (msg.type === "accountStateChanged") {
        currentAccountState = {
          hasActiveSession: !!msg.hasActiveSession,
          hasRememberedAccounts: !!msg.hasRememberedAccounts,
          activeAccountPreview: msg.activeAccountPreview || null,
          dataLoaded: !!msg.dataLoaded
        };
        console.log("[AccountSwitcher] Account state updated:", {
          hasActiveSession: currentAccountState.hasActiveSession,
          hasRememberedAccounts: currentAccountState.hasRememberedAccounts,
          name: ((_a = currentAccountState.activeAccountPreview) == null ? void 0 : _a.name) || null,
          dataLoaded: currentAccountState.dataLoaded
        });
        updateButtonAppearance();
        return;
      }
      if (msg.type === "iframeReady") {
        console.log("[AccountSwitcher] Iframe ready");
        iframeIsReady = true;
        if (cachedSessionId) {
          sendSessionToIframe(cachedSessionId);
        }
        return;
      }
      if (msg.type === "contentHeightChanged") {
        const newHeight = msg.height;
        if (iframe && newHeight > 0) {
          const maxHeight = window2.innerHeight * 0.8;
          iframe.style.height = Math.min(newHeight, maxHeight) + "px";
          console.log("[AccountSwitcher] Iframe height updated to:", Math.min(newHeight, maxHeight));
        }
        return;
      }
    });
    function handleButtonClick() {
      if (!currentAccountState.hasActiveSession && !currentAccountState.hasRememberedAccounts) {
        console.log("[AccountSwitcher] No active session \u2014 initiating sign-in flow");
        const isOnIdpDomain = window2.location.origin === IDP_ORIGIN;
        if (isOnIdpDomain) {
          window2.location.href = IDP_ORIGIN + "/login";
        } else {
          fetch("/api/auth/start?prompt=login", { credentials: "include" }).then(function(r) {
            return r.json();
          }).then(function(data) {
            if (data.url) {
              window2.location.href = data.url;
            } else {
              console.error("[AccountSwitcher] No auth URL returned");
            }
          }).catch(function(err) {
            console.error("[AccountSwitcher] Auth start failed:", err);
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
          console.error("[AccountSwitcher] Failed to create iframe");
          return;
        }
      }
      isPopoverOpen = !isPopoverOpen;
      if (isPopoverOpen) {
        iframeModal.classList.remove("hidden");
        iframeModal.classList.add("visible");
        if (backdrop) {
          backdrop.classList.remove("hidden");
          backdrop.classList.add("visible");
        }
        lockBodyScroll();
        if (isIntegratedMode && button) {
          const buttonRect = button.getBoundingClientRect();
          const popoverTop = buttonRect.bottom + 12;
          const popoverRight = window2.innerWidth - buttonRect.right;
          iframeModal.style.top = popoverTop + "px";
          iframeModal.style.right = popoverRight + "px";
          console.log("[AccountSwitcher] Popover positioned at top:", popoverTop, "right:", popoverRight);
        }
        console.log("[AccountSwitcher] Popover opened");
      } else {
        iframeModal.classList.add("hidden");
        iframeModal.classList.remove("visible");
        if (backdrop) {
          backdrop.classList.add("hidden");
          backdrop.classList.remove("visible");
        }
        unlockBodyScroll();
        console.log("[AccountSwitcher] Popover closed");
      }
    }
    function closeAccountSwitcher() {
      isPopoverOpen = false;
      if (iframeModal) {
        iframeModal.classList.add("hidden");
        iframeModal.classList.remove("visible");
      }
      if (backdrop) {
        backdrop.classList.add("hidden");
        backdrop.classList.remove("visible");
      }
      unlockBodyScroll();
    }
    function preloadIframe() {
      if (iframeModal || iframe) {
        return;
      }
      console.log("[AccountSwitcher] Pre-creating iframe for faster loading...");
      const backdropEl = document.createElement("div");
      backdropEl.id = "__account_switcher_backdrop";
      backdropEl.className = "hidden";
      document.body.appendChild(backdropEl);
      backdrop = backdropEl;
      const popover = document.createElement("div");
      popover.id = "__account_switcher_popover";
      popover.className = "hidden";
      document.body.appendChild(popover);
      iframeModal = popover;
      iframe = document.createElement("iframe");
      iframe.id = "__account_switcher_iframe";
      const parentOriginParam = encodeURIComponent(getParentOrigin() || "http://localhost:3003");
      let iframeUrl = WIDGET_URL + "?parentOrigin=" + parentOriginParam;
      const clientId = window2.__CLIENT_ID || window2.CLIENT_ID;
      if (clientId) {
        iframeUrl += "&client_id=" + encodeURIComponent(clientId);
        console.log("[AccountSwitcher] Adding client_id to iframe URL:", clientId);
      }
      iframe.src = iframeUrl;
      iframe.setAttribute("sandbox", "allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-top-navigation");
      iframe.setAttribute("allow", "cross-origin-isolated");
      iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      iframe.addEventListener("load", function() {
        console.log("[AccountSwitcher] Iframe loaded successfully");
      });
      iframe.addEventListener("error", function() {
        console.error("[AccountSwitcher] Failed to load iframe from:", iframeUrl);
        popover.innerHTML = '<div style="padding: 20px; text-align: center; color: #666; font-size: 14px;">Failed to load account switcher. Please refresh.</div>';
      });
      popover.appendChild(iframe);
      console.log("[AccountSwitcher] Iframe pre-created with src:", iframeUrl);
    }
    function setupCloseHandlers() {
      document.addEventListener("mousedown", function(e) {
        const target = e.target;
        if (isPopoverOpen && iframeModal && target && !iframeModal.contains(target) && buttonContainer && !buttonContainer.contains(target)) {
          closeAccountSwitcher();
        }
      });
      document.addEventListener("keydown", function(e) {
        if (e.key === "Escape" && isPopoverOpen) {
          closeAccountSwitcher();
        }
      });
    }
    function repositionPopover() {
      if (!isPopoverOpen || !isIntegratedMode || !iframeModal || !button) {
        return;
      }
      const buttonRect = button.getBoundingClientRect();
      const popoverTop = buttonRect.bottom + 12;
      const popoverRight = window2.innerWidth - buttonRect.right;
      iframeModal.style.top = popoverTop + "px";
      iframeModal.style.right = popoverRight + "px";
    }
    function triggerSilentLogin() {
      const clientOrigin = getParentOrigin();
      const silentLoginUrl = clientOrigin + "/api/auth/silent-login";
      console.log("[AccountSwitcher] Fetching silent login from:", silentLoginUrl);
      fetch(silentLoginUrl, {
        method: "GET",
        credentials: "include",
        redirect: "follow"
      }).then(function(res) {
        if (res.ok) {
          console.log("[AccountSwitcher] Silent login successful");
          setTimeout(function() {
            window2.location.reload();
          }, 100);
        } else {
          console.log("[AccountSwitcher] Silent login response status:", res.status);
        }
      }).catch(function(err) {
        console.error("[AccountSwitcher] Silent login failed:", err);
      });
    }
    function sendSessionToIframe(sessionId) {
      if (!sessionId || !iframe || !iframe.contentWindow) return;
      iframe.contentWindow.postMessage(
        { type: "SSO_SESSION", sessionId, timestamp: Date.now() },
        IDP_ORIGIN
      );
      console.log("[AccountSwitcher] Sent sessionId to iframe");
    }
    function fetchAndSendSession() {
      fetch("/api/me", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }).then(function(r) {
        return r.json();
      }).then(function(data) {
        var _a, _b, _c, _d, _e;
        if (data.authenticated && data.sessionId) {
          cachedSessionId = data.sessionId;
          sendSessionToIframe(cachedSessionId);
          if (!currentAccountState.dataLoaded) {
            currentAccountState = {
              hasActiveSession: true,
              hasRememberedAccounts: true,
              activeAccountPreview: {
                name: ((_a = data.user) == null ? void 0 : _a.name) || ((_b = data.account) == null ? void 0 : _b.name) || "?",
                email: ((_c = data.user) == null ? void 0 : _c.email) || ((_d = data.account) == null ? void 0 : _d.email) || "",
                avatarUrl: ((_e = data.user) == null ? void 0 : _e.profile_image_url) || null
              },
              dataLoaded: true
            };
            updateButtonAppearance();
          }
        } else if (data.authenticated && data.user) {
          if (!currentAccountState.dataLoaded) {
            currentAccountState = {
              hasActiveSession: true,
              hasRememberedAccounts: true,
              activeAccountPreview: {
                name: data.user.name || "?",
                email: data.user.email || "",
                avatarUrl: data.user.profile_image_url || null
              },
              dataLoaded: true
            };
            updateButtonAppearance();
          }
        } else {
          if (!currentAccountState.dataLoaded) {
            return resolveRememberedAccountsFallback();
          }
        }
      }).catch(function(err) {
        console.log("[AccountSwitcher] fetchAndSendSession failed:", err);
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
          AVATAR_CHAR_COLOR_MAP
        );
        if (allSignedOut) {
          console.log("[AccountSwitcher] Button updated to generic user icon (all accounts signed out)");
        } else {
          console.log("[AccountSwitcher] Button updated to avatar:", preview.name, {
            hasActiveSession: state.hasActiveSession,
            hasRememberedAccounts: state.hasRememberedAccounts
          });
        }
      } else {
        renderSignIn(btn, signInConfig, mode);
        console.log("[AccountSwitcher] Button updated to sign-in");
      }
    }
    function resolveRememberedAccountsFallback() {
      return fetch(IDP_ORIGIN + "/api/widget/accounts", {
        credentials: "include"
      }).then(function(r) {
        return r.json();
      }).then(function(data) {
        if (currentAccountState.dataLoaded) return;
        if (data && Array.isArray(data.accounts) && data.accounts.length > 0) {
          const remembered = data.accounts[0];
          currentAccountState = {
            hasActiveSession: false,
            hasRememberedAccounts: true,
            activeAccountPreview: {
              name: remembered.name || "?",
              email: remembered.email || "",
              avatarUrl: remembered.profile_image_url || null
            },
            dataLoaded: true
          };
          console.log("[AccountSwitcher] Fallback: remembered accounts found, showing avatar");
        } else {
          currentAccountState = {
            hasActiveSession: false,
            hasRememberedAccounts: false,
            activeAccountPreview: null,
            dataLoaded: true
          };
          console.log("[AccountSwitcher] Fallback: no remembered accounts");
        }
        updateButtonAppearance();
      });
    }
    function createButton() {
      const container = document.createElement("div");
      container.id = "__account_switcher_button_container";
      const btn = document.createElement("button");
      btn.id = "__account_switcher_button";
      renderSkeleton(btn, currentMode());
      btn.addEventListener("click", handleButtonClick);
      container.appendChild(btn);
      if (isIntegratedMode && mountPoint) {
        mountPoint.appendChild(container);
        console.log("[AccountSwitcher] Button appended to mount point");
      } else {
        document.body.appendChild(container);
        console.log("[AccountSwitcher] Button appended to body (floating)");
      }
      button = btn;
      buttonContainer = container;
      return { button: btn, buttonContainer: container };
    }
    function initializeWidget() {
      const detection = detectMountPoint(document);
      mountPoint = detection.element;
      isIntegratedMode = detection.mode === "integrated";
      signInConfig.text = detection.signInConfig.text;
      signInConfig.style = detection.signInConfig.style;
      if (isIntegratedMode) {
        console.log("[AccountSwitcher] Mount point detected - using integrated mode");
        console.log("[AccountSwitcher] Sign-in config:", signInConfig);
      } else {
        console.log("[AccountSwitcher] No mount point - using floating mode");
      }
      injectStyles(document, currentMode(), WIDGET_URL);
      createButton();
      updateButtonAppearance();
      preloadIframe();
      setupCloseHandlers();
      if (isIntegratedMode) {
        window2.addEventListener("scroll", repositionPopover, true);
        window2.addEventListener("resize", repositionPopover);
      }
      const isOnIdp = window2.location.origin === IDP_ORIGIN;
      if (!isOnIdp) {
        console.log("[AccountSwitcher] Client domain \u2014 fetching session via /api/me");
        fetchAndSendSession();
      }
      const fallbackDelay = isOnIdp ? 3e3 : 2e3;
      setTimeout(function() {
        if (currentAccountState.dataLoaded) return;
        if (isOnIdp) {
          console.log("[AccountSwitcher] Iframe did not report state \u2014 defaulting to sign-in");
          currentAccountState = { hasActiveSession: false, hasRememberedAccounts: false, activeAccountPreview: null, dataLoaded: true };
          updateButtonAppearance();
        }
      }, fallbackDelay);
      console.log("[AccountSwitcher] Widget loaded successfully");
      console.log("[AccountSwitcher] Mode:", isIntegratedMode ? "INTEGRATED" : "FLOATING");
      console.log("[AccountSwitcher] IDP Origin:", IDP_ORIGIN);
      console.log("[AccountSwitcher] Widget URL:", WIDGET_URL);
      console.log("[AccountSwitcher] Iframe pre-created and loading in background");
      console.log("[AccountSwitcher] API available at window.__accountSwitcher");
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initializeWidget);
    } else {
      setTimeout(initializeWidget, 0);
    }
    window2.__accountSwitcher = {
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
          buttonContainer.style.bottom = pos.bottom || "auto";
          buttonContainer.style.left = pos.left || "auto";
        }
        if (config.buttonStyle && button) {
          Object.assign(button.style, config.buttonStyle);
        }
      }
    };
  })(window);
})();
