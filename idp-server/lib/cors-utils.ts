import { NextRequest, NextResponse } from 'next/server';
import { WIDGET_ALLOWED_CLIENTS } from '@/config/widget-clients';

/**
 * Get allowed widget origins from configuration and environment
 * 
 * Priority order:
 * 1. WIDGET_ALLOWED_CLIENTS config (if available)
 * 2. ALLOWED_WIDGET_ORIGINS environment variable
 * 3. Sensible development defaults
 * 
 * Environment variable: ALLOWED_WIDGET_ORIGINS
 * Format: "http://localhost:3003,https://client.example.com"
 */
function getAllowedWidgetOrigins(): string[] {
  // First, try the config-based allowlist
  const configOrigins = WIDGET_ALLOWED_CLIENTS?.map(c => c.origin);
  if (configOrigins && configOrigins.length > 0) {
    return configOrigins;
  }

  // Second, environment variable (for external configuration)
  const envOrigins = process.env.ALLOWED_WIDGET_ORIGINS;
  if (envOrigins) {
    return envOrigins.split(',').map(origin => origin.trim()).filter(Boolean);
  }

  // Third, development defaults - all localhost ports for testing
  const isDevelopment = process.env.NODE_ENV !== 'production';
  if (isDevelopment) {
    return [
      'http://localhost:3000',  // IDP server
      'http://localhost:3001',  // Client app (alt)
      'http://localhost:3002',  // Client app (alt)
      'http://localhost:3003',  // Client app (default)
      'http://localhost:3004',  // Client app (client-d)
    ];
  }

  // Production: no default, must be explicitly configured
  return [];
}

/**
 * Add CORS headers to response for widget embedding
 * 
 * Uses allowlist approach with exact origin matching
 * Only allows credentials if origin is in allowlist
 */
export function addWidgetCorsHeaders(
  response: NextResponse,
  request: NextRequest
): NextResponse {
  const origin = request.headers.get('origin');

  if (!origin) {
    return response;
  }

  const allowedOrigins = getAllowedWidgetOrigins();

  // Only set CORS headers if origin is in allowlist (exact match)
  if (allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  return response;
}

/**
 * Utility to check if origin is allowed
 * Used for postMessage and other cross-origin checks
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) {
    return false;
  }

  const allowedOrigins = getAllowedWidgetOrigins();
  return allowedOrigins.includes(origin);
}
