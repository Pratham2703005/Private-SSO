import Link from "next/link";

interface LandingHeaderProps {
  brandName?: string;
}

export function LandingHeader({ brandName = "MyOwn" }: LandingHeaderProps) {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{brandName}</h1>
        <nav className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            Sign In
          </Link>
        </nav>
      </div>
    </header>
  );
}
