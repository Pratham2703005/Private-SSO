'use client';

import { useEffect, useState, useRef } from 'react';
import { toast } from 'robot-toast';

export interface SessionData {
  sessionId: string;
  userId: string;
  userName: string;
  email: string;
  issuedAt: number;
}

interface ApiMeResponse {
  authenticated: boolean;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  activeAccountId?: string;
  iat?: number;
}

export default function Home() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  // Single source of truth for session fetch logic
  const performSessionFetch = async () => {
    const response = await fetch('/api/me');
    if (!response.ok) {
      throw new Error('Not authenticated');
    }
    return response.json();
  };

  // Process and store session data
  const processSessionData = (data: ApiMeResponse) => {
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
  };

  // Wrapper that handles loading state (used by event handlers, not initial mount)
  const fetchSession = (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    performSessionFetch()
      .then(processSessionData)
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

  // Initial fetch on component mount (no loading state update to avoid React warning)
  useEffect(() => {
    let mounted = true;

    performSessionFetch()
      .then(data => {
        if (!mounted) return;
        processSessionData(data);
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

  // Show toast when initial loading completes
  useEffect(() => {
    if (loading) return;

    if (!session) {
      // User is not logged in
      toast.error({
        message: 'You have not logged in',
        robotVariant: 'angry',
        theme: 'dark'
      })
    } else {
      // User is logged in
      toast.success({
        message: `Welcome back, ${session.userName}!`,
        robotVariant: 'wave',
        theme: 'dark'
      })
    }
  }, [loading]);

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
        setSwitching(false);
        
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
        setSwitching(false);
        return;
      }

      // Handle widget close - re-validate session
      if (event.data?.type === 'widgetClosed') {
        setSwitching(false);
        fetchSession(true);
        return;
      }

      // Handle account switching started (loading state)
      if (event.data?.type === 'ACCOUNT_SWITCHING') {
        console.log('[Home] Account switching started, showing loading state...');
        setSwitching(true);
        return;
      }

      // Handle session update from widget (any account switch or auth change)
      if (event.data?.type === 'sessionUpdate') {
        console.log('[Home] Received session update from widget, refreshing...');
        setSwitching(false);
        fetchSession(true);
        
        // Clear any existing toasts and show success message
        toast.closeAll();
        toast.success({
          message: 'Account switched successfully!',
          robotVariant: 'wave',
          theme: 'dark'
        });
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
      <div className="flex flex-col min-h-screen bg-gray-100">
        {/* Navbar */}
        <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Client-C</h1>
          <div
            id="__account_switcher_mount_point"
            className="shrink-0"
            data-signin-style="
              display: inline-flex;
              align-items: center;
              justify-content: center;
              padding: 0.8rem 1.8rem;
              background: #ffffff;
              color: #000;
              border: 1px solid #dadce0;
              border-radius: 6px;
              font-weight: 500;
              cursor: pointer;
              box-shadow: 0 1px 2px rgba(60,64,67,0.15);
              transition: box-shadow 0.25s ease, transform 0.15s ease;
            "
            suppressHydrationWarning
          ></div>
        </nav>
        {/* Content */}
        <div className="flex items-center justify-center flex-1">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (      
      <div className="flex flex-col min-h-screen bg-gray-900">
        {/* Navbar */}
        <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Client-C</h1>
          <div
            id="__account_switcher_mount_point"
            className="shrink-0"
            suppressHydrationWarning
          ></div>
        </nav>
        {/* Content */}
        <div className="flex items-center justify-center flex-1">
          <div className="bg-white rounded-lg shadow-md p-8 text-center max-w-md">
            <p className="text-gray-600 mb-4 text-lg">Not logged in</p>
            <p className="text-sm text-gray-400">👆 Click the widget button in the navbar to sign in</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Client-C</h1>
        <div
          id="__account_switcher_mount_point"
          className="shrink-0"
          suppressHydrationWarning
        ></div>
      </nav>
      {/* Content */}
      <div className="flex items-center justify-center flex-1 relative">
        {/* Switching account overlay */}
        {switching && (
          <div className="absolute inset-0 bg-gray-100/80 z-40 flex items-center justify-center backdrop-blur-[1px]">
            <div className="flex flex-col items-center gap-3 bg-white rounded-xl shadow-lg px-8 py-6">
              <div className="w-8 h-8 border-[3px] border-gray-300 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-600 font-medium">Switching account…</p>
            </div>
          </div>
        )}
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
    </div>
  );
}

