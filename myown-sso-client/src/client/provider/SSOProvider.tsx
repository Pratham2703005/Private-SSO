'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SSOContext } from './context';
import { EventEmitter } from '../../shared/events';
import {
  DEFAULT_CONFIG,
  API_PATHS,
  SessionData,
  SSOProviderConfig,
  SSOContextValue,
} from '../../shared';

/**
 * SSOProvider - Main provider component
 * 
 * Single source of truth for:
 * - Session state (session, loading, error)
 * - Auth methods (signIn, logout, refresh, switchAccount)
 * - Event system (on, emit)
 * - Refresh deduping (prevent 5 simultaneous /api/me calls)
 * - Widget integration (load script, listen to postMessage)
 */
export function SSOProvider({
  idpServer,
  clientId,
  redirectUri,
  scope = 'openid profile email',
  enableWidget = true,
  onSessionUpdate,
  onError,
  children,
}: React.PropsWithChildren<SSOProviderConfig>) {
  // State
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const refreshPromiseRef = useRef<Promise<SessionData | null> | null>(null);
  const widgetFrameRef = useRef<Window | null>(null);
  const emitterRef = useRef(new EventEmitter());

  /**
   * Fetch session from /api/me
   * Without deduping - used when we need fresh data
   */
  const performSessionFetch = useCallback(async () => {
    try {
      const response = await fetch(API_PATHS.me, {
        credentials: 'include',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          _csrf: getCookie(DEFAULT_CONFIG.cookies.csrf) || '',
        }),
      });

      if (!response.ok) {
        throw new Error('Session validation failed');
      }

      const data = await response.json();
      const newSession = data.authenticated ? data : null;

      setSession(newSession);
      setError(null);
      
      return newSession;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setSession(null);
      setError(error);
      return null;
    }
  }, []);

  /**
   * Deduplicated session fetch
   * Returns existing promise if fetch is in progress
   * Only one actual /api/me call even with multiple simultaneous requests
   */
  const fetchSessionWithDedup = useCallback(async () => {
    // If already fetching, return existing promise (deduping!)
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    refreshPromiseRef.current = performSessionFetch().finally(() => {
      refreshPromiseRef.current = null;
    });

    return refreshPromiseRef.current;
  }, [performSessionFetch]);

  /**
   * Initial mount - fetch session once
   */
  useEffect(() => {
    let mounted = true;

    performSessionFetch()
      .then(newSession => {
        if (mounted) {
          setLoading(false);
          onSessionUpdate?.(newSession);
          if (newSession) {
            emitterRef.current.emit('sessionRefresh', newSession);
          }
        }
      });

    return () => {
      mounted = false;
    };
  }, [performSessionFetch, onSessionUpdate]);

  /**
   * Event-based refresh: visibility/focus changes
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchSessionWithDedup();
      }
    };

    const handleFocus = () => {
      fetchSessionWithDedup();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchSessionWithDedup]);

  /**
   * Widget integration
   * - Load widget script
   * - Listen for postMessage events  
   * - Handle WIDGET_READY, ACCOUNT_SWITCHED, AUTH_STATE, ERROR (like client-c)
   */
  useEffect(() => {
    if (!enableWidget) return;

    // Load widget script from IDP
    const script = document.createElement('script');
    script.src = `${idpServer}/api/widget.js`;
    script.async = true;
    
    let scriptAdded = false;
    try {
      document.head.appendChild(script);
      scriptAdded = true;
    } catch (err) {
      console.warn('[SSOProvider] Failed to append widget script', err);
    }

    const handleMessage = async (event: MessageEvent) => {
      console.log('[SSOProvider] Message received:', { type: event.data?.type, origin: event.origin, data: event.data });
      
      // Don't validate origin too strictly - widget can be embedded from IDP domain
      // Just check that event has a type property
      if (!event.data?.type) {
        console.warn('[SSOProvider] Invalid message - no type:', event.data);
        return;
      }

      // Capture widget iframe (can happen multiple times if needed)
      if (!widgetFrameRef.current && event.source && event.data?.type) {
        widgetFrameRef.current = event.source as Window;
        console.log('[SSOProvider] Captured widget frame reference');
      }

      // Handle session update from widget or iframe
      if (event.data?.type === 'sessionUpdate') {
        console.log('[SSOProvider] Refreshing session from widget');
        const newSession = await fetchSessionWithDedup();
        if (newSession) {
          emitterRef.current.emit('sessionRefresh', newSession);
        }
        return;
      }

      // Handle WIDGET_READY from widget
      if (event.data?.type === 'WIDGET_READY') {
        console.log('[SSOProvider] Widget ready');
        return;
      }

      // Handle iframeReady from widget
      if (event.data?.type === 'iframeReady') {
        console.log('[SSOProvider] iframeReady');
        return;
      }

      // Handle ACCOUNT_SWITCHED or accountSwitched - iframe notifies that account switched on IDP
      // ⭐ No OAuth re-auth needed - IDP session is global and already updated
      // Just refresh client session by calling /api/me
      if (event.data?.type === 'ACCOUNT_SWITCHED' || event.data?.type === 'accountSwitched') {
        console.log('[SSOProvider] Account switched on IDP:', { 
          accountId: event.data?.accountId,
          accountIndex: event.data?.accountIndex
        });
        
        // Refresh session immediately - IDP session is global, already switched
        const newSession = await fetchSessionWithDedup();
        if (newSession) {
          setSession(newSession);
          emitterRef.current.emit('sessionRefresh', newSession);
        }
        return;
      }

      // Handle AUTH_STATE from widget
      if (event.data?.type === 'AUTH_STATE') {
        console.log('[SSOProvider] Auth state from widget:', event.data);
        const payload = event.data?.payload;
        
        if (payload?.loggedOut) {
          // User logged out
          setSession(null);
          emitterRef.current.emit('logout', undefined);
          if (payload?.scope === 'global') {
            onSessionUpdate?.(null);
            emitterRef.current.emit('globalLogout', undefined);
          }
        } else if (payload?.accounts) {
          // Got accounts list - refresh session
          const newSession = await fetchSessionWithDedup();
          if (newSession) {
            emitterRef.current.emit('sessionRefresh', newSession);
          }
        }
        return;
      }

      // Handle startAuth from iframe - relay to auth start
      if (event.data?.type === 'startAuth') {
        console.log('[SSOProvider] startAuth from iframe:', event.data);
        try {
          const params = new URLSearchParams();
          
          // Get email from message (for pre-filling login form)
          if (event.data?.email) {
            params.append('email', event.data.email);
          }
          
          // Get prompt from message ('signup' for add account, 'login' for normal signin)
          const prompt = event.data?.prompt || 'login';
          params.append('prompt', prompt);
          console.log('[SSOProvider] startAuth with params:', { email: event.data?.email, prompt });
          
          const response = await fetch(
            `/api/auth/start?${params.toString()}`,
            { credentials: 'include' }
          );

          if (!response.ok) {
            throw new Error('Failed to start authentication');
          }

          const data = await response.json();
          window.location.href = data.url;
        } catch (err) {
          console.error('[SSOProvider] startAuth failed:', err);
          const error = err instanceof Error ? err : new Error('Authentication failed');
          emitterRef.current.emit('error', error);
          onError?.(error);
        }
        return;
      }

      // Handle navigate from iframe
      if (event.data?.type === 'navigate') {
        console.log('[SSOProvider] navigate:', event.data.url);
        try {
          const url = event.data?.url;
          if (url && typeof window !== 'undefined') {
            window.location.href = url;
          }
        } catch (err) {
          console.error('[SSOProvider] Navigation failed:', err);
        }
        return;
      }

      // Handle ERROR from widget
      if (event.data?.type === 'ERROR') {
        console.error('[SSOProvider] Widget error:', event.data?.error);
        const error = new Error(event.data?.error || 'Widget error');
        setError(error);
        emitterRef.current.emit('error', error);
        onError?.(error);
        return;
      }

      console.log('[SSOProvider] Unhandled message type:', event.data?.type);
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
      // Safe cleanup - only remove if it was successfully added
      if (scriptAdded && document.head.contains(script)) {
        try {
          document.head.removeChild(script);
        } catch (err) {
          console.warn('[SSOProvider] Failed to remove widget script', err);
        }
      }
    };
  }, [enableWidget, idpServer, clientId, redirectUri, scope, fetchSessionWithDedup, onSessionUpdate, onError]);

  const logout = useCallback(async () => {
    try {
      await fetch(API_PATHS.logout, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'app' }),
      });
    } catch (err) {
      console.error('[SSOProvider] Logout request failed:', err);
    }
    setSession(null);
    emitterRef.current.emit('logout', undefined);
  }, []);

  const globalLogout = useCallback(async () => {
    try {
      await fetch(API_PATHS.logout, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'global' }),
      });
    } catch (err) {
      console.error('[SSOProvider] Global logout request failed:', err);
    }
    setSession(null);
    emitterRef.current.emit('globalLogout', undefined);

    // Notify widget to propagate logout
    if (widgetFrameRef.current) {
      widgetFrameRef.current.postMessage(
        { type: 'logout' },
        idpServer
      );
    }
  }, [idpServer]);

  const refresh = useCallback(async () => {
    const newSession = await fetchSessionWithDedup();
    if (newSession) {
      onSessionUpdate?.(newSession);
      emitterRef.current.emit('sessionRefresh', newSession);
    }
    return newSession;
  }, [fetchSessionWithDedup, onSessionUpdate]);

  const switchAccount = useCallback(async (accountId: string) => {
    try {
      // Instruct widget to switch account
      if (widgetFrameRef.current) {
        widgetFrameRef.current.postMessage(
          { type: 'switchAccount', accountId },
          idpServer
        );
      }

      // Wait for switch to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Re-fetch session
      await refresh();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Account switch failed');
      setError(error);
      emitterRef.current.emit('error', error);
      onError?.(error);
    }
  }, [idpServer, refresh, onError]);

  const on = useCallback((event: any, callback: any) => {
    return emitterRef.current.on(event, callback);
  }, []);

  const signIn = useCallback(async (email?: string, prompt?: string) => {
    try {
      const params = new URLSearchParams();
      if (email) params.append('email', email);
      if (prompt) params.append('prompt', prompt);

      const response = await fetch(
        `${API_PATHS.authStart}${params.toString() ? '?' + params.toString() : ''}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Failed to start authentication');
      }

      const data = await response.json();
      window.location.href = data.url;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Sign in failed');
      setError(error);
      emitterRef.current.emit('error', error);
      onError?.(error);
    }
  }, [onError]);

  const value: SSOContextValue = {
    session,
    loading,
    error,
    signIn,
    logout,
    globalLogout,
    refresh,
    switchAccount,
    on,
  };

  return (
    <SSOContext.Provider value={value}>
      {children}
    </SSOContext.Provider>
  );
}

/**
 * Helper to get cookie value
 */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.split('=').map(c => c.trim());
    if (cookieName === name) {
      return decodeURIComponent(cookieValue);
    }
  }
  return null;
}
