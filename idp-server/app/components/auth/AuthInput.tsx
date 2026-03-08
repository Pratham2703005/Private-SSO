'use client';

import { useState } from 'react';

interface AuthInputProps {
  type?: string;
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  disabled?: boolean;
}

export function AuthInput({
  type = 'text',
  id,
  name,
  label,
  value,
  onChange,
  onFocus,
  error,
  placeholder,
  required,
  autoComplete,
  disabled,
}: AuthInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const isPasswordField = type === 'password';
  const inputType = isPasswordField && showPassword ? 'text' : type;
  const hasValue = value && value.length > 0;
  const shouldFloatLabel = isFocused || hasValue;

  // Split label into characters for wave animation
  const labelChars = label.split('');

  return (
    <div className="relative mb-6 last:mb-0">
      <style>{`
        .wave-group {
          position: relative;
        }

        .wave-group .input {
          font-size: 16px;
          padding: 12px 40px 12px 0;
          display: block;
          width: 100%;
          border: none;
          background: transparent;
          color: var(--text);
          transition: border-color 0.15s ease;
          letter-spacing: normal;
          word-spacing: normal;
        }

        .wave-group .input::placeholder {
          color: transparent;
          opacity: 0;
        }

        .wave-group .input:focus {
          outline: none;
        }

        .wave-group .label {
          color: var(--text-secondary);
          font-size: 16px;
          font-weight: normal;
          position: absolute;
          pointer-events: none;
          left: 0;
          top: 12px;
          display: flex;
          gap: 0;
          transition: color 0.15s ease;
        }

        .wave-group .label-char {
          transition: transform 0.15s ease, color 0.15s ease, font-size 0.15s ease;
          transition-delay: calc(var(--index, 0) * 0.03s);
          display: inline-block;
          transform: translateY(0);
          font-size: 16px;
          color: var(--text-secondary);
        }

        .wave-group .label.floating .label-char {
          transform: translateY(-20px);
          font-size: 12px;
          color: var(--input-focus);
        }

        .wave-group .bar {
          position: relative;
          display: block;
          width: 100%;
          border-bottom: 1px solid var(--border);
        }

        .wave-group .bar::before,
        .wave-group .bar::after {
          content: '';
          height: 2px;
          width: 0;
          bottom: -1px;
          position: absolute;
          background: var(--input-focus);
          transition: width 0.15s ease;
        }

        .wave-group .bar::before {
          left: 50%;
        }

        .wave-group .bar::after {
          right: 50%;
        }

        .wave-group .bar.active::before,
        .wave-group .bar.active::after {
          width: 50%;
        }
      `}</style>

      <div className="wave-group">
        <input
          type={inputType}
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder || label}
          required={required}
          autoComplete={autoComplete}
          disabled={disabled}
          className="input"
        />

        <label
          htmlFor={id}
          className={`label ${shouldFloatLabel ? 'floating' : ''}`}
        >
          {labelChars.map((char, index) => (
            <span
              key={index}
              className="label-char"
              style={{ '--index': index } as React.CSSProperties}
            >
              {char === ' ' ? '\u00A0' : char}
            </span>
          ))}
        </label>

        <div className={`bar ${isFocused ? 'active' : ''}`}></div>

        {/* Password visibility toggle */}
        {isPasswordField && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-3
              text-(--text-secondary)
              hover:text-(--text)
              transition-colors duration-200 p-1"
            tabIndex={-1}
          >
            {showPassword ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-5 0-9.27-3.11-11-7.5a9.99 9.99 0 012.81-4.19m3.09-2.2A9.79 9.79 0 0112 5c5 0 9.27 3.11 11 7.5a10.05 10.05 0 01-4.13 5.07m-2.78-2.78a3 3 0 11-4.24-4.24M3 3l18 18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-2 text-sm text-(--error) animate-slide-in">
          {error}
        </div>
      )}
    </div>
  );
}
