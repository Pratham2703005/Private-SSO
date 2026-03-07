"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavItem } from "@/types/account";
import { NavIcon } from "@/components/ui/nav-icon";

interface AccountSidebarProps {
  items: NavItem[];
  regUserId?: string;
}

export function AccountSidebar({ items, regUserId = "0" }: AccountSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 flex-shrink-0">
      <nav className="space-y-1">
        {items.map((item) => {
          // Replace /u/ with /u/[regUserId]/ in navigation links
          const href = item.href.replace(/^\/u\//, `/u/${regUserId}/`);
          // Normalize href by removing trailing slash for comparison
          const normalizedHref = href.replace(/\/$/, '');
          // Normalize current pathname
          const normalizedPathname = pathname.replace(/\/$/, '');
          // Check if current pathname matches the href
          const isActive = normalizedPathname === normalizedHref;
          return (
            <Link
              key={item.href}
              href={href}
              className={`flex items-center gap-4 p-2 pr-4 rounded-full transition-colors w-fit text-gray-700 font-medium hover:bg-gray-300 ${
                isActive
                  ? "bg-white"
                  : " bg-transparent"
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
