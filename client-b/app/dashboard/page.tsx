'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, setUser, clearAuth } from '@/lib/auth';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUserState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Step 1: Check if user is in sessionStorage
        let cachedUser = getUser();
        if (cachedUser) {
          console.log('[Dashboard] ✅ User found in sessionStorage');
          setUserState(cachedUser);
          setLoading(false);
          return;
        }

        // Step 2: Fetch user from backend API (which uses server-side access token)
        console.log('[Dashboard] Fetching user from /api/user');
        const response = await fetch('/api/user');

        if (response.status === 401) {
          // Not authenticated, redirect to login
          console.log('[Dashboard] ❌ Not authenticated, redirecting to login');
          router.push('/login');
          return;
        }

        if (!response.ok) {
          console.log('[Dashboard] ❌ Error fetching user:', response.status);
          router.push('/login');
          return;
        }

        const data = await response.json();
        if (data.success && data.data) {
          console.log('[Dashboard] ✅ Got user from API, caching in sessionStorage');
          setUser(data.data);
          setUserState(data.data);
        } else {
          console.log('[Dashboard] ❌ Invalid response from /api/user');
          router.push('/login');
          return;
        }
      } catch (error) {
        console.log('[Dashboard] ❌ Error checking auth:', error);
        router.push('/login');
        return;
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);
  const handleLogout = async () => {
    try {
      // Call logout endpoint (you'll need to create this)
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    // Clear client-side data
    clearAuth();
    router.push('/login');
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Client-B Dashboard</h1>
      
      {user ? (
        <>
          <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f0f0f0' }}>
            <h2>Welcome, {user.name}!</h2>
            <p>Email: {user.email}</p>
            <p>User ID: {user.id}</p>
          </div>

          <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#e0f0ff' }}>
            <p>You are authenticated on Client-B via IDP Server SSO</p>
          </div>

          <button
            onClick={handleLogout}
            style={{
              padding: '10px 20px',
              backgroundColor: '#ff4444',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Logout from Client-B
          </button>
        </>
      ) : (
        <p>Not authenticated. Redirecting to login...</p>
      )}
    </div>
  );
}
