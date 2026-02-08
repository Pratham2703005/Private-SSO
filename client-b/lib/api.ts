import axios from "axios";
import { storeState } from "./state-store";

const IDP_SERVER = process.env.NEXT_PUBLIC_IDP_SERVER || "http://localhost:3000";
const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID || "client-b";
const REDIRECT_URI =
  process.env.NEXT_PUBLIC_REDIRECT_URI || "http://localhost:3002/api/auth/callback";

// API client for calling our own backend (not IDP directly)
// Token management is handled server-side in HttpOnly cookies
const api = axios.create({
  baseURL: "/api", // Call our own backend
  withCredentials: true,
});

export function getAuthorizeUrl(): string {
  // Generate and store state for CSRF protection
  const state = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  storeState(state);
  
  return `${IDP_SERVER}/api/auth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${state}&scopes=profile,email`;
}

export async function logout() {
  try {
    await api.post("/auth/logout");
  } catch (error) {
    console.error("Logout error:", error);
  }
}

export async function getUser() {
  try {
    const response = await api.get("/user");
    return response.data.data;
  } catch (error) {
    console.error("Failed to fetch user:", error);
    return null;
  }
}

export default api;
