/**
 * Pure CSS generation + a small DOM-side-effect wrapper for injection.
 */

import { BUTTON_SIZE_PX } from './config';
import type { WidgetMode } from './types';

const STYLE_ELEMENT_ID = '__account_switcher_styles';

export function buildStylesheet(mode: WidgetMode): string {
  const isIntegrated = mode === 'integrated';
  const buttonSize = BUTTON_SIZE_PX[mode];

  const buttonContainerCSS = isIntegrated
    ? "position: relative; display: inline-flex; align-items: center; justify-content: center; z-index: auto;"
    : "position: fixed; top: 20px; right: 20px; z-index: 10001;";

  const popoverCSS = isIntegrated
    ? "position: fixed; width: 420px; max-width: 95vw; z-index: 50000;"
    : "position: fixed; top: 78px; right: 20px; width: 420px; max-width: calc(100vw - 40px); z-index: 10000;";

  return `
      #__account_switcher_button_container,
      #__account_switcher_popover,
      #__account_switcher_iframe,
      #__account_switcher_backdrop {
        box-sizing: border-box;
      }

      /*
       * Backdrop: full-viewport overlay that sits behind the popover.
       * Desktop: transparent and pointer-events: none — clicks pass through
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
       * Mobile (≤480px): centered modal with tinted backdrop.
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

export function injectStyles(doc: Document, mode: WidgetMode, widgetUrl: string): void {
  if (doc.getElementById(STYLE_ELEMENT_ID)) {
    return; // Already injected
  }

  // Prefetch link speeds up first iframe load.
  const prefetchLink = doc.createElement('link');
  prefetchLink.rel = 'prefetch';
  prefetchLink.href = widgetUrl;
  prefetchLink.as = 'document';
  doc.head.appendChild(prefetchLink);

  const style = doc.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = buildStylesheet(mode);
  doc.head.appendChild(style);
}
