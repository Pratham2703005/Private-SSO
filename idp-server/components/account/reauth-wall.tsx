"use client";

import Link from "next/link";

interface ReauthWallProps {
  name: string;
  maskedEmail: string;
  email: string;
  initial: string;
  returnTo?: string;
}

/**
 * Shown when a user navigates to /u/{index} for an account that exists in
 * their jar cookie but is NOT in the current active session (needs_reauth).
 * 
 * Google-style: shows minimal identity + "Sign in again" prompt.
 * Does NOT show full profile for signed-out accounts.
 */
export function ReauthWall({ name, maskedEmail, email, initial, returnTo }: ReauthWallProps) {
  let loginUrl = `/login?login_hint=${encodeURIComponent(email)}`;
  if (returnTo) {
    loginUrl += `&return_to=${encodeURIComponent(returnTo)}`;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-10 pb-6 text-center">
          {/* Avatar circle with initial */}
          <div className="mx-auto mb-6 w-20 h-20 rounded-full bg-linear-to-br from-gray-300 to-gray-400 flex items-center justify-center text-white text-3xl font-semibold opacity-70">
            {initial}
          </div>

          {/* Lock icon */}
          <div className="mb-4 flex justify-center">
            <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-amber-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Session expired
          </h2>
          <p className="text-sm text-gray-500 mb-1">
            {name.split(" ")[0]}&apos;s account
          </p>
          <p className="text-sm text-gray-400">
            {maskedEmail}
          </p>
        </div>

        {/* Action */}
        <div className="px-8 pb-8">
          <Link
            href={loginUrl}
            className="block w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg text-center transition-colors duration-200"
          >
            Sign in again
          </Link>

          <p className="mt-4 text-xs text-gray-400 text-center">
            Your session for this account has expired. Sign in to continue.
          </p>
        </div>
      </div>
    </div>
  );
}
