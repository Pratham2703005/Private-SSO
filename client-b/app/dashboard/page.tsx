'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AccountSwitcher from '@/app/components/AccountSwitcher';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        console.log('[Dashboard] Fetching user from /api/user');
        const response = await fetch('/api/user');

        if (response.status === 401) {
          console.log('[Dashboard] ❌ Not authenticated, redirecting to login');
          router.push('/login');
          return;
        }

        if (!response.ok) {
          console.log('[Dashboard] ❌ Error fetching user:', response.status);
          setError('Failed to fetch user data');
          setLoading(false);
          return;
        }

        const data = await response.json();
        console.log('[Dashboard] ✅ Got user:', data);
        if (data.success && data.data) {
          setUser(data.data);
        } else {
          setError('Invalid response from server');
        }
      } catch (err) {
        console.error('[Dashboard] Error:', err);
        setError('Error fetching user data');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [router, refreshKey]);

  const handleLogout = async (isGlobal: boolean = false) => {
    try {
      console.log('[Dashboard] Logging out (global=' + isGlobal + ')...');
      const logoutUrl = isGlobal ? '/api/auth/logout?global=true' : '/api/auth/logout';
      const res = await fetch(logoutUrl, { method: 'POST' });
      if (res.ok) {
        console.log('[Dashboard] ✅ Logout successful');
      }
    } catch (err) {
      console.error('[Dashboard] Logout error:', err);
    }
    router.push('/login');
  };

  const handleAccountSwitch = () => {
    // Refresh user data after account switch
    setRefreshKey(prev => prev + 1);
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>Loading...</h1>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <h1>Error</h1>
        <p style={{ color: 'red' }}>{error}</p>
        <button onClick={() => router.push('/login')}>Back to Login</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Client B Dashboard</h1>
        {user && <AccountSwitcher currentUser={user} onAccountSwitch={handleAccountSwitch} />}
      </div>
      
      {user ? (
        <>
          <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0e8f4', borderRadius: '4px' }}>
            <h2>Welcome, {user.name || user.email}!</h2>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>User ID:</strong> {user.id}</p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => handleLogout(false)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#ffc107',
                color: '#000',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px',
              }}
            >
              Logout (Local)
            </button>

            <button
              onClick={() => handleLogout(true)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px',
              }}
            >
              Logout (Global)
            </button>
          </div>
        </>
      ) : (
        <p>No user data. Redirecting to login...</p>
      )}
    </div>
  );
}
