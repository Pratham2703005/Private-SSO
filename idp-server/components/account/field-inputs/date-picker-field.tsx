import React from "react";

interface DatePickerFieldProps {
  field: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  helpText?: string;
  minDate?: string;
  maxDate?: string;
}

export function DatePickerField({
  field,
  label,
  value,
  onChange,
  disabled = false,
  helpText,
  minDate,
  maxDate,
}: DatePickerFieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={field} className="block text-sm font-medium text-gray-900">
        {label}
      </label>
      <input
        id={field}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        min={minDate}
        max={maxDate}
        className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
      />
      {helpText && <p className="text-xs text-gray-500">{helpText}</p>}
    </div>
  );
}
