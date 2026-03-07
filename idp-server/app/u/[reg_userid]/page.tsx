import { cookies } from "next/headers";
import { getSession, getUserById, getAccountById, switchActiveAccount } from "@/lib/db";
import { getAllAccountsWithIndices } from "@/lib/account-indexing";
import Link from "next/link";
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
import { notFound } from "next/navigation";
import { ReauthWall } from "@/components/account/reauth-wall";

export const metadata = {
  title: "My Accounts SSO",
  description: "One login for all your apps",
};

interface PageProps {
  params: Promise<{ reg_userid: string }>;
}

export default async function HomePage({ params }: PageProps) {
  const { reg_userid } = await params;
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("__sso_session")?.value;
  const jarCookie = cookieStore.get("idp_jar")?.value || null;

  let user: User | null = null;
  let accountId: string | null = null;
  let isNeedsReauth = false;

  // Resolve account from reg_userid (index or account ID)
  const isIndex = /^\d+$/.test(reg_userid);

  // Get session data + session account IDs for reauth detection
  let session: Awaited<ReturnType<typeof getSession>> = null;
  let sessionAccountIds: Set<string> = new Set();

  if (sessionId) {
    session = await getSession(sessionId);
    if (session) {
      const sessionAccounts = await getAllAccountsWithIndices(sessionId);
      sessionAccountIds = new Set(sessionAccounts.map(a => a.id));
    }
  }

  if (isIndex) {
    const indexNum = parseInt(reg_userid, 10);

    // Build stable combined account list: jar order first, then session-only accounts appended
    // This keeps jar indices stable while also covering accounts not yet in the jar.
    const jarAccountIds = jarCookie ? jarCookie.split(',').filter(Boolean) : [];
    const combinedIds = [...jarAccountIds];

    // Append session accounts not already in jar
    for (const id of sessionAccountIds) {
      if (!combinedIds.includes(id)) {
        combinedIds.push(id);
      }
    }

    if (indexNum < 0 || indexNum >= combinedIds.length) {
      notFound();
    }

    accountId = combinedIds[indexNum];
    const accountData = await getAccountById(accountId);
    if (accountData?.user_id) {
      user = await getUserById(accountData.user_id);
    }

    // Check if this account needs reauth (in jar but NOT in active session logons)
    if (accountId && !sessionAccountIds.has(accountId)) {
      isNeedsReauth = true;
    }
  } else {
    // Direct account ID
    accountId = reg_userid;
    const accountData = await getAccountById(reg_userid);
    if (accountData?.user_id) {
      user = await getUserById(accountData.user_id);
    }

    // Check if this account needs reauth
    if (accountId && !sessionAccountIds.has(accountId)) {
      isNeedsReauth = true;
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

  // Account exists in jar but session expired — show reauth wall (Google-style)
  if (isNeedsReauth) {
    // Mask email: show first 2 chars + ***@domain
    const emailParts = user.email.split("@");
    const maskedEmail =
      emailParts[0].substring(0, 2) + "***@" + (emailParts[1] || "");

    return (
      <ReauthWall
        name={user.name}
        maskedEmail={maskedEmail}
        email={user.email}
        initial={user.name?.charAt(0)?.toUpperCase() || "?"}
        returnTo={`/u/${reg_userid}`}
      />
    );
  }

  // URL → Active Account Sync:
  // If we resolved a valid, active (non-reauth) account and it differs from the
  // session's current active_account_id, switch the session to match the URL.
  // This keeps URL jar index and active session account always in sync.
  if (accountId && session && session.active_account_id !== accountId) {
    await switchActiveAccount(sessionId!, accountId);
  }

  // Logged in - show account dashboard (Google-style)
  return (
    <>
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
    </>
  );
}
