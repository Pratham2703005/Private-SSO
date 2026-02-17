"use client";
import Link from "next/link";
import { WidgetMessageHandler } from "./widget-message-handler";

interface AccountHeaderProps {
  showHelp?: boolean;
  showSignOut?: boolean;
}

export function AccountHeader({
  showHelp = true,
}: AccountHeaderProps) {
  return (
    <header className="bg-transparent px-6 py-4 flex items-center justify-between">
      <h1 className="text-2xl text-gray-900"><span className="font-semibold">Social</span> Account</h1>

      <div className="flex items-center gap-4">
        {showHelp && (
          <Link
            href="/u/1/help"
            className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Help"
          >
            <span className="material-symbols-outlined">help</span>
          </Link>
        )}

        {/* Widget Mount Point - widget.js will inject button here */}
        <div
          id="__account_switcher_mount_point"
          className="shrink-0"
          suppressHydrationWarning
        ></div>

        <WidgetMessageHandler/>
      </div>
    </header>
  );
}
