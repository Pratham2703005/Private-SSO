'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const checkAndAutoLogin = async () => {
      try {
        // Check if already authenticated locally
        const userRes = await fetch('/api/user');
        if (userRes.ok) {
          console.log('[LoginPage] ✅ Already authenticated, redirecting to dashboard');
          router.push('/dashboard');
          return;
        }

        // Attempt silent login (redirect to IDP authorize endpoint)
        // If user has IDP session, they will be auto-approved
        // If not, IDP will show login form
        console.log('[LoginPage] Attempting silent login...');
        window.location.href = '/api/auth/silent-login';
        return;
      } catch (err) {
        console.log('[LoginPage] Error during check:', err);
        setLoading(false);
      }
    };

    // Check for error in URL
    const errorParam = searchParams.get('error');
    if (errorParam) {
      // Silent login failed, show login form instead
      console.log('[LoginPage] Silent login failed, showing login form');
      setLoading(false);
      return;
    }

    checkAndAutoLogin();
  }, [router, searchParams]);

  const handleLogin = async () => {
    try {
      setLoading(true);
      // Call the /api/auth/start endpoint to get the authorize URL
      const res = await fetch('/api/auth/start');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError('Failed to initiate login');
        setLoading(false);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to initiate login');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', maxWidth: '400px', margin: '50px auto', textAlign: 'center' }}>
        <h1>Checking authentication...</h1>
        <p>Please wait...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: '50px auto', textAlign: 'center' }}>
      <h1>Client A Login</h1>
      {error && (
        <div style={{ color: 'red', marginBottom: '20px', padding: '10px', backgroundColor: '#ffeeee', borderRadius: '4px' }}>
          {error}
        </div>
      )}
      <p>Login via SSO</p>
      <button
        onClick={handleLogin}
        style={{
          padding: '10px 20px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '16px',
        }}
      >
        Login with IDP
      </button>
    </div>
  );
}
