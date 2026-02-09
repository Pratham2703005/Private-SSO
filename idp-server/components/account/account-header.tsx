"use client";
import Link from "next/link";

interface AccountHeaderProps {
  showHelp?: boolean;
  showSignOut?: boolean;
}

export function AccountHeader({
  showHelp = true,
  showSignOut = true,
}: AccountHeaderProps) {
  const handleLogout = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    window.location.href = "/";
  };

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

        {showSignOut && (
          <form onSubmit={handleLogout}>
            <button
              type="submit"
              className="text-gray-700 hover:text-gray-900 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Sign out
            </button>
          </form>   
        )}
      </div>
    </header>
  );
}
