import { ReactNode } from "react";
import { AccountHeader } from "@/components/account/account-header";
import { AccountFooter } from "@/components/account/account-footer";
import { AccountSidebar } from "@/components/account/account-sidebar";
import { NAVIGATION_ITEMS, FOOTER_LINKS } from "@/constants/navigation";

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ reg_userid: string }>;
}

export default async function AccountLayout({
  children,
  params,
}: LayoutProps) {
  const { reg_userid } = await params;


  return (
    <div className="min-h-dvh bg-var(--background) flex flex-col">
      <AccountHeader />

      <div className="flex flex-col md:flex-row flex-1 gap-4 md:gap-8 px-4 md:px-6 py-4 md:py-8 w-full">
        <AccountSidebar
          items={NAVIGATION_ITEMS}
          regUserId={reg_userid}
        />

        <main className="flex-1 min-w-0">{children}</main>
      </div>

      <AccountFooter links={FOOTER_LINKS} />
    </div>
  );
}
