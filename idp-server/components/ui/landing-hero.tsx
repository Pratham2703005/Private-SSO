import Link from "next/link";
import { Button } from "./button";

interface LandingHeroProps {
  title: string;
  subtitle: string;
  showSignUp?: boolean;
}

export function LandingHero({
  title,
  subtitle,
  showSignUp = true,
}: LandingHeroProps) {
  return (
    <div className="flex items-center justify-center min-h-[calc(100dvh-73px)] px-4">
      <div className="max-w-2xl w-full text-center">
        <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
          {title}
        </h2>

        <p className="text-xl text-gray-600 mb-8">{subtitle}</p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/login">
            <Button variant="primary" size="lg" className="min-w-[160px]">
              Sign In
            </Button>
          </Link>

          {showSignUp && (
            <Link href="/signup">
              <Button variant="outline" size="lg" className="min-w-[160px]">
                Create Account
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
