import Link from "next/link";
import { NavItem } from "@/types/account";
import { NavIcon } from "@/components/ui/nav-icon";

interface AccountSidebarProps {
  items: NavItem[];
  currentPath?: string;
}

export function AccountSidebar({ items, currentPath = "/" }: AccountSidebarProps) {
  return (
    <aside className="w-64 flex-shrink-0">
      <nav className="space-y-1">
        {items.map((item) => {
          const isActive = currentPath === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-4 p-2 pr-4 rounded-full transition-colors w-fit ${
                isActive
                  ? "bg-white text-blue-700 font-semibold"
                  : "text-gray-700 bg-transparent hover:bg-gray-300 font-medium"
              }`}
            >
              <NavIcon icon={item.icon} color={item.color} size="sm" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
