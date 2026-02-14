'use client';

/**
 * Sign In Button for Widget
 * Initiates OAuth flow via postMessage to parent window
 */

import { useCallback } from 'react';

interface SignInButtonProps {
  className?: string;
  buttonBg?: string;
  buttonText?: string;
}

export default function SignInButton({
  className = '',
  buttonBg = 'bg-blue-600',
  buttonText = 'text-white',
}: SignInButtonProps) {
  const handleSignIn = useCallback(() => {
    try {
      console.log('[SignInButton] Sending startAuth message to parent');

      // Send message to parent window to initiate auth
      // Parent (Client-C) knows its own domain and will call /api/auth/start
      window.parent.postMessage(
        {
          type: 'startAuth',
        },
        '*' // Accept from any origin (widget can be embedded anywhere)
      );
    } catch (error) {
      console.error('[SignInButton] Error:', error);
      alert('Sign in failed. Please try again.');
    }
  }, []);

  return (
    <button
      onClick={handleSignIn}
      className={`px-6 py-2 ${buttonBg} ${buttonText} rounded-lg hover:opacity-90 text-sm font-medium transition-opacity duration-150 cursor-pointer border-none ${className}`}
    >
      Sign in
    </button>
  );
}
