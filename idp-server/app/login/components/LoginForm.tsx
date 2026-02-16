"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get login_hint (email) from URL if provided
  const loginHint = searchParams.get("login_hint") || "";
  
  const [formData, setFormData] = useState({
    email: loginHint,
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Get OAuth parameters from URL
  const getOAuthParams = () => {
    const params: Record<string, string> = {};
    const oauthKeys = [
      "client_id",
      "redirect_uri",
      "response_type",
      "scope",
      "state",
      "code_challenge",
      "code_challenge_method",
      "login_hint",
    ];

    oauthKeys.forEach((key) => {
      const value = searchParams.get(key);
      if (value) {
        params[key] = value;
      }
    });

    return params;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (error) setError("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
        credentials: "include", // Include cookies
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      // Success - determine where to redirect
      const returnTo = searchParams.get("return_to");
      const oauthParams = getOAuthParams();
      
      // Check return_to FIRST (widget return takes priority)
      if (returnTo) {
        // Check if return_to is a widget URL (on IDP domain)
        try {
          const returnUrl = new URL(returnTo, window.location.origin);
          // If return_to is a widget URL on this origin, redirect directly
          if (returnUrl.origin === window.location.origin) {
            console.log('[LoginForm] Redirecting to widget (same origin):', returnTo);
            window.location.href = returnTo;
          } else {
            // Cross-origin return_to - assume it's a client app
            // Redirect to client's /api/auth/start to initiate OAuth flow
            console.log('[LoginForm] Redirecting to client app:', returnTo);
            const url = new URL("/api/auth/start", returnTo);
            window.location.href = url.toString();
          }
        } catch {
          // If return_to is invalid, redirect to it anyway
          console.log('[LoginForm] Redirecting to return_to (fallback):', returnTo);
          window.location.href = returnTo;
        }
      } else if (Object.keys(oauthParams).length > 0) {
        // OAuth2 flow - redirect back to authorize endpoint
        const authorizeUrl = new URL("/api/auth/authorize", window.location.origin);
        Object.entries(oauthParams).forEach(([key, value]) => {
          authorizeUrl.searchParams.set(key, value);
        });
        window.location.href = authorizeUrl.toString();
      } else {
        // Direct IDP login - redirect to dashboard
        router.push("/dashboard");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold mb-2 text-gray-800">Log In</h1>
        <p className="text-gray-600 mb-6">Access your account</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        {/* Sign Up Link */}
        <div className="mt-6 text-center">
          <p className="text-gray-600 text-sm">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-medium">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
