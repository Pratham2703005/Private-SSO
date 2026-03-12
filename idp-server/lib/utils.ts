import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function setMasterCookie(response: NextResponse, sessionId: string) {
  const maxAge = parseInt(process.env.MASTER_COOKIE_MAX_AGE || "604800");
  const isProduction = process.env.NODE_ENV === "production";
  const cookieDomain = process.env.IDP_COOKIE_DOMAIN || "";

  const cookieOptions: any = {
    name: "__sso_session",
    value: sessionId,
    httpOnly: true,
    // In development on localhost with different ports: use "Lax" to allow cross-port same-site cookies
    // In production with HTTPS and proper domains: use "none" for true cross-site SSO
    secure: isProduction, // Only require HTTPS in production
    sameSite: isProduction ? "none" : "Lax", // Lax for localhost dev, none for production
    maxAge: maxAge,
    path: "/",
  };

  // Only set domain if explicitly configured (for production)
  if (cookieDomain) {
    cookieOptions.domain = cookieDomain;
  }

  console.log("[SetMasterCookie] Setting cookie:", {
    sessionId: sessionId.substring(0, 16) + "...",
    domain: cookieDomain || "(not set - localhost dev mode)",
    sameSite: isProduction ? "none" : "Lax",
    secure: isProduction,
    httpOnly: true,
    maxAge: maxAge,
  });

  response.cookies.set(cookieOptions);
  return response;
}

export function clearMasterCookie(response: NextResponse) {
  const isProduction = process.env.NODE_ENV === "production";
  const cookieDomain = process.env.IDP_COOKIE_DOMAIN || "";

  const cookieOptions: any = {
    name: "__sso_session",
    value: "",
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "Lax", // Lax for localhost dev, none for production
    maxAge: 0,
    path: "/",
  };

  // Only set domain if explicitly configured (for production)
  if (cookieDomain) {
    cookieOptions.domain = cookieDomain;
  }

  response.cookies.set(cookieOptions);
  return response;
}

export function getMasterCookie(request: NextRequest): string | null {
  return request.cookies.get("__sso_session")?.value || null;
}

export function  hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateState(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function parseRegisteredClients(): Record<string, string> {
  const clientsStr = process.env.REGISTERED_CLIENTS || "";
  const clients: Record<string, string> = {};

  clientsStr.split(" ").forEach((pair) => {
    const [clientId, secret] = pair.split(":");
    if (clientId && secret) {
      clients[clientId] = secret;
    }
  });

  return clients;
}

export function validateClientSecret(
  clientId: string,
  clientSecret: string
): boolean {
  const clients = parseRegisteredClients();
  return clients[clientId] === clientSecret;
}
