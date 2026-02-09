import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingClasses = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
} as const;

export function Card({ children, className = "", padding = "lg" }: CardProps) {
  return (
    <div
      className={`bg-white rounded-xl shadow-sm ${paddingClasses[padding]} ${className}`}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  description?: string;
  className?: string;
}

export function CardHeader({ title, description, className = "" }: CardHeaderProps) {
  return (
    <div className={`mb-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {description && <p className="text-gray-600 mt-1">{description}</p>}
    </div>
  );
}
