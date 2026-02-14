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
  let cancelled = false;

  const checkAndAutoLogin = async () => {
    try {
      const userRes = await fetch("/api/user");
      if (userRes.ok) {
        console.log("[LoginPage] ✅ Already authenticated, redirecting to dashboard");
        router.push("/dashboard");
        return;
      }

      console.log("[LoginPage] Attempting silent login...");
      window.location.href = "/api/auth/silent-login";
    } catch (err) {
      console.log("[LoginPage] Error during check:", err);
      if (!cancelled) Promise.resolve().then(() => setLoading(false));
    }
  };

  const errorParam = searchParams.get("error");
  if (errorParam) {
    console.log("[LoginPage] Silent login failed, showing login form");
    Promise.resolve().then(() => setLoading(false));
    return;
  }

  checkAndAutoLogin();

  return () => {
    cancelled = true;
  };
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
      <h1>Client B Login</h1>
      {error && (
        <div style={{ color: 'red', marginBottom: '20px', padding: '10px', backgroundColor: '#ffeeee', borderRadius: '4px' }}>
          {error}
        </div>
      )}
      <p>Login via SSO</p>
      <button
        onClick={handleLogin}
        disabled={loading}
        style={{
          padding: '10px 20px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '16px',
        }}
      >
        {loading ? 'Logging in...' : 'Login with IDP'}
      </button>
    </div>
  );
}
