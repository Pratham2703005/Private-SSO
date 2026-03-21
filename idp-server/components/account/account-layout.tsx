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
    <div className="min-h-screen bg-var(--background) flex flex-col">
      <AccountHeader />

      <div className="flex flex-1 gap-8 px-6 py-8 w-full">
        <AccountSidebar items={NAVIGATION_ITEMS} regUserId={regUserId} />

        <main className="flex-1">{children}</main>
      </div>

      <AccountFooter links={FOOTER_LINKS} />
    </div>
  );
}
