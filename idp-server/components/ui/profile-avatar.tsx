import { getUserInitial } from "@/utils/account-helpers";
import { getAvatarColorByName } from "@/lib/avatar-colors";

interface ProfileAvatarProps {
  name: string;
  email: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  showBorder?: boolean;
  imageUrl?: string;
}

const sizeClasses = {
  sm: "w-10 h-10 text-base",
  md: "w-16 h-16 text-2xl",
  lg: "w-20 h-20 text-3xl",
  xl: "w-32 h-32 text-5xl",
  "2xl": "w-40 h-40 text-6xl",
} as const;

export function ProfileAvatar({
  name,
  email,
  size = "lg",
  showBorder = false,
  imageUrl,
}: ProfileAvatarProps) {
  const initial = getUserInitial(name, email);
  const avatarColor = getAvatarColorByName(name || email);
  const borderClass = showBorder
    ? "ring-4 ring-white shadow-lg"
    : "";

  if (imageUrl) {
    return (
      <div
        className={`${sizeClasses[size]} ${borderClass} rounded-full shrink-0 overflow-hidden`}
      >
        <img
          src={imageUrl}
          alt={name || email}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} ${borderClass} rounded-full flex items-center justify-center text-white font-bold shrink-0`}
      style={{ backgroundColor: avatarColor }}
    >
      {initial}
    </div>
  );
}
