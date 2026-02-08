'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      try {
        // First, check if already authenticated locally
        const res = await fetch('/api/user');
        if (res.ok) {
          router.push('/dashboard');
          return;
        }

        // If not authenticated, redirect to login
        // The login page will handle auto-login via client-side redirect to IDP
        router.push('/login');
      } catch {
        router.push('/login');
      }
    };
    checkAuth();
  }, [router]);

  return (
    <div style={{ padding: '20px', textAlign: 'center', marginTop: '50px' }}>
      <h1>Client B</h1>
      <p>Redirecting...</p>
    </div>
  );
}