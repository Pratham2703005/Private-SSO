import { NextResponse } from "next/server";
import { getAllowedWidgetOrigins } from "@/lib/widget-origins";

export async function proxy(req: Request) {
  const url = new URL(req.url);
  const pathname = url.pathname;

  const res = NextResponse.next();

  if (pathname.startsWith("/widget/")) {
    const origins = await getAllowedWidgetOrigins();
    const allowed = origins.join(" ");
    res.headers.set(
      "Content-Security-Policy",
      `frame-ancestors 'self'${allowed ? " " + allowed : ""}`
    );

    if (pathname === "/widget/account-switcher") {
      res.headers.set("X-Content-Type-Options", "nosniff");
    }
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
