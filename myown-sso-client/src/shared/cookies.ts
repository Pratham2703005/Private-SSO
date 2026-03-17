/**
 * Cookie utilities for both client and server
 */

import { DEFAULT_CONFIG, COOKIE_DEFAULTS, getSecureFlag } from './config';
import type { CookieOptions } from './types';

// Client-side cookie utilities
export const clientCookies = {
  get(name: string): string | undefined {
    if (typeof document === 'undefined') return undefined;
    
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [cookieName, cookieValue] = cookie.split('=').map(c => c.trim());
      if (cookieName === name) {
        return decodeURIComponent(cookieValue);
      }
    }
    return undefined;
  },

  set(name: string, value: string, options?: CookieOptions): void {
    if (typeof document === 'undefined') return;

    const opts: Required<CookieOptions> = {
      httpOnly: options?.httpOnly ?? COOKIE_DEFAULTS.httpOnly,
      secure: options?.secure ?? getSecureFlag(),
      sameSite: options?.sameSite ?? COOKIE_DEFAULTS.sameSite,
      maxAge: options?.maxAge ?? 0,
      path: options?.path ?? COOKIE_DEFAULTS.path,
    };

    let cookieStr = `${name}=${encodeURIComponent(value)}`;
    if (opts.maxAge > 0) {
      cookieStr += `; max-age=${opts.maxAge}`;
    }
    if (opts.sameSite) {
      cookieStr += `; samesite=${opts.sameSite}`;
    }
    if (opts.secure) {
      cookieStr += '; secure';
    }
    cookieStr += `; path=${opts.path}`;

    document.cookie = cookieStr;
  },

  delete(name: string): void {
    this.set(name, '', { maxAge: 0 });
  },

  getAll(): Record<string, string> {
    if (typeof document === 'undefined') return {};

    const cookies: Record<string, string> = {};
    document.cookie.split(';').forEach(cookie => {
      const [name, value] = cookie.split('=').map(c => c.trim());
      if (name) {
        cookies[name] = decodeURIComponent(value);
      }
    });
    return cookies;
  },
};

// Server-side cookie formatting
export const serverCookies = {
  serialize(name: string, value: string, options?: CookieOptions): string {
    const opts: Required<CookieOptions> = {
      httpOnly: options?.httpOnly ?? COOKIE_DEFAULTS.httpOnly,
      secure: options?.secure ?? getSecureFlag(),
      sameSite: options?.sameSite ?? COOKIE_DEFAULTS.sameSite,
      maxAge: options?.maxAge ?? 0,
      path: options?.path ?? COOKIE_DEFAULTS.path,
    };

    let cookieStr = `${name}=${encodeURIComponent(value)}`;
    if (opts.maxAge) {
      cookieStr += `; Max-Age=${opts.maxAge}`;
    }
    if (opts.sameSite) {
      cookieStr += `; SameSite=${opts.sameSite}`;
    }
    if (opts.secure) {
      cookieStr += '; Secure';
    }
    cookieStr += `; Path=${opts.path}`;
    if (opts.httpOnly) {
      cookieStr += '; HttpOnly';
    }

    return cookieStr;
  },

  parse(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.split('=').map(c => c.trim());
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });
    return cookies;
  },
};
