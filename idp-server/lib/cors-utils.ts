import { NextRequest, NextResponse } from "next/server";
import { getAllowedWidgetOrigins, isWidgetOriginAllowed } from "@/lib/widget-origins";

/**
 * Add CORS headers to response for widget embedding.
 * Only allows credentials if the request origin is in the DB-backed allowlist.
 */
export async function addWidgetCorsHeaders(
  response: NextResponse,
  request: NextRequest
): Promise<NextResponse> {
  const origin = request.headers.get("origin");
  if (!origin) return response;

  const allowedOrigins = await getAllowedWidgetOrigins();
  if (allowedOrigins.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  return response;
}

export async function isOriginAllowed(origin: string | null): Promise<boolean> {
  return isWidgetOriginAllowed(origin);
}
