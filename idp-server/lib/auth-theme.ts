/**
 * Theme Management for Auth Pages
 * 
 * CHANGE DEFAULT THEME HERE:
 * Set DEFAULT_THEME to 'light' or 'dark' to change the initial theme everywhere
 */

export type AuthTheme = 'dark' | 'light' | 'system';

const DEFAULT_THEME: AuthTheme = 'light'; // ← Change this to switch initial theme

export function setAuthTheme(theme: AuthTheme) {
  if (typeof document === 'undefined') return;

  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }

  localStorage.setItem('auth-theme', theme);
}

export function getAuthTheme(): AuthTheme {
  if (typeof document === 'undefined') return DEFAULT_THEME;

  const stored = localStorage.getItem('auth-theme') as AuthTheme | null;
  if (stored) return stored;

  return DEFAULT_THEME;
}

export function initAuthTheme() {
  if (typeof document === 'undefined') return;

  const theme = getAuthTheme();
  setAuthTheme(theme);
}
