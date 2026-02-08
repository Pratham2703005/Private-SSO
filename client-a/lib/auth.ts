/**
 * ✅ CORRECT SSO Architecture
 * 
 * Access tokens are stored SERVER-SIDE only, in HttpOnly cookie
 * Client NEVER owns or accesses the access token
 * 
 * Client only has: app_session cookie (HttpOnly)
 * 
 * All user data comes from /api/user endpoint (which uses the server-side token)
 */

export const USER_KEY = "sso_user";

export function getUser(): any {
  if (typeof window === "undefined") return null;
  const user = sessionStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
}

export function setUser(user: any): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(USER_KEY);
  // App session cookie and refresh token cookie will be cleared server-side on logout
}

export async function logout(): Promise<void> {
  try {
    // Call logout endpoint to clear server-side session
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    
    if (response.ok) {
      // Clear client-side data
      clearAuth();
      console.log("[Auth] ✅ Logout successful");
    } else {
      console.error("[Auth] ❌ Logout failed:", response.status);
    }
  } catch (error) {
    console.error("[Auth] ❌ Logout error:", error);
    // Still clear local auth even if logout API fails
    clearAuth();
  }
}

export function isAuthenticated(): boolean {
  // Check if app_session cookie exists
  // (Can't directly check from client-side JS since it's HttpOnly,
  // so we check if we have user data, or make an API call to /api/user)
  return getUser() !== null;
}

