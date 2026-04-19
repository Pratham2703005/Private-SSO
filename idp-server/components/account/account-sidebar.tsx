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
  
  // Split pathname by '/' and filter out empty segments
  const pathSegments = pathname.split('/').filter(Boolean);
  
  // Get the main section from the current path (typically index 2 after /u/regUserId/)
  // e.g., /u/0/personal-info/name -> personal-info
  const currentSection = pathSegments[2];

  return (
    <aside className="md:w-64 md:shrink-0">
      <nav
        className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4
                   md:flex-col md:gap-0 md:space-y-1 md:overflow-visible md:pb-0 md:mx-0 md:px-0
                   [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          // Replace /u/ with /u/[regUserId]/ in navigation links
          const href = item.href.replace(/^\/u\//, `/u/${regUserId}/`);
          // Get segments from the href
          const hrefSegments = href.split('/').filter(Boolean);

          // Get the main section from href (typically index 2)
          // e.g., /u/0/personal-info -> personal-info
          const hrefSection = hrefSegments[2];

          // Compare main sections
          const isActive = currentSection === hrefSection;

          return (
            <Link
              key={item.href}
              href={href}
              className={`flex shrink-0 items-center gap-4 p-2 pr-4 rounded-full transition-colors whitespace-nowrap md:w-fit text-gray-700 font-medium hover:bg-gray-300 ${
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
