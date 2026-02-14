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

    // Set up ResizeObserver to monitor content height
    const setupHeightMonitoring = () => {
      const bodyElement = document.body;
      
      if (!bodyElement) {
        console.warn('[IframeMessenger] Body element not found');
        return;
      }

      const resizeObserver = new ResizeObserver(() => {
        // Get the actual scrollHeight of document
        const height = document.documentElement.scrollHeight;
        
        if (window.parent && window.parent !== window && height > 0) {
          try {
            window.parent.postMessage(
              { 
                type: 'contentHeightChanged', 
                height: height
              },
              '*'
            );
          } catch (error) {
            console.error('[IframeMessenger] Failed to send height message:', error);
          }
        }
      });

      resizeObserver.observe(bodyElement);
      
      // Also trigger initial height send
      setTimeout(() => {
        const height = document.documentElement.scrollHeight;
        if (window.parent && window.parent !== window && height > 0) {
          try {
            window.parent.postMessage(
              { 
                type: 'contentHeightChanged', 
                height: height
              },
              '*'
            );
            console.log('[IframeMessenger] Initial height sent:', height);
          } catch (error) {
            console.error('[IframeMessenger] Failed to send initial height:', error);
          }
        }
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