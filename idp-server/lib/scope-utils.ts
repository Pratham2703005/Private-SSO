/**
 * Scope Utility Functions for OAuth 2.0 / OIDC
 * 
 * These functions help with scope validation and enforcement
 * across API endpoints.
 */

/**
 * Check if a token has a specific scope
 * 
 * @param tokenScopes - Array of scopes from decoded JWT
 * @param required - Required scope to check
 * @returns true if token has the scope, false otherwise
 * 
 * @example
 * if (hasScope(token.scopes, "profile")) {
 *   // Include profile data
 * }
 */
export function hasScope(
  tokenScopes: string[],
  required: string
): boolean {
  return tokenScopes.includes(required);
}

/**
 * Enforce that a token has a specific scope
 * 
 * Throws an error if the scope is missing. Use this in API
 * endpoint middleware to protect resources.
 * 
 * @param tokenScopes - Array of scopes from decoded JWT
 * @param required - Required scope that must be present
 * @throws Error with message "insufficient_scope" if scope missing
 * 
 * @example
 * requireScope(token.scopes, "profile");  // Throws if profile scope missing
 */
export function requireScope(
  tokenScopes: string[],
  required: string
): void {
  if (!tokenScopes.includes(required)) {
    throw new Error("insufficient_scope");
  }
}

/**
 * Check if a token has all required scopes
 * 
 * @param tokenScopes - Array of scopes from decoded JWT
 * @param required - Array of required scopes
 * @returns true if token has ALL scopes, false otherwise
 * 
 * @example
 * if (hasScopeAll(token.scopes, ["openid", "profile", "email"])) {
 *   // User has all three scopes
 * }
 */
export function hasScopeAll(
  tokenScopes: string[],
  required: string[]
): boolean {
  return required.every((scope) => tokenScopes.includes(scope));
}

/**
 * Check if a token has any of the required scopes
 * 
 * @param tokenScopes - Array of scopes from decoded JWT
 * @param required - Array of scopes (any can match)
 * @returns true if token has ANY of the scopes, false otherwise
 * 
 * @example
 * if (hasScopeAny(token.scopes, ["profile", "openid"])) {
 *   // User has at least one of these scopes
 * }
 */
export function hasScopeAny(
  tokenScopes: string[],
  required: string[]
): boolean {
  return required.some((scope) => tokenScopes.includes(scope));
}

/**
 * Get the intersection of requested and allowed scopes
 * 
 * Returns only the scopes that exist in both arrays.
 * Useful for downscoping tokens on refresh.
 * 
 * @param requested - Scopes requested by client
 * @param allowed - Scopes allowed for this client
 * @returns Intersection of both arrays
 * 
 * @example
 * const grantedScopes = filterScopes(
 *   ["openid", "profile", "email", "admin"],
 *   ["openid", "profile", "email"]
 * );
 * // Returns: ["openid", "profile", "email"]
 */
export function filterScopes(
  requested: string[],
  allowed: string[]
): string[] {
  return requested.filter((scope) => allowed.includes(scope));
}
