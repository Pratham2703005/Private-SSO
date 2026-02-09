import Link from "next/link";
import { QuickAction } from "@/types/account";

interface QuickActionPillsProps {
  actions: QuickAction[];
}

export function QuickActionPills({ actions }: QuickActionPillsProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {actions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className="px-4 py-2 bg-gray-100 text-gray-900 font-medium rounded-full hover:bg-gray-200 transition-colors text-sm"
        >
          {action.label}
        </Link>
      ))}
    </div>
  );
}
