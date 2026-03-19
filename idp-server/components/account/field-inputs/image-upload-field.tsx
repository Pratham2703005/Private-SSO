import React, { useState } from "react";

interface ImageUploadFieldProps {
  field: string;
  label: string;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  helpText?: string;
  previewUrl?: string;
}

export function ImageUploadField({
  field,
  label,
  onChange,
  disabled = false,
  helpText,
  previewUrl,
}: ImageUploadFieldProps) {
  const [preview, setPreview] = useState<string | null>(previewUrl || null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      alert("File size must be less than 2MB");
      return;
    }

    // Read file as data URL for preview and storage
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setPreview(dataUrl);
      onChange(dataUrl); // Store the data URL in state
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <label htmlFor={field} className="block text-sm font-medium text-gray-900">
        {label}
      </label>

      {preview && (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Preview"
            className="h-24 w-24 rounded-full object-cover border-2 border-gray-300"
          />
        </div>
      )}

      <div className="space-y-2">
        <input
          id={field}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={disabled}
          className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 disabled:file:bg-gray-100 disabled:file:text-gray-500"
        />
        {helpText && <p className="text-xs text-gray-500">{helpText}</p>}
      </div>
    </div>
  );
}
