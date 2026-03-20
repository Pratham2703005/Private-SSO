'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { initAuthTheme } from '@/lib/auth-theme';
import { AuthCard } from '@/app/components/auth/AuthCard';
import { AuthInput } from '@/app/components/auth/AuthInput';
import { getAvatarColorByName } from '@/lib/avatar-colors';

type SignupStep = 'nameEmail' | 'password' | 'profile';

interface SignupFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  dob?: string;
  phone?: string;
  profilePhoto?: File;
}

export default function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<SignupStep>('nameEmail');
  const [formData, setFormData] = useState<SignupFormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    dob: '',
    phone: '',
  });
  const [errors, setErrors] = useState<Partial<SignupFormData>>({});
  const [loading, setLoading] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);

  useEffect(() => {
    initAuthTheme();
  }, []);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validatePassword = (password: string) => {
    return password.length >= 8;
  };

  // Get OAuth parameters from URL
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
      if (value) {
        params[key] = value;
      }
    });

    return params;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof SignupFormData]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  // Step 1: Name + Email validation
  const handleNameEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Partial<SignupFormData> = {};
    const normalizedEmail = formData.email.trim().toLowerCase();

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    if (!normalizedEmail) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(normalizedEmail)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setCheckingEmail(true);

    try {
      const response = await fetch(
        `/api/auth/signup/check-email?email=${encodeURIComponent(normalizedEmail)}`,
        {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setErrors({ email: data.error || 'Unable to verify email right now' });
        return;
      }

      if (!data.available) {
        setErrors({ email: 'Email already registered' });
        return;
      }

      setFormData((prev) => ({ ...prev, email: normalizedEmail }));
      setErrors({});
      setStep('password');
    } catch {
      setErrors({ email: 'Unable to verify email right now' });
    } finally {
      setCheckingEmail(false);
    }
  };

  // Step 2: Password validation
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Partial<SignupFormData> = {};

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (!validatePassword(formData.password)) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords don't match";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setStep('profile');
  };

  // Step 3: Optional profile data submission
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: `${formData.firstName} ${formData.lastName}`,
          // Note: dob, phone, profilePhoto are optional and not sent to API yet
          // They can be added to user profile in a separate update endpoint
        }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        // Better error messages for specific HTTP status codes
        const errorMessage = data.error || 
          (response.status === 409 ? 'Email already registered' : 'Signup failed');
        setErrors({ email: errorMessage });
        setLoading(false);
        return;
      }

      // Success - determine where to redirect
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
        // OAuth2 flow - redirect back to authorize endpoint
        const authorizeUrl = new URL('/api/auth/authorize', window.location.origin);
        Object.entries(oauthParams).forEach(([key, value]) => {
          authorizeUrl.searchParams.set(key, value);
        });
        window.location.href = authorizeUrl.toString();
      } else {
        // Direct IDP signup - redirect to account page
        router.push('/u');
      }
    } catch {
      setErrors({ email: 'An unexpected error occurred' });
      setLoading(false);
    }
  };

  const authParams = new URLSearchParams();
  const authKeys = [
    'client_id',
    'redirect_uri',
    'response_type',
    'scope',
    'state',
    'code_challenge',
    'code_challenge_method',
  ];

  authKeys.forEach((key) => {
    const value = searchParams.get(key);
    if (value) {
      authParams.set(key, value);
    }
  });

  const signInHref = `/login${authParams.toString() ? `?${authParams.toString()}` : ''}`;
  const signupIdentity = `${formData.firstName} ${formData.lastName}`.trim() || formData.email;
  const signupAvatarColor = getAvatarColorByName(signupIdentity);
  const stepCopy = {
    nameEmail: {
      title: 'Create your account',
      subtitle: 'Enter your name and email to get started.',
      helper: 'Use letters, numbers and periods in your email address.',
    },
    password: {
      title: 'Set a password',
      subtitle: formData.email
        ? `Create a password for ${formData.email}.`
        : 'Create a password for your new account.',
      helper: 'Use 8+ characters with letters, numbers and symbols.',
    },
    profile: {
      title: 'Finish your profile',
      subtitle: 'Add optional details now, or skip them and update later.',
      helper: 'These details are optional and can be changed from your account page.',
    },
  } as const;

  return (
    <AuthCard maxWidth="lg">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.15fr)] lg:gap-16">
        <div className="animate-fade-in md:pt-4">
         
          <h1 className="max-w-md text-4xl font-light tracking-tight text-(--text) transition-colors duration-300 md:text-5xl">
            {stepCopy[step].title}
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-(--text-secondary) transition-colors duration-300 md:text-lg">
            {stepCopy[step].subtitle}
          </p>

          {step !== 'nameEmail' && formData.email && (
            <div className="mt-6 inline-flex items-center rounded-full border border-border px-4 py-2 text-sm text-(--text-secondary) transition-colors duration-300">
              <span
                className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: signupAvatarColor }}
              >
                {(signupIdentity || '?').charAt(0).toUpperCase()}
              </span>
              {formData.email}
            </div>
          )}

          <p className="mt-8 max-w-sm text-sm leading-6 text-(--text-secondary) transition-colors duration-300">
            {stepCopy[step].helper}
          </p>
        </div>

        <div>
          {step === 'nameEmail' && (
            <form onSubmit={handleNameEmailSubmit} className="animate-fade-in space-y-6">
              <AuthInput
                type="text"
                id="firstName"
                name="firstName"
                label="First name"
                placeholder="Enter your first name"
                value={formData.firstName}
                onChange={handleChange}
                error={errors.firstName}
                required
                autoComplete="given-name"
              />

              <AuthInput
                type="text"
                id="lastName"
                name="lastName"
                label="Last name"
                placeholder="Enter your last name"
                value={formData.lastName}
                onChange={handleChange}
                error={errors.lastName}
                required
                autoComplete="family-name"
              />

              <AuthInput
                type="email"
                id="email"
                name="email"
                label="Email address"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                required
                autoComplete="email"
              />

              <div className="flex items-center justify-between gap-3 pt-4">
                <a
                  href={signInHref}
                  className="text-sm font-medium text-(--blue) transition-colors duration-200 hover:text-(--input-focus)"
                >
                  Sign in instead
                </a>
                <button
                  type="submit"
                  disabled={checkingEmail}
                  className="rounded-full bg-(--blue-btn) px-8 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-(--blue-btn-hover) hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {checkingEmail ? 'Checking...' : 'Next'}
                </button>
              </div>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="animate-fade-in space-y-6">
              <AuthInput
                type="password"
                id="password"
                name="password"
                label="Password"
                placeholder="Enter a strong password"
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                required
                autoComplete="new-password"
              />

              <AuthInput
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                label="Confirm password"
                placeholder="Re-enter your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                error={errors.confirmPassword}
                required
                autoComplete="new-password"
              />

              <div className="flex items-center justify-between gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setStep('nameEmail');
                    setErrors({});
                  }}
                  className="text-sm font-medium text-(--blue) transition-colors duration-200 hover:text-(--input-focus)"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-(--blue-btn) px-8 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-(--blue-btn-hover) hover:shadow-lg"
                >
                  Next
                </button>
              </div>
            </form>
          )}

          {step === 'profile' && (
            <form onSubmit={handleProfileSubmit} className="animate-fade-in space-y-6">
              <div>
                <label className="text-sm font-medium text-(--text) transition-colors duration-300">
                  Date of birth (optional)
                </label>
                <input
                  type="date"
                  name="dob"
                  value={formData.dob || ''}
                  onChange={handleChange}
                  className="mt-2 w-full rounded-2xl border border-border bg-(--input-bg) px-4 py-3 text-(--text) transition-colors duration-200 focus:border-(--input-focus) focus:outline-none"
                />
              </div>

              <AuthInput
                type="tel"
                id="phone"
                name="phone"
                label="Phone number (optional)"
                placeholder="Add a phone number"
                value={formData.phone || ''}
                onChange={handleChange}
                autoComplete="tel"
              />

              <div>
                <label className="text-sm font-medium text-(--text) transition-colors duration-300">
                  Profile picture (optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setFormData((prev) => ({ ...prev, profilePhoto: file }));
                    }
                  }}
                  className="mt-2 w-full rounded-2xl border border-border bg-(--input-bg) px-4 py-3 text-(--text) transition-colors duration-200"
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setStep('password');
                    setErrors({});
                  }}
                  className="text-sm font-medium text-(--blue) transition-colors duration-200 hover:text-(--input-focus)"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-full bg-(--blue-btn) px-8 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-(--blue-btn-hover) hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create account'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </AuthCard>
  );
}
