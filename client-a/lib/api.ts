import axios from "axios";

// API client for calling our own backend (not IDP directly)
// Token management is handled server-side in HttpOnly cookies
const api = axios.create({
  baseURL: "/api", // Call our own backend
  withCredentials: true,
});

export async function getAuthorizeUrl(): Promise<string> {
  try {
    // Call server-side endpoint that generates PKCE and sets verifier cookie
    const response = await fetch("/api/auth/start", {
      method: "GET",
      credentials: "include", // Ensure cookie is set
    });

    if (!response.ok) {
      throw new Error(`Failed to get authorize URL: ${response.statusText}`);
    }

    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error("Failed to get authorize URL:", error);
    throw error;
  }
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
