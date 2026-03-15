'use client';

import { useState, useCallback } from 'react';
import { toast } from 'robot-toast'

interface CopyButtonProps {
  text: string;
  label?: string;
  duration?: number; // Duration to show checkmark in ms
}

export function CopyButton({ text, label, duration = 2000 }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        message: 'Copied to clipboard!',
        type: 'success',
        robotVariant: 'none',
        autoClose: duration
      });

      // Reset checkmark after duration
      const checkmarkTimer = setTimeout(() => {
        setCopied(false);
      }, duration);

      return () => {
        clearTimeout(checkmarkTimer);
      };
    } catch (err) {
      toast({
        message: 'Failed to copy to clipboard.',
        type: 'error',
        robotVariant: 'shock',
        autoClose: duration
      });
    }
  }, [text, duration]);

  return (
    <>
      <button
        type="button"
        onClick={handleCopy}
        style={{
          backgroundColor: 'var(--input-bg)',
          borderColor: 'var(--border)',
          color: copied ? 'var(--blue)' : 'var(--text-secondary)',
        }}
        className="px-3 py-2 border rounded-lg transition-all duration-200 hover:opacity-80"
        title={label || 'Copy to clipboard'}
        onMouseEnter={(e) => {
          if (!copied) {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--border)';
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--input-bg)';
        }}
      >
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="animate-pulse">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
          </svg>
        )}
      </button>
    </>
  );
}
