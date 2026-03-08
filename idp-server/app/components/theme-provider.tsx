'use client';

import { useLayoutEffect } from 'react';

export function ThemeProvider() {
  useLayoutEffect(() => {
    // Ensure HTML element exists
    const html = document.documentElement;
    
    // Apply theme before first paint
    const theme = localStorage.getItem('auth-theme') || 'light';
    if (theme === 'system') {
      html.removeAttribute('data-theme');
    } else {
      html.setAttribute('data-theme', theme);
    }
    
    // Remove loading state to allow transitions
    html.removeAttribute('data-theme-loading');
  }, []);

  return null;
}
