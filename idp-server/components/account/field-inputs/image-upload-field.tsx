import React, { useState } from "react";
import { AvatarImage } from "@/components/ui";

interface ImageUploadFieldProps {
  field: string;
  label: string;
  onChange: (value: string | null) => void;
  helpText?: string;
  previewUrl?: string;
  name?: string;
}

export function ImageUploadField({
  field,
  label,
  onChange,
  helpText,
  previewUrl,
  name = "User",
}: ImageUploadFieldProps) {
  const [preview, setPreview] = useState<string | null>(previewUrl || null);

  const handleFileChange = (file: File) => {
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

      {/* Avatar Preview with Camera Icon */}
      <div className="flex justify-center mb-4">
        <AvatarImage
          imageUrl={preview || previewUrl}
          name={name}
          size={96}
          onImageChange={handleFileChange}
        />
      </div>

      {helpText && <p className="text-xs text-center text-gray-500">{helpText}</p>}
    </div>
  );
}
