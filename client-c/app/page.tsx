'use client';

import { useEffect, useState, useRef } from 'react';

interface SessionData {
  sessionId: string;
  userId: string;
  userName: string;
  email: string;
  issuedAt: number;
}

declare global {
  interface Window {
    RobotToastUtils?: {
      showRobotToast: (options: {
        message: string;
        duration?: number;
        position?: string;
        robotSide?: string;
        robotVariant?: string;
        robotPath?: string;
        typeSpeed?: number;
      }) => Promise<void>;
    };
  }
}

export default function Home() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const toastShownRef = useRef(false);

  useEffect(() => {
    // Fetch session from /api/me (server-side only, secure)
    fetch('/api/me')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Not authenticated');
      })
      .then(data => {
        console.log('[Home] Session data from /api/me:', JSON.stringify(data, null, 2));
        setSession(data);
      })
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, []);

  // Show robot toast when user is logged in
  useEffect(() => {
    if (session && !toastShownRef.current) {
      toastShownRef.current = true;
      
      // Use global RobotToastUtils if available
      if (window.RobotToastUtils) {
        window.RobotToastUtils.showRobotToast({
          message: `Welcome back, ${session.userName}! 👋`,
          duration: 6000,
          position: 'top-left',
          robotSide: 'left',
          robotVariant: 'wave.svg',
          robotPath: 'http://localhost:3000/robots',
          typeSpeed: 25,
        }).catch(error => {
          console.error('Failed to show toast:', error);
        });
      }
    } else if (!session) {
      // Reset the toast ref when user logs out
      toastShownRef.current = false;
    }
  }, [session]);

  useEffect(() => {
    // Listen for postMessage from widget iframe
    const handleMessage = async (event: MessageEvent) => {
      // Only respond to startAuth messages from iframe
      if (event.data?.type !== 'startAuth') {
        return;
      }

      console.log('[Home] Received startAuth from widget');

      try {
        // Call our own /api/auth/start to get OAuth authorize URL with PKCE
        const response = await fetch('/api/auth/start');
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
      
        // Use global RobotToastUtils if available
        if (window.RobotToastUtils) {
          window.RobotToastUtils.showRobotToast({
            message: `Sign in failed`,
            duration: 6000,
            position: 'top-left',
            robotSide: 'left',
            robotVariant: 'error.svg',
            robotPath: 'http://localhost:3000/robots',
            typeSpeed: 25,
          }).catch(error => {
            console.error('Failed to show toast:', error);
          });
        }
      }
    };

    // Listen for messages from iframe
    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Show robot toast when user is NOT logged in
  useEffect(() => {
    if (!loading && !session && !toastShownRef.current) {
      toastShownRef.current = true;
      
      // Use global RobotToastUtils if available
      if (window.RobotToastUtils) {
        window.RobotToastUtils.showRobotToast({
          message: `Please sign in to continue`,
          duration: 6000,
          position: 'top-left',
          robotSide: 'left',
          robotVariant: 'base.svg',
          robotPath: 'http://localhost:3000/robots',
          typeSpeed: 25,
        }).catch(error => {
          console.error('Failed to show toast:', error);
        });
      }
    }
  }, [loading, session]);

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

