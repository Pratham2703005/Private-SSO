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
      #__account_switcher_iframe {
        box-sizing: border-box;
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
