import { LoginButton } from '@/components/LoginButton';
import { UserProfile } from '@/components/UserProfile';

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-blue-100">
      <main className="flex flex-col items-center gap-8 p-8 bg-white rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-3xl font-bold text-center text-blue-900">
          Pratham SSO
        </h1>
        <p className="text-center text-gray-600">
          Single Sign-On Integration Demo
        </p>

        <div className="w-full">
          <UserProfile />
        </div>

        <div className="w-full">
          <LoginButton />
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">Features</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>✓ OAuth2 with PKCE</li>
            <li>✓ Secure session management</li>
            <li>✓ Multi-account support</li>
            <li>✓ Cross-tab synchronization</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
