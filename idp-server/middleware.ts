import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Allowed client origins for widget embedding
const ALLOWED_WIDGET_ORIGINS = [
  'https://client-a.com',
  'https://client-b.com',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
];

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const pathname = req.nextUrl.pathname;

  // Set CSP headers for widget pages to prevent embedding in unauthorized origins
  if (pathname === '/widget/account-switcher') {
    const allowedOrigins = ALLOWED_WIDGET_ORIGINS.join(' ');

    // Content-Security-Policy: frame-ancestors restricts which origins can embed this page
    // This prevents clickjacking and ensures widget is only embedded in authorized clients
    res.headers.set(
      'Content-Security-Policy',
      `frame-ancestors ${allowedOrigins} 'self'`
    );

    // Additional security headers
    res.headers.set('X-Frame-Options', 'ALLOWALL'); // CSP takes precedence
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('X-XSS-Protection', '1; mode=block');
    
    console.log(`[Middleware] Widget CSP applied to ${pathname}`);
  } else {
    // For all non-widget pages, prevent framing
    res.headers.set('Content-Security-Policy', "frame-ancestors 'none'");
    res.headers.set('X-Frame-Options', 'DENY');
  }

  // CORS headers for widget.js script
  if (pathname === '/api/widget.js') {
    res.headers.set('Access-Control-Allow-Origin', '*');
    res.headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  }

  return res;
}

export const config = {
  matcher: [
    // Apply to widget routes
    '/widget/:path*',
    '/api/widget.js',
    // Skip Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
