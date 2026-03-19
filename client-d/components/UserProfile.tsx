'use client';

import { useSSO } from 'pratham-sso';

export function UserProfile() {
  const { session, loading } = useSSO();
  if (loading) {
    return <div className="text-gray-500">Loading profile...</div>;
  }

  if (!session) {
    return <div className="text-gray-500">Not signed in</div>;
  }
  console.log("User session:", session);

  return (
    <div className="p-4 bg-gray-100 rounded">
      <h2 className="text-lg text-black font-semibold">{session.user.name || 'User'}</h2>
      <p className="text-sm text-gray-600">{session.user.email}</p>
      <p className="text-xs text-gray-500 mt-1">Account: {session.account.name}</p>
    </div>
  );
}
