import { NextResponse } from "next/server";

const ALLOWED_WIDGET_ORIGINS = [
  "https://client-a.com",
  "https://client-b.com",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003",
];

export function proxy(req: Request) {
  const url = new URL(req.url);
  const pathname = url.pathname;

  const res = NextResponse.next();

  if (pathname === "/widget/account-switcher") {
    const allowed = ALLOWED_WIDGET_ORIGINS.join(" ");

    res.headers.set(
      "Content-Security-Policy",
      `frame-ancestors 'self' ${allowed}`
    );

    res.headers.set("X-Content-Type-Options", "nosniff");
  } else if (pathname.startsWith("/widget/")) {
    // other widget pages (if any)
    const allowed = ALLOWED_WIDGET_ORIGINS.join(" ");

    res.headers.set(
      "Content-Security-Policy",
      `frame-ancestors 'self' ${allowed}`
    );
  } else {
    res.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  }

  if (pathname === "/api/widget.js") {
    res.headers.set("Access-Control-Allow-Origin", "*");
    res.headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  }

  return res;
}

export const config = {
  matcher: [
    "/widget/:path*",
    "/api/widget.js",
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
