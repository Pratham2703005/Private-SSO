'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { initAuthTheme } from '@/lib/auth-theme';
import { AuthCard } from '@/app/components/auth/AuthCard';
import { AuthInput } from '@/app/components/auth/AuthInput';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize step based on login_hint (reauthentication flow)
  const loginHint = searchParams.get('login_hint');
  const [step, setStep] = useState<'email' | 'password'>(loginHint ? 'password' : 'email');
  const [formData, setFormData] = useState({
    email: loginHint || '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    initAuthTheme();
  }, []);

  const getOAuthParams = () => {
    const params: Record<string, string> = {};
    const oauthKeys = [
      'client_id',
      'redirect_uri',
      'response_type',
      'scope',
      'state',
      'code_challenge',
      'code_challenge_method',
    ];

    oauthKeys.forEach((key) => {
      const value = searchParams.get(key);
      if (value) params[key] = value;
    });

    return params;
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.email.trim()) {
      setError('Email is required');
      return;
    }

    if (!validateEmail(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    setStep('password');
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      const returnTo = searchParams.get('return_to');
      const oauthParams = getOAuthParams();

      if (returnTo) {
        try {
          const returnUrl = new URL(returnTo, window.location.origin);
          if (returnUrl.origin === window.location.origin) {
            window.location.href = returnTo;
          } else {
            const url = new URL('/api/auth/start', returnTo);
            window.location.href = url.toString();
          }
        } catch {
          window.location.href = returnTo;
        }
      } else if (Object.keys(oauthParams).length > 0) {
        const authorizeUrl = new URL('/api/auth/authorize', window.location.origin);
        Object.entries(oauthParams).forEach(([key, value]) => {
          authorizeUrl.searchParams.set(key, value);
        });
        window.location.href = authorizeUrl.toString();
      } else {
        router.push('/u');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  return (
    <AuthCard>
      {/* Email Step - Google-like Layout */}
      {step === 'email' && (
        <form onSubmit={handleEmailSubmit} className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Left: Header */}
            <div className="flex flex-col justify-start md:pt-4">
              <h1 className="text-4xl font-light text-(--text) mb-2
                transition-colors duration-300">
                Sign in
              </h1>
              <p className="text-base text-(--text-secondary)
                transition-colors duration-300">
                Use your account
              </p>
            </div>

            {/* Right: Form */}
            <div className="flex flex-col gap-4">
              {/* Error Alert */}
              {error && (
                <div className="p-3 rounded border border-(--error)/30
                  bg-(--error)/10 text-(--error) text-xs
                  animate-slide-in transition-colors duration-300">
                  {error}
                </div>
              )}

              {/* Email Input */}
              <AuthInput
                type="email"
                id="email"
                name="email"
                label="Enter your Email"
                value={formData.email}
                onChange={handleChange}
                error={error && error.includes('email') ? error : ''}
                autoComplete="email"
                required
              />
            </div>
          </div>

          {/* Actions - Bottom Right */}
          <div className="flex justify-end items-center gap-3 mt-8">
            <a
              href={`/signup${(() => {
                const params = new URLSearchParams();
                const oauthKeys = ['client_id', 'redirect_uri', 'response_type', 'scope', 'state', 'code_challenge', 'code_challenge_method'];
                oauthKeys.forEach(key => {
                  const val = searchParams.get(key);
                  if (val) params.set(key, val);
                });
                const qs = params.toString();
                return qs ? `?${qs}` : '';
              })()}`}
              className="text-sm px-6 py-2.5 rounded-full hover:bg-(--blue)/10 font-medium text-(--blue)
                hover:text-(--input-focus)
                transition-colors duration-200 cursor-pointer"
            >
              Create account
            </a>
            <button
              type="submit"
              className="px-8 py-2.5 rounded-full
                bg-(--blue-btn)
                hover:bg-(--blue-btn-hover)
                text-white font-medium text-sm
                transition-all duration-200
                hover:shadow-lg
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </form>
      )}

      {/* Password Step - Google-like Layout */}
      {step === 'password' && (
        <form onSubmit={handlePasswordSubmit} className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left: Account Info */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left">
              {/* Avatar */}
              <div className="w-16 h-16 rounded-full bg-(--blue-btn)
                flex items-center justify-center text-white text-2xl font-medium mb-4">
                {formData.email[0].toUpperCase()}
              </div>
              
              {/* Account Info */}
              <div className="flex flex-col gap-1">
                <h2 className="text-lg md:text-2xl font-medium text-(--text)
                  transition-colors duration-300">
                  Hi there,
                </h2>
                <p className="text-sm md:text-xl text-(--text-secondary)
                  transition-colors duration-300">
                  {formData.email}
                </p>
              </div>
            </div>

            {/* Right: Password Form */}
            <div className="flex flex-col gap-4">
              {/* Header */}
              <div>
                <p className="text-sm font-medium text-(--text-secondary) mb-3
                  transition-colors duration-300">
                  To continue, first verify it&apos;s you
                </p>
                
                {/* Error Alert */}
                {error && (
                  <div className="mb-4 p-3 rounded border border-(--error)/30
                    bg-(--error)/10 text-(--error) text-xs
                    animate-slide-in transition-colors duration-300">
                    {error}
                  </div>
                )}
              </div>

              {/* Password Input */}
              <AuthInput
                type="password"
                id="password"
                name="password"
                label="Enter your password"
                value={formData.password}
                onChange={handleChange}
                error={error && !error.includes('email') ? error : ''}
                autoComplete="current-password"
                required
                disabled={loading}
              />

              {/* Forgot Password Link */}
              <a
                href="#"
                className="text-xs font-medium text-(--blue)
                  hover:text-(--input-focus)
                  transition-colors duration-200"
              >
                Forgot password?
              </a>
            </div>
          </div>

          {/* Actions - Bottom Right */}
          <div className="flex justify-end items-center gap-3 md:gap-5 mt-8">
            <button
              type="button"
              onClick={() => {
                setStep('email');
                setError('');
              }}
              className="text-sm px-8 py-2.5 hover:bg-(--blue)/10 rounded-full font-medium text-(--blue)
                hover:text-(--input-focus)
                transition-colors duration-200 cursor-pointer"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-2.5 rounded-full
                bg-(--blue-btn)
                hover:bg-(--blue-btn-hover)
                text-white font-medium text-sm
                transition-all duration-200
                hover:shadow-lg
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Next'}
            </button>
          </div>
        </form>
      )}
    </AuthCard>
  );
}
