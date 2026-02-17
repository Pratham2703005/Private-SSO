'use client';

import { useEffect } from 'react';
import Script from 'next/script';

/**
 * Handles postMessage events from the widget iframe when running on the IDP server itself.
 * 
 * On client apps (client-c), the parent page handles navigate/startAuth/sessionUpdate/etc.
 * On the IDP server, we only need:
 * - navigate: redirect to the target URL (already on IDP domain)
 * - globalLogout: redirect to login page
 * - sessionUpdate: reload the page to reflect new active account
 * - logout: reload the page
 */
export function WidgetMessageHandler() {
  useEffect(() => {
    const idpOrigin = window.location.origin;

    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from our own origin (widget iframe is same-origin on IDP)
      if (event.origin !== idpOrigin) return;

      const { type } = event.data || {};

      if (type === 'navigate') {
        const url = event.data.url;
        if (url) {
          window.location.href = url;
        }
        return;
      }

      if (type === 'globalLogout') {
        window.location.href = '/login';
        return;
      }

      if (type === 'logout' || type === 'sessionUpdate') {
        window.location.reload();
        return;
      }

      // startAuth on IDP: just redirect to login page (no OAuth needed, we ARE the IDP)
      if (type === 'startAuth') {
        const email = event.data.email ? `?email=${encodeURIComponent(event.data.email)}` : '';
        window.location.href = `/login${email}`;
        return;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <Script
      src="/api/widget.js"
      strategy="afterInteractive"
    />
  );
}
