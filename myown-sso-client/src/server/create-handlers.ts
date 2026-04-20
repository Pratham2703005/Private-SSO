import type { HandleCallbackConfig, HandleLogoutConfig, StartAuthConfig, ValidateSessionConfig } from '../shared';
import { startAuth } from './start-auth';
import { handleCallback } from './callback';
import { validateSession } from './validate-session';
import { handleLogout } from './handle-logout';

export interface CreateSSORouteHandlersConfig {
  clientId?: string;
  clientSecret?: string;
  idpServer?: string;
  redirectUri?: string;
  oauthSecret?: string;
  onSessionEstablished?: HandleCallbackConfig['onSessionEstablished'];
}

interface ResolvedConfig {
  clientId: string;
  clientSecret?: string;
  idpServer: string;
  redirectUri: string;
  oauthSecret: string;
}

function readEnv(name: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    const value = process.env[name];
    if (value && value.length > 0) return value;
  }
  return undefined;
}

function resolveConfig(partial: CreateSSORouteHandlersConfig): ResolvedConfig {
  const clientId = partial.clientId ?? readEnv('NEXT_PUBLIC_CLIENT_ID');
  const idpServer = partial.idpServer ?? readEnv('NEXT_PUBLIC_IDP_SERVER');
  const redirectUri = partial.redirectUri ?? readEnv('NEXT_PUBLIC_REDIRECT_URI');
  const oauthSecret = partial.oauthSecret ?? readEnv('OAUTH_SECRET');
  const clientSecret = partial.clientSecret ?? readEnv('CLIENT_SECRET');

  const missing: string[] = [];
  if (!clientId) missing.push('clientId (or NEXT_PUBLIC_CLIENT_ID env)');
  if (!idpServer) missing.push('idpServer (or NEXT_PUBLIC_IDP_SERVER env)');
  if (!redirectUri) missing.push('redirectUri (or NEXT_PUBLIC_REDIRECT_URI env)');
  if (!oauthSecret) missing.push('oauthSecret (or OAUTH_SECRET env)');

  if (missing.length > 0) {
    throw new Error(
      `[pratham-sso] Missing required SSO configuration: ${missing.join(', ')}. ` +
        `Pass them to createSSORouteHandlers() or set the corresponding environment variables.`
    );
  }

  return {
    clientId: clientId!,
    clientSecret,
    idpServer: idpServer!,
    redirectUri: redirectUri!,
    oauthSecret: oauthSecret!,
  };
}

/**
 * Build all four SSO route handlers from a single config.
 * Usage:
 *   const sso = createSSORouteHandlers()  // reads env vars
 *   export const GET = sso.startAuth      // in /api/auth/start/route.ts
 */
export function createSSORouteHandlers(config: CreateSSORouteHandlersConfig = {}) {
  const resolved = resolveConfig(config);

  const startConfig: StartAuthConfig = {
    clientId: resolved.clientId,
    idpServer: resolved.idpServer,
    redirectUri: resolved.redirectUri,
    oauthSecret: resolved.oauthSecret,
  };

  const callbackConfig: HandleCallbackConfig = {
    clientId: resolved.clientId,
    clientSecret: resolved.clientSecret,
    idpServer: resolved.idpServer,
    redirectUri: resolved.redirectUri,
    oauthSecret: resolved.oauthSecret,
    onSessionEstablished: config.onSessionEstablished,
  };

  const validateConfig: ValidateSessionConfig = {
    clientId: resolved.clientId,
    idpServer: resolved.idpServer,
    oauthSecret: resolved.oauthSecret,
  };

  const logoutConfig: HandleLogoutConfig = {
    clientId: resolved.clientId,
    idpServer: resolved.idpServer,
  };

  return {
    startAuth: startAuth(startConfig),
    handleCallback: handleCallback(callbackConfig),
    validateSession: validateSession(validateConfig),
    handleLogout: handleLogout(logoutConfig),
    config: resolved,
  };
}
