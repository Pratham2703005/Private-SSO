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

  // Note: Widget iframe is injected via AccountSwitcher script (widget.js)
  // We don't preload it here to avoid duplicate iframe issues

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

  // Reference to actual widget iframe (captured from first message)
  const widgetContentWindowRef = useRef<Window | null>(null);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Only accept messages from localhost:3000 (IDP)
      if (event.origin !== 'http://localhost:3000') return;

      // Capture the actual widget iframe on first message
      if (!widgetContentWindowRef.current && event.source) {
        widgetContentWindowRef.current = event.source as Window;
      }
      
      // Handle global logout from widget
      if (event.data?.type === 'globalLogout') {
        setSession(null);
        toastShownRef.current = false;
        
        // Notify widget iframe to refetch its state
        if (widgetContentWindowRef.current) {
          widgetContentWindowRef.current.postMessage(
            { type: 'sessionUpdate' },
            'http://localhost:3000'
          );
        }
        return;
      }

      // Handle logout event from widget
      if (event.data?.type === 'logout') {
        setSession(null);
        toastShownRef.current = false;
        return;
      }

      // Handle widget close - re-validate session
      if (event.data?.type === 'widgetClosed') {
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
      if (event.data?.type === 'startAuth') {
        const iframeOrigin = 'http://localhost:3000';
        if (event.origin !== iframeOrigin) {
          return;
        }

        try {
          const url = new URL('/api/auth/start', window.location.origin);
          if (event.data.email) {
            url.searchParams.set('email', event.data.email);
          }
          if (event.data.prompt) {
            url.searchParams.set('prompt', event.data.prompt);
          }
          
          const response = await fetch(url.toString());
          const data = await response.json();

          if (data.url) {
            window.location.href = data.url;
          } else {
            alert('Failed to start authentication');
          }
        } catch (error) {
          console.error('Sign in failed:', error);
          alert('Sign in failed. Please try again.');
        }
        return;
      }

      // Handle navigation requests from widget
      if (event.data?.type === 'navigate') {
        if (event.origin !== 'http://localhost:3000') {
          return;
        }
        const targetUrl = event.data.url;
        if (targetUrl) {
          window.location.href = targetUrl;
        }
        return;
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

