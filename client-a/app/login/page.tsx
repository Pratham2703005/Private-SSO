'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [idpUrl, setIdpUrl] = useState('');
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        'csrf_validation_failed': 'Security validation failed. Please try again.',
        'missing_access_token': 'Login incomplete. Please try again.',
        'invalid_token': 'Invalid token received. Please try again.',
        'callback_failed': 'Callback processing failed. Please try again.',
      };
      setError(errorMessages[errorParam] || `Error: ${errorParam}`);
      setIsChecking(false);
      return;
    }

    async function checkAuthentication() {
      try {
        const IDP_SERVER = process.env.NEXT_PUBLIC_IDP_SERVER || "http://localhost:3000";
        const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID || "client-a";
        const REDIRECT_URI = process.env.NEXT_PUBLIC_REDIRECT_URI || "http://localhost:3001/api/auth/callback";

        console.log('[LoginPage] Checking local authentication...');
        let response = await fetch('/api/user');

        if (response.ok) {
          console.log('[LoginPage] ✅ User already authenticated locally, redirecting to dashboard');
          router.push('/dashboard');
          return;
        }

        console.log('[LoginPage] Checking IDP for existing session...');
        try {
          const idpResponse = await fetch(`${IDP_SERVER}/api/auth/token?check=true`, {
            credentials: 'include',
          });

          if (idpResponse.ok) {
            const data = await idpResponse.json();
            if (data.success && data.accessToken) {
              console.log('[LoginPage] ✅ Found valid IDP session, auto-logging in...');
              const callbackResponse = await fetch('/api/auth/callback?access_token=' + encodeURIComponent(data.accessToken));
              if (callbackResponse.ok) {
                console.log('[LoginPage] ✅ Session established, redirecting to dashboard');
                router.push('/dashboard');
                return;
              }
            }
          }
        } catch (idpError) {
          console.log('[LoginPage] IDP check error (expected if not logged in):', idpError);
        }

        const state = Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        
        // Store state for CSRF validation in callback
        if (typeof window !== 'undefined') {
          try {
            const { storeState } = await import('@/lib/state-store');
            storeState(state);
          } catch (e) {
            console.log('[LoginPage] State store load error:', e);
          }
        }

        const authorizeUrl = `${IDP_SERVER}/api/auth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${state}&scopes=profile,email`;
        setIdpUrl(authorizeUrl);
      } catch (error) {
        console.error('[LoginPage] Error during authentication check:', error);
        setError('Error checking authentication');
      } finally {
        setIsChecking(false);
      }
    }

    checkAuthentication();
  }, [router, searchParams]);

  if (isChecking) {
    return (
      <div style={{ padding: '20px', maxWidth: '400px', margin: '50px auto', textAlign: 'center' }}>
        <h1>Client-A - Checking Authentication...</h1>
        <p>Please wait...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: '50px auto', textAlign: 'center' }}>
      <h1>Client-A - Login</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <p>Click below to login via SSO</p>
      {idpUrl && (
        <a
          href={idpUrl}
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Login with IDP Server
        </a>
      )}
    </div>
  );
}
