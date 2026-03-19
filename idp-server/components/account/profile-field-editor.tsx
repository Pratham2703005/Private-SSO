"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "robot-toast";
import { TextInputField } from "./field-inputs/text-input-field";
import { SelectField } from "./field-inputs/select-field";
import { DatePickerField } from "./field-inputs/date-picker-field";
import { ImageUploadField } from "./field-inputs/image-upload-field";
import type { PersonalInfoFieldSlug } from "@/constants/personal-info";
import {
  PROFILE_SECTION_CONFIG,
  PERSONAL_INFO_FIELD_LABELS,
} from "@/constants/personal-info";
import { updateProfileField } from "@/lib/profile-update";
import type { UserAccount } from "@/types/database";

interface ValidationError {
  field?: string;
  message?: string;
  code?: string;
}

interface ProfileFieldEditorProps {
  field: PersonalInfoFieldSlug;
  account: UserAccount;
  regUserId: string;
}

export function ProfileFieldEditor({
  field,
  account,
  regUserId,
}: ProfileFieldEditorProps) {
  const router = useRouter();
  const config = PROFILE_SECTION_CONFIG[field];
  const label = PERSONAL_INFO_FIELD_LABELS[field];

  // Get initial value based on field type
  const getInitialValue = (): string => {
    switch (field) {
      case "profile-picture":
        return account.profile_image_url || "";
      case "name":
        return account.name || "";
      case "gender":
        return account.gender || "";
      case "email":
        return account.email || "";
      case "phone":
        return account.phone || "";
      case "birthday":
        return account.birthday
          ? new Date(account.birthday).toISOString().split("T")[0]
          : "";
      case "language":
        return account.language || "English (United States)";
      case "home-address":
        return account.home_address || "";
      default:
        return "";
    }
  };

  const [value, setValue] = useState(getInitialValue());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);

  // Store the original value to display in "Current value" section
  const originalValue = getInitialValue();

  const handleSave = async () => {
    setError(null);
    setValidationErrors([]);

    // Local validation
    if (!value.trim() && field !== "profile-picture") {
      setError("This field cannot be empty");
      return;
    }

    setIsSaving(true);

    try {
      const response = await updateProfileField({
        field,
        value: value || null,
      });

      if (response.success) {
        setSuccess(true);
        toast({
            message:`${label} updated successfully!`,
            robotVariant: "wave",
            type: "success",
            autoClose: 2000
        });
        setTimeout(() => {
          router.push(`/u/${regUserId}/personal-info`);
        }, 700);
      } else {
        // Show precise error messages
        if (response.details && Array.isArray(response.details)) {
          // Handle validation error details from backend
          const errorMessages = response.details
            .map((detail: ValidationError | string) => {
              if (typeof detail === "string") return detail;
              if (detail && typeof detail === "object" && "message" in detail) {
                return detail.message;
              }
              return null;
            })
            .filter((msg): msg is string => msg !== null);
          
          if (errorMessages.length > 0) {
            setValidationErrors(errorMessages);
            setError("Validation failed");
            errorMessages.forEach((msg) => 
                toast({
                    message: msg,
                    robotVariant: "error",
                    type: "error",
                    autoClose: 3000
                })
            )
          } else {
            setError(response.error || "Failed to update profile");
            toast.error(response.error || "Failed to update profile");
            toast({
                    message: response.error || "Failed to update profile",
                    robotVariant: "error",
                    type: "error",
                    autoClose: 3000
            })
          }
        } else {
          setError(response.error || "Failed to update profile");
          toast({
                message: response.error || "Failed to update profile",
                robotVariant: "error",
                type: "error",
                autoClose: 3000
            })
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setError(`Failed to save changes: ${errorMessage}`);
      toast({
                    message: `Failed to save changes: ${errorMessage}`,
                    robotVariant: "error",
                    type: "error",
                    autoClose: 3000
            })
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    router.push(`/u/${regUserId}/personal-info`);
  };

  // Render field based on component type
  const renderField = () => {
    if (config.componentType === "custom") {
      return (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 text-yellow-800">
          This field requires a custom editor. Please contact support.
        </div>
      );
    }

    switch (config.componentType) {
      case "text-input":
        return (
          <TextInputField
            field={field}
            label={label}
            value={value}
            onChange={setValue}
            disabled={isSaving}
            placeholder={`Enter your ${label.toLowerCase()}`}
            maxLength={field === "phone" ? 20 : 255}
          />
        );

      case "select":
        const genderOptions =
          field === "gender"
            ? [
                { value: "Male", label: "Male" },
                { value: "Female", label: "Female" },
                { value: "Other", label: "Other" },
                { value: "Prefer not to say", label: "Prefer not to say" },
              ]
            : field === "language"
            ? [
                { value: "English (United States)", label: "English (United States)" },
                { value: "English (UK)", label: "English (UK)" },
                { value: "Hindi", label: "Hindi" },
              ]
            : [];

        return (
          <SelectField
            field={field}
            label={label}
            value={value}
            onChange={setValue}
            options={genderOptions}
            disabled={isSaving}
          />
        );

      case "date-picker":
        return (
          <DatePickerField
            field={field}
            label={label}
            value={value}
            onChange={setValue}
            disabled={isSaving}
            maxDate={new Date().toISOString().split("T")[0]}
          />
        );

      case "image-upload":
        return (
          <ImageUploadField
            field={field}
            label={label}
            onChange={(val) => setValue(val || "")}
            previewUrl={value || account.profile_image_url || undefined}
            name={account.name}
            helpText="Upload a JPG, PNG or GIF image. Max size 2MB."
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Edit {label}</h1>
        <p className="text-gray-600">Update your {label.toLowerCase()} information below.</p>
      </div>

      {/* Form Section */}
      <div className="rounded-lg bg-white p-6 shadow-sm space-y-6">        
        {/* Error Message */}
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-4 space-y-2">
            <p className="text-sm font-semibold text-red-800">{error}</p>
            {validationErrors.length > 0 && (
              <ul className="text-sm text-red-700 list-disc list-inside">
                {validationErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="rounded-md bg-green-50 border border-green-200 p-4">
            <p className="text-sm text-green-800">✓ Changes saved successfully!</p>
          </div>
        )}

        {/* Current Value Display */}
        <div className="rounded-md bg-gray-50 p-4 border border-gray-200">
          <h3 className="text-sm font-medium text-gray-700">Current value</h3>
          <p className="mt-2 text-sm text-gray-900">
            {(field === "profile-picture"
              ? account.profile_image_url
                ? "Image set"
                : "No image"
              : originalValue) || "Not set"}
          </p>
        </div>

        {/* Input Field */}
        {renderField()}


        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : "Save changes"}
          </button>
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
