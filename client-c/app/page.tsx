'use client';

import { Toaster } from '@/components/Toaster';
import { useEffect, useState, useRef } from 'react';

export interface SessionData {
  sessionId: string;
  userId: string;
  userName: string;
  email: string;
  issuedAt: number;
}

export default function Home() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const toastShownRef = useRef(false);

  // Fetch session from /api/me (server-side validation)
  const fetchSession = (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    fetch('/api/me')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Not authenticated');
      })
      .then(data => {
        console.log('[Home] Session data from /api/me:', JSON.stringify(data, null, 2));
        if (data.authenticated && data.user) {
          setSession({
            sessionId: data.activeAccountId || 'unknown',
            userId: data.user.id,
            userName: data.user.name,
            email: data.user.email,
            issuedAt: (data.iat || 0) * 1000,
          });
        } else {
          setSession(null);
        }
      })
      .catch(() => {
        console.log('[Home] Session invalid or expired, clearing');
        setSession(null);
      })
      .finally(() => {
        if (!silent) {
          setLoading(false);
        }
      });
  };

  // Initial fetch on component mount
  useEffect(() => {
    let mounted = true;

    fetch('/api/me')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Not authenticated');
      })
      .then(data => {
        if (!mounted) return;
        console.log('[Home] Session data from /api/me:', JSON.stringify(data, null, 2));
        if (data.authenticated && data.user) {
          setSession({
            sessionId: data.activeAccountId || 'unknown',
            userId: data.user.id,
            userName: data.user.name,
            email: data.user.email,
            issuedAt: (data.iat || 0) * 1000,
          });
        } else {
          setSession(null);
        }
      })
      .catch(() => {
        if (!mounted) return;
        console.log('[Home] Session invalid or expired, clearing');
        setSession(null);
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Event-based session validation
  useEffect(() => {
    // Re-fetch on: visibility change, focus, and widget close
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('[Home] Page became visible, validating session...');
        fetchSession(true);
      }
    };

    const handleFocus = () => {
      console.log('[Home] Window focused, validating session...');
      fetchSession(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Preload widget iframe for instant loading on click
  useEffect(() => {
    console.log('[Home] Preloading widget iframe...');
    
    // Create hidden iframe to preload widget
    const iframe = document.createElement('iframe');
    iframe.src = 'http://localhost:3000/widget/account-switcher';
    iframe.style.display = 'none';
    iframe.title = 'Widget (preloaded)';
    document.body.appendChild(iframe);

    console.log('[Home] Widget iframe preloaded in background');

    // Cleanup on unmount
    return () => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };
  }, []);

  // Show toast when loading completes
  useEffect(() => {
    if (loading) return;

    if (!session) {
      // User is not logged in
      Toaster({
        toastShownRef,
        message: `You have not logged in`,
        robotVariant: 'think.svg'
      });
    } else {
      // User is logged in
      Toaster({
        toastShownRef,
        message: `Welcome back, ${session.userName}!`,
        robotVariant: 'wave.svg',
      });
    }
  }, [loading, session]);

  useEffect(() => {
    // Listen for messages from widget iframe
    const handleMessage = async (event: MessageEvent) => {
      // Handle global logout from widget
      if (event.data?.type === 'globalLogout') {
        console.log('[Home] Received globalLogout from widget, clearing session');
        setSession(null);
        toastShownRef.current = false;
        return;
      }

      // Handle logout event from widget
      if (event.data?.type === 'logout') {
        console.log('[Home] Received logout event from widget, clearing session');
        setSession(null);
        toastShownRef.current = false;
        return;
      }

      // Handle widget close - re-validate session
      if (event.data?.type === 'widgetClosed') {
        console.log('[Home] Widget closed, validating session...');
        fetchSession(true);
        return;
      }

      // Handle session update from widget (any account switch or auth change)
      if (event.data?.type === 'sessionUpdate') {
        console.log('[Home] Received session update from widget, refreshing...');
        fetchSession();
        return;
      }

      // Handle startAuth messages from iframe
      if (event.data?.type !== 'startAuth') {
        return;
      }

      console.log('[Home] Received startAuth from widget', event.data.email ? `for ${event.data.email}` : '');

      try {
        // Call our own /api/auth/start to get OAuth authorize URL with PKCE
        const url = new URL('/api/auth/start', window.location.origin);
        if (event.data.email) {
          url.searchParams.set('email', event.data.email);
        }
        
        const response = await fetch(url.toString());
        const data = await response.json();

        if (data.url) {
          console.log('[Home] Redirecting to authorize URL');
          // Redirect to IDP authorize endpoint with all OAuth params
          window.location.href = data.url;
        }
      } catch (error) {
        console.error('[Home] Failed to start auth:', error);
        alert('Sign in failed. Please try again.');
        toastShownRef.current = true;
        Toaster({
          toastShownRef,
          message: `Sign in failed`,
          robotVariant: 'error.svg',
        })
      }
    };

    // Listen for messages from iframe
    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return (      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="bg-white rounded-lg shadow-md p-8 text-center max-w-md">
          <p className="text-gray-600 mb-4 text-lg">Not logged in</p>
          <p className="text-sm text-gray-400">👆 Click the widget button in the top-right to sign in</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white rounded-lg shadow-md p-8 text-center max-w-md">
        <h1 className="text-2xl font-bold mb-4">✅ Client-C SSO Login Success!</h1>
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
          <p className="text-gray-700">
            <strong>Name:</strong> {session.userName}
          </p>
          <p className="text-gray-700">
            <strong>Email:</strong> {session.email}
          </p>
          <p className="text-gray-600 text-sm">
            <strong>User ID:</strong> {session.userId.substring(0, 12)}...
          </p>
          <p className="text-gray-600 text-sm mt-2">
            Logged in at {new Date(session.issuedAt).toLocaleString()}
          </p>
        </div>
        <p className="text-sm text-gray-500">
          Click the widget button to switch accounts or logout
        </p>
      </div>
    </div>
  );
}

