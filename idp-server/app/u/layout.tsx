'use client';

import { useEffect } from 'react';
import { initAuthTheme } from '@/lib/auth-theme';

export default function ULayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    initAuthTheme();
  }, []);

  return <>{children}</>;
}
