import { ReactNode } from "react";
import { AccountHeader } from "./account-header";
import { AccountFooter } from "./account-footer";
import { AccountSidebar } from "./account-sidebar";
import { NAVIGATION_ITEMS, FOOTER_LINKS } from "@/constants/navigation";

interface AccountLayoutProps {
  children: ReactNode;
  currentPath?: string;
  regUserId?: string;
}

export function AccountLayout({
  children,
  currentPath = "/",
  regUserId = "0",
}: AccountLayoutProps) {
  return (
    <div className="min-h-dvh bg-var(--background) flex flex-col">
      <AccountHeader />

      <div className="flex flex-col md:flex-row flex-1 gap-4 md:gap-8 px-4 md:px-6 py-4 md:py-8 w-full">
        <AccountSidebar items={NAVIGATION_ITEMS} regUserId={regUserId} />

        <main className="flex-1 min-w-0">{children}</main>
      </div>

      <AccountFooter links={FOOTER_LINKS} />
    </div>
  );
}
