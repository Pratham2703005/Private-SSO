import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/db";
import Link from "next/link";
import { AccountLayout } from "@/components/account";
import {
  Card,
  CardHeader,
  Button,
  QuickActionPills,
  SearchBar,
  LandingHeader,
  LandingHero,
  ProfileAvatar,
} from "@/components/ui";
import { QUICK_ACTIONS } from "@/constants/navigation";
import { User } from "@/types/account";

export const metadata = {
  title: "My Accounts SSO",
  description: "One login for all your apps",
};

export default async function HomePage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("__sso_session")?.value;
  //this registered user id will be set according to cookies set account
  // it will be suggest user id like: 0 -> my first account, 1 -> second account and so on. It will be used to show user which account is active in case of multiple accounts are logged in same time.
  const regUserId = cookieStore.get("__reg_userid")?.value; 

  let user: User | null = null;

  if (sessionId) {
    const session = await getSession(sessionId);
    if (session && session.user_id) {
      user = await getUserById(session.user_id);
    }
  }

  if (!user) {
    // Not logged in - show landing page using components
    return (
      <div className="min-h-screen bg-white">
        <LandingHeader brandName="MyOwn" />
        <LandingHero
          title="One Login for All Your Apps"
          subtitle="Sign in once and automatically access all your connected applications. Secure, simple, and seamless."
          showSignUp={true}
        />
      </div>
    );
  }

  // Logged in - show account dashboard (Google-style)
  return (
    <AccountLayout currentPath="/">
      {/* Profile Section - Centered like Google */}
      <div className="mb-12 text-center">
        <div className="flex justify-center mb-6">
          <ProfileAvatar
            name={user.name}
            email={user.email}
            size="2xl"
            showBorder={true}
          />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          {user.name || user.email.split("@")[0]}
        </h2>
        <p className="text-gray-600 mb-2">{user.email}</p>
      </div>

      {/* Search Bar */}
      <div className="mb-10 max-w-2xl mx-auto">
        <SearchBar />
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <CardHeader title="Quick actions" />
        <QuickActionPills actions={QUICK_ACTIONS} />
      </div>

      {/* Connected Apps */}
      <Card>
        <CardHeader
          title="Connected apps"
          description="Manage which apps can access your account"
        />
        <Link href="/account/apps">
          <Button variant="primary">View all apps</Button>
        </Link>
      </Card>
    </AccountLayout>
  );
}
