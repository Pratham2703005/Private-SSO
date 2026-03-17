'use client';

import { useSSO } from 'pratham-sso';

export function LoginButton() {
  const { session, loading, signIn, logout } = useSSO();

  if (loading) {
    return (
      <button disabled className="px-4 py-2 bg-gray-300 text-gray-600 rounded cursor-not-allowed">
        Loading...
      </button>
    );
  }

  if (session) {
    return (
      <button
        onClick={() => logout()}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
      >
        Sign Out
      </button>
    );
  }

  return (
    <button
      onClick={() => signIn()}
      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
    >
      Sign In
    </button>
  );
}
