"use client";

import { useState, useRef } from "react";

interface AvatarProps {
  name?: string;
  imageUrl?: string | null;
  redirectUrl?: string;
  size?: number;
  onImageChange?: (file: File) => void;
}

/**
 * Avatar Component
 *
 * Props:
 * - name: Used to generate initials and fallback color
 * - imageUrl: Preview image URL
 * - redirectUrl: Clicking the avatar navigates to this URL
 * - size: Avatar diameter in px (default: 80)
 * - onImageChange: Called with the new File when user picks one
 */
export function AvatarImage({
  name = "User",
  imageUrl,
  redirectUrl,
  size = 80,
  onImageChange,
}: AvatarProps) {
  const [preview, setPreview] = useState<string | null>(imageUrl || null);
  const [hovered, setHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derive initials from name
  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase())
    .slice(0, 2)
    .join("");

  // Deterministic hue from name string
  const hue =
    name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360;
  const bgColor = `hsl(${hue}, 45%, 32%)`;

  const fontSize = size * 0.38;
  const cameraSize = size * 0.3;
  const cameraBadgeOffset = size * 0.04;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    onImageChange?.(file);
  };

  const handleCameraClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleAvatarClick = () => {
    if (onImageChange) {
      fileInputRef.current?.click();
    } else if (redirectUrl) {
      window.open(redirectUrl, "noopener,noreferrer");
    }
  };

  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        width: size,
        height: size,
        cursor: "pointer",
        userSelect: "none",
      }}
      onClick={handleAvatarClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={redirectUrl ? `Go to ${redirectUrl}` : `Change photo`}
      role="button"
      tabIndex={0}
    >
      {/* Circle */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: bgColor,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow:
            hovered
              ? "0 0 0 3px rgba(255,255,255,0.85)"
              : "none",
          transition: "box-shadow 0.18s ease",
          position: "relative",
        }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span
            style={{
              color: "#fff",
              fontSize,
              fontWeight: 600,
              fontFamily: "'Segoe UI', system-ui, sans-serif",
              letterSpacing: "0.02em",
              lineHeight: 1,
            }}
          >
            {initials}
          </span>
        )}
      </div>

      {/* Camera badge */}
      <button
        onClick={handleCameraClick}
        title="Change photo"
        style={{
          position: "absolute",
          bottom: cameraBadgeOffset,
          right: cameraBadgeOffset,
          width: cameraSize,
          height: cameraSize,
          borderRadius: "50%",
          backgroundColor: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 0,
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = "#f0f0f0")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = "#fff")
        }
      >
        <CameraIcon size={cameraSize * 0.55} />
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </div>
  );
}

interface CameraIconProps {
  size?: number;
}

function CameraIcon({ size = 16 }: CameraIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#444"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
