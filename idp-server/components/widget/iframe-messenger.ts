'use client';

import { useEffect } from 'react';

/**
 * IframeMessenger Component
 * Handles postMessage communication with parent window
 * Monitors content height and notifies parent of changes
 */
export default function IframeMessenger() {
  useEffect(() => {
    console.log('[IframeMessenger] Initializing...');
    console.log('[IframeMessenger] Is in iframe:', window.parent !== window);
    
    const notifyParent = () => {
      if (window.parent && window.parent !== window) {
        try {
          window.parent.postMessage(
            { type: 'iframeReady' },
            '*'
          );
          console.log('[IframeMessenger] Sent iframeReady message to parent');
        } catch (error) {
          console.error('[IframeMessenger] Failed to send message:', error);
        }
      }
    };

    // Notify immediately
    notifyParent();
    
    // Also notify after a short delay to ensure DOM is fully rendered
    const timer = setTimeout(notifyParent, 100);

    // Set up ResizeObserver to monitor content height.
    // Note: we measure `document.body.getBoundingClientRect().height` — not
    // `document.documentElement.scrollHeight` — because the parent page sets
    // the iframe's height inline, which makes <html>'s clientHeight track the
    // iframe viewport. Since scrollHeight returns max(clientHeight, content),
    // it gets stuck at the old (larger) iframe height when the body shrinks,
    // so the iframe never shrinks back. The body box has no such floor.
    const setupHeightMonitoring = () => {
      const bodyElement = document.body;

      if (!bodyElement) {
        console.warn('[IframeMessenger] Body element not found');
        return;
      }

      const measureHeight = () =>
        Math.ceil(bodyElement.getBoundingClientRect().height);

      const sendHeight = () => {
        const height = measureHeight();
        if (window.parent && window.parent !== window && height > 0) {
          try {
            window.parent.postMessage(
              { type: 'contentHeightChanged', height },
              '*',
            );
          } catch (error) {
            console.error('[IframeMessenger] Failed to send height message:', error);
          }
        }
      };

      const resizeObserver = new ResizeObserver(sendHeight);
      resizeObserver.observe(bodyElement);

      // Also trigger an initial height send after first paint.
      setTimeout(() => {
        sendHeight();
        console.log('[IframeMessenger] Initial height sent:', measureHeight());
      }, 200);

      return () => resizeObserver.disconnect();
    };

    const cleanup = setupHeightMonitoring();

    return () => {
      clearTimeout(timer);
      if (cleanup) cleanup();
    };
  }, []);

  return null;
}