'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AddDomainStep1 } from './AddDomainStep1';
import { AddDomainStep2 } from './AddDomainStep2';
import { AddDomainStep3 } from './AddDomainStep3';
import { toast } from 'robot-toast';
import type { OAuthClient } from '@/types/database';

interface AddDomainFormProps {
  regUserId: string;
  userEmail: string;
  isAuthorized: boolean;
  generatedClientId: string;
  isEdit?: boolean;
  existingClient?: OAuthClient;
}

type AddDomainStep = 'basic' | 'scopes' | 'uris';

// Helper to parse scopes string into boolean object
function parseScopesString(scopesString: string | undefined): {
  userIdentity: {
    openid: boolean;
    profile: boolean;
    email: boolean;
  };
  optional: {
    phone: boolean;
    address: boolean;
  };
} {
  const scopes = scopesString?.split(',').map(s => s.trim()) || [];
  return {
    userIdentity: {
      openid: scopes.includes('openid'),
      profile: scopes.includes('profile'),
      email: scopes.includes('email'),
    },
    optional: {
      phone: scopes.includes('phone'),
      address: scopes.includes('address'),
    },
  };
}

export function AddDomainForm({ 
  regUserId, 
  userEmail, 
  isAuthorized, 
  generatedClientId,
  isEdit = false,
  existingClient 
}: AddDomainFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<AddDomainStep>('basic');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Initialize form data from existing client if editing
  const [formData, setFormData] = useState({
    client_name: existingClient?.client_name || '',
    domain: existingClient?.domain || '',
    redirect_uris: Array.isArray(existingClient?.allowed_redirect_uris) 
      ? existingClient.allowed_redirect_uris.join('\n')
      : '',
    imageFile: null as File | null,
    imagePreview: (existingClient?.image || null) as string | null,
    isActive: existingClient?.is_active !== false ? true : false,
    scopes: parseScopesString(existingClient?.allowed_scopes ?? undefined),
  });

  const [errors, setErrors] = useState<Partial<{
    client_name: string;
    domain: string;
    redirect_uris: string;
  }>>({});

  const handleClientNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData((prev) => ({ ...prev, client_name: value }));
    if (errors.client_name) {
      setErrors((prev) => ({ ...prev, client_name: undefined }));
    }
  };

  const handleDomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData((prev) => ({ ...prev, domain: value }));
    if (errors.domain) {
      setErrors((prev) => ({ ...prev, domain: undefined }));
    }
  };

  const handleRedirectUrisChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { value } = e.target;
    setFormData((prev) => ({ ...prev, redirect_uris: value }));
    if (errors.redirect_uris) {
      setErrors((prev) => ({ ...prev, redirect_uris: undefined }));
    }
  };

  const handleImageChange = (file: File | null, preview: string | null) => {
    setFormData((prev) => ({
      ...prev,
      imageFile: file,
      imagePreview: preview,
    }));
  };

  const handleIsActiveChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      isActive: e.target.checked,
    }));
  };

  const handleScopeToggle = (section: 'userIdentity' | 'optional', scope: string) => {
    setFormData((prev) => ({
      ...prev,
      scopes: {
        ...prev.scopes,
        [section]: {
          ...prev.scopes[section],
          [scope]: !prev.scopes[section][scope as keyof typeof prev.scopes[typeof section]],
        },
      },
    }));
  };

  const validateBasicInfo = () => {
    const newErrors: Partial<typeof errors> = {};

    if (!formData.client_name.trim()) {
      newErrors.client_name = 'Application name is required';
    }

    if (!formData.domain.trim()) {
      newErrors.domain = 'Domain is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return false;
    }

    setErrors({});
    return true;
  };

  const validateRedirectUris = () => {
    const newErrors: Partial<typeof errors> = {};

    if (!formData.redirect_uris.trim()) {
      newErrors.redirect_uris = 'At least one redirect URI is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return false;
    }

    setErrors({});
    return true;
  };

  const handleBasicNext = () => {
    if (validateBasicInfo()) {
      setStep('scopes');
    }
  };

  const handleScopesNext = () => {
    setStep('uris');
  };

  const handleUrisBack = () => {
    setStep('scopes');
  };

  const handleScopesBack = () => {
    setStep('basic');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthorized ) {
      toast({
        message: 'As far as i know, you are not authorized to register OAuth applications. Please contact Pratham for access.',
        type: 'error',
        robotVariant: 'think',
        autoClose: 5000,
      })
      return;
    }

    if(!validateRedirectUris()) {
      toast({
        message: error || 'Please ensure your details are correct',
        type: 'error',
        robotVariant: 'error',
        autoClose: 3000,
      })
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Flatten scopes
      const allowedScopes = [
        ...Object.keys(formData.scopes.userIdentity).filter((k) => formData.scopes.userIdentity[k as keyof typeof formData.scopes.userIdentity]),
        ...Object.keys(formData.scopes.optional).filter((k) => formData.scopes.optional[k as keyof typeof formData.scopes.optional]),
      ];

      // Build FormData with all fields
      const sendFormData = new FormData();
      sendFormData.append('client_name', formData.client_name);
      sendFormData.append('domain', formData.domain);
      sendFormData.append('is_active', String(formData.isActive));
      sendFormData.append('allowed_scopes', allowedScopes.join(','));
      sendFormData.append(
        'allowed_redirect_uris',
        formData.redirect_uris
          .split('\n')
          .map((u) => u.trim())
          .filter(Boolean)
          .join('\n')
      );

      // Append image if available
      if (formData.imageFile) {
        sendFormData.append('image', formData.imageFile);
      }

      const endpoint = isEdit 
        ? `/api/auth/oauth-clients/${generatedClientId}`
        : '/api/auth/oauth-clients';
      
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        credentials: 'include',
        body: sendFormData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${isEdit ? 'update' : 'create'} OAuth client`);
      }
      router.push(`/u/${regUserId}/connected-apps`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      toast({
        message: 'An error occurred while submitting the form. Please try again.',
        type: 'error',
        robotVariant: 'error2',
        autoClose: 3000,
      })
    } finally {
      setLoading(false);
    }
  };

  const stepDescriptions = {
    basic: {
      title: isEdit ? 'Update OAuth Application' : 'Register OAuth Application',
      subtitle: isEdit 
        ? 'Update your application information.'
        : 'Provide basic information about your application to get started.',
      helper: isEdit
        ? 'Modify the details of your registered OAuth application.'
        : 'We use this information to identify and manage your OAuth client.',
    },
    scopes: {
      title: 'Select Permissions',
      subtitle: 'Choose which user data your application can access.',
      helper: 'User Identity scopes are essential for basic authentication.',
    },
    uris: {
      title: 'Configure Redirect URIs',
      subtitle: 'Specify where users should be redirected after authentication.',
      helper: 'Use HTTPS in production. Each URI should be on a new line.',
    },
  } as const;

  return (
    <div style={{ backgroundColor: 'var(--bg)' }}>
      {/* Unauthorized Banner */}
      {!isAuthorized && !bannerDismissed && (
        <div
          style={{
            backgroundColor: 'color-mix(in srgb, var(--error) 10%, transparent)',
            borderColor: 'var(--error)',
            color: 'var(--error)',
          }}
          className="flex items-start gap-3 px-5 py-3.5 border rounded-lg text-sm mb-5"
        >
          <svg className="shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <span>
            <strong className="font-medium">Not authorized.</strong> You haven&apos;t been granted permission by <strong className="font-medium">Pratham</strong> to register OAuth applications.
          </span>
          <button
            onClick={() => setBannerDismissed(true)}
            className="ml-auto shrink-0 opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
      )}
        {/* Header with back button */}
        <div className="px-5">
          <button
            onClick={() => router.push(`/u/${regUserId}/connected-apps`)}
            style={{ color: 'var(--text-secondary)' }}
            className="inline-flex items-center gap-1.5 hover:text-(--text) text-sm transition-colors group"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="group-hover:-translate-x-0.5 transition-transform">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </svg>
            Connected Apps
          </button>
        </div>

      <div style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }} className="mt-6 mx-4 md:mx-auto max-w-7xl border rounded-2xl">

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.15fr)] lg:gap-16 p-6 md:p-8">
          {/* Left Side: Title and Description */}
          <div className="animate-fade-in md:pt-4">
            {/* <div className="flex items-center gap-3 mb-4">
              <div
                style={{
                  backgroundColor: 'rgba(var(--blue-btn-rgb), 0.15)',
                }}
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--blue-btn)">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </div>
            </div> */}
            <h1 style={{ color: 'var(--text)' }} className="max-w-md text-4xl font-light tracking-tight md:text-5xl">
              {stepDescriptions[step].title}
            </h1>
            <p style={{ color: 'var(--text-secondary)' }} className="mt-4 max-w-md text-base leading-7">
              {stepDescriptions[step].subtitle}
            </p>

            {step !== 'basic' && userEmail && (
              <div style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }} className="mt-6 inline-flex items-center rounded-full border px-4 py-2 text-sm">
                {userEmail}
              </div>
            )}

            <p style={{ color: 'var(--text-secondary)' }} className="mt-8 max-w-sm text-sm leading-6">
              {stepDescriptions[step].helper}
            </p>
          </div>

          {/* Right Side: Form */}
          <div className="relative">
            {/* Error Alert */}
            {error && (
              <div
                style={{
                  backgroundColor: 'rgba(var(--error-rgb), 0.1)',
                  borderColor: 'var(--error)',
                  color: 'var(--error)',
                }}
                className="mb-4 flex items-center gap-2.5 px-4 py-3 border rounded-xl text-sm"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                {error}
              </div>
            )}

            {step === 'basic' && (
              <AddDomainStep1
                clientName={formData.client_name}
                domain={formData.domain}
                imagePreview={formData.imagePreview}
                errors={errors}
                onClientNameChange={handleClientNameChange}
                onDomainChange={handleDomainChange}
                onImageChange={handleImageChange}
                onNext={handleBasicNext}
                generatedClientId={generatedClientId}
              />
            )}

            {step === 'scopes' && (
              <AddDomainStep2
                scopes={formData.scopes}
                onScopeToggle={handleScopeToggle}
                onNext={handleScopesNext}
                onBack={handleScopesBack}
              />
            )}

            {step === 'uris' && (
              <AddDomainStep3
                redirectUris={formData.redirect_uris}
                isActive={formData.isActive}
                errors={errors}
                onRedirectUrisChange={handleRedirectUrisChange}
                onIsActiveChange={handleIsActiveChange}
                onSubmit={handleSubmit}
                onBack={handleUrisBack}
                isLoading={loading}
                isEdit={isEdit}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}