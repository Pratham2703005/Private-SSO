'use client';

import { useRef, useCallback, useState } from 'react';
import { AuthInput } from '@/app/components/auth/AuthInput';
import { CopyButton } from './CopyButton';

interface AddDomainStep1Props {
  clientName: string;
  domain: string;
  imagePreview: string | null;
  errors: Partial<{
    client_name: string;
    domain: string;
  }>;
  onClientNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDomainChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImageChange: (file: File | null, preview: string | null) => void;
  onNext: () => void;
  generatedClientId: string;
  isLoading?: boolean;
}

export function AddDomainStep1({
  clientName,
  domain,
  imagePreview,
  errors,
  onClientNameChange,
  onDomainChange,
  onImageChange,
  onNext,
  generatedClientId,
  isLoading = false,
}: AddDomainStep1Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const processImage = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = e.target?.result as string;
      onImageChange(file, preview);
    };
    reader.readAsDataURL(file);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          const preview = event.target?.result as string;
          onImageChange(file, preview);
        };
        reader.readAsDataURL(file);
      }
    },
    [onImageChange]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="animate-fade-in space-y-4">
      {/* App Logo Section - Compact */}
      <div>
        <label style={{ color: 'var(--text-secondary)' }} className="block text-xs font-medium uppercase tracking-widest mb-2">
          Application Logo</label>
        <div className="flex items-center gap-3">
          {/* Preview - Compact */}
          <div
            style={{
              backgroundColor: 'var(--input-bg)',
              borderColor: 'var(--border)',
            }}
            className="w-12 h-12 rounded-xl border flex items-center justify-center overflow-hidden shrink-0"
          >
            {imagePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagePreview} alt="Logo preview" className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--text-secondary)">
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
              </svg>
            )}
          </div>

          {/* Drop zone - Compact */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              borderColor: dragOver ? 'var(--input-focus)' : 'var(--border)',
              backgroundColor: dragOver ? 'rgba(var(--input-focus-rgb), 0.05)' : 'transparent',
            }}
            className="flex-1 border border-dashed rounded-lg px-3 py-2 text-center cursor-pointer transition-all"
          >
            <p style={{ color: 'var(--text-secondary)' }} className="text-xs">
              <span style={{ color: 'var(--input-focus)' }} className="font-medium">
                Upload
              </span>{' '}
              or drag
            </p>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </div>
        </div>
      </div>

      {/* Client ID — read only - Compact with Copy Button */}
      <div>
        <label style={{ color: 'var(--text-secondary)' }} className="block text-xs font-medium uppercase tracking-widest mb-1.5">
          Client ID<span className="ml-1 normal-case tracking-normal font-normal text-[10px] opacity-60">auto-generated</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={generatedClientId}
            readOnly
            style={{
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--input-bg)',
              borderColor: 'var(--border)',
            }}
            className="flex-1 px-3 py-2 border rounded-lg text-xs font-mono cursor-default select-all focus:outline-none focus:ring-1"
          />
          <CopyButton text={generatedClientId} label="Copy Client ID" />
        </div>
      </div>

      {/* App Name */}
      <AuthInput
        type="text"
        id="client_name"
        name="client_name"
        label="Application Name"
        placeholder="My App"
        value={clientName}
        onChange={onClientNameChange}
        required
        error={errors.client_name}
      />

      {/* Domain */}
      <AuthInput
        type="text"
        id="domain"
        name="domain"
        label="Domain"
        placeholder="example.com"
        value={domain}
        onChange={onDomainChange}
        required
        error={errors.domain}
      />
      <p style={{ color: 'var(--text-secondary)' }} className="text-xs mt-1 pl-1 opacity-70">
        Include port for localhost
      </p>

      {/* Footer Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={isLoading}
          style={{
            backgroundColor: 'var(--blue-btn)',
          }}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-white text-sm font-medium transition-all hover:bg-(--blue-btn-hover) disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </form>
  );
}
