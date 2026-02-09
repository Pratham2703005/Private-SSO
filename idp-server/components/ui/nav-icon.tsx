import { NavItemColor } from "@/types/account";
import { getColorClasses } from "@/utils/account-helpers";

interface NavIconProps {
  icon: string;
  color: NavItemColor;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "w-8 h-8 text-sm",
  md: "w-10 h-10 text-base",
  lg: "w-12 h-12 text-lg",
} as const;

export function NavIcon({ icon, color, size = "md" }: NavIconProps) {
  const colorClasses = getColorClasses(color);

  return (
    <div
      className={`${sizeClasses[size]} ${colorClasses.background} rounded-full flex items-center justify-center flex-shrink-0`}
    >
      <span className="material-symbols-outlined text-gray-700">{icon}</span>
    </div>
  );
}
