import React from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  field: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  helpText?: string;
}

export function SelectField({
  field,
  label,
  value,
  onChange,
  options,
  disabled = false,
  helpText,
}: SelectFieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={field} className="block text-sm font-medium text-gray-900">
        {label}
      </label>
      <select
        id={field}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
      >
        <option value="">Select an option</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {helpText && <p className="text-xs text-gray-500">{helpText}</p>}
    </div>
  );
}
