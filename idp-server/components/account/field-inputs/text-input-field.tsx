import React from "react";

interface TextInputFieldProps {
  field: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  helpText?: string;
}

export function TextInputField({
  field,
  label,
  value,
  onChange,
  disabled = false,
  placeholder,
  maxLength,
  helpText,
}: TextInputFieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={field} className="block text-sm font-medium text-gray-900">
        {label}
      </label>
      <input
        id={field}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
      />
      {helpText && <p className="text-xs text-gray-500">{helpText}</p>}
    </div>
  );
}
