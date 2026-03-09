'use client';

import { useLayoutEffect } from 'react';

export function ThemeProvider() {
  useLayoutEffect(() => {
    // Handle theme changes after hydration (e.g., from theme switcher)
    const html = document.documentElement;
    const theme = localStorage.getItem('auth-theme');
    
    if (theme === 'system' || !theme) {
      html.removeAttribute('data-theme');
    } else {
      html.setAttribute('data-theme', theme);
    }
  }, []);

  return null;
}
