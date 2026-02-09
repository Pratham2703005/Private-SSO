import { NavItemColor } from "@/types/account";

export function getColorClasses(color: NavItemColor): {
  background: string;
  hover: string;
} {
  const colorMap: Record<
    NavItemColor,
    { background: string; hover: string }
  > = {
    blue: {
      background: "bg-blue-100",
      hover: "hover:bg-blue-200",
    },
    green: {
      background: "bg-green-100",
      hover: "hover:bg-green-200",
    },
    cyan: {
      background: "bg-cyan-100",
      hover: "hover:bg-cyan-200",
    },
    purple: {
      background: "bg-purple-100",
      hover: "hover:bg-purple-200",
    },
    pink: {
      background: "bg-pink-100",
      hover: "hover:bg-pink-200",
    },
    orange: {
      background: "bg-orange-100",
      hover: "hover:bg-orange-200",
    },
    yellow: {
      background: "bg-yellow-100",
      hover: "hover:bg-yellow-200",
    },
  };

  return colorMap[color];
}

export function getUserInitial(name: string, email: string): string {
  const displayName = name || email;
  return displayName[0].toUpperCase();
}

export function getDisplayName(name: string, email: string): string {
  return name || email.split("@")[0];
}
