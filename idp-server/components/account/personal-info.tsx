"use client";

import { UserAccount } from "@/types/database";
import { ProfileAvatar } from "@/components/ui";
import Link from "next/link";

interface PersonalInfoProps {
  account: UserAccount;
  onEditField?: (field: string) => void;
}

interface InfoField {
  icon: string;
  label: string;
  value: string | null;
  isEditable?: boolean;
}

export function PersonalInfo({ account, onEditField }: PersonalInfoProps) {
  const fields: InfoField[] = [
    {
      icon: "📷",
      label: "Profile picture",
      value: account.profile_image_url ? "Uploaded" : "Not set",
      isEditable: true,
    },
    {
      icon: "👤",
      label: "Name",
      value: account.name || "Not set",
      isEditable: true,
    },
    {
      icon: "⚧",
      label: "Gender",
      value: account.gender || "Not set",
      isEditable: true,
    },
    {
      icon: "✉️",
      label: "Email",
      value: account.email,
      isEditable: false,
    },
    {
      icon: "📱",
      label: "Phone",
      value: account.phone || "Not set",
      isEditable: true,
    },
    {
      icon: "🎂",
      label: "Birthday",
      value: account.birthday || "Not set",
      isEditable: true,
    },
    {
      icon: "🌍",
      label: "Language",
      value: account.language || "English (United States)",
      isEditable: true,
    },
    {
      icon: "🏠",
      label: "Home address",
      value: account.home_address || "Not set",
      isEditable: true,
    },
    {
      icon: "💼",
      label: "Work address",
      value: account.work_address || "Not set",
      isEditable: true,
    },
  ];

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Personal info</h1>
        <p className="text-gray-600">
          Manage details that make MyOwn work better for you, and decide what info is visible to others
        </p>
      </div>

      {/* Profile Picture Section */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex justify-center">
              <ProfileAvatar
                name={account.name}
                email={account.email}
                size="lg"
                showBorder={true}
              />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Profile picture</h3>
              <p className="text-sm text-gray-600 mb-3">
                {account.profile_image_url ? "Picture uploaded" : "No picture set"}
              </p>
              <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                Upload picture
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Info Fields Grid */}
      <div className="space-y-4">
        {fields.map((field, index) => (
          <div
            key={index}
            className="bg-white rounded-lg shadow-sm p-6 flex justify-between items-start hover:shadow-md transition-shadow"
          >
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">{field.label}</h3>
              <p className={`text-sm ${
                field.value === "Not set" ? "text-gray-500" : "text-gray-700"
              }`}>
                {field.value === "Not set" ? (
                  <span className="text-gray-400">Not set</span>
                ) : (
                  field.value
                )}
              </p>
            </div>
            {field.isEditable && (
              <button
                onClick={() => onEditField?.(field.label.toLowerCase().replace(/\s+/g, "-"))}
                className="text-blue-600 hover:text-blue-700 font-medium text-sm ml-4"
              >
                Edit
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Password Section */}
      <div className="bg-white rounded-lg shadow-sm p-6 mt-6 flex justify-between items-start hover:shadow-md transition-shadow">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">Password</h3>
          <p className="text-sm text-gray-600">
            Last changed: <span className="text-gray-700">Never</span>
          </p>
        </div>
        <Link href="/account/change-password">
          <button className="text-blue-600 hover:text-blue-700 font-medium text-sm ml-4">
            Change password
          </button>
        </Link>
      </div>

      {/* Additional Addresses Section */}
      <div className="bg-white rounded-lg shadow-sm p-6 mt-6 flex justify-between items-start hover:shadow-md transition-shadow">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">Other addresses</h3>
          <p className="text-sm text-gray-600">
            <span className="text-gray-400">No addresses added</span>
          </p>
        </div>
        <button className="text-blue-600 hover:text-blue-700 font-medium text-sm ml-4">
          Add
        </button>
      </div>
    </div>
  );
}
