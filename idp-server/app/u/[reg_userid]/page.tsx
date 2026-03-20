import { cookies } from "next/headers";
import { getSession, getUserById, getAccountById, switchActiveAccount } from "@/lib/db";
import { getAllAccountsWithIndices, getTopRememberedAccountId } from "@/lib/account-indexing";
import Link from "next/link";
import {
  Card,
  CardHeader,
  Button,
  QuickActionPills,
  SearchBar,
  LandingHeader,
  LandingHero,
  AvatarImage,
} from "@/components/ui";
import { QUICK_ACTIONS } from "@/constants/navigation";
import type { User, UserAccount } from "@/types/database";
import { notFound, redirect } from "next/navigation";
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
  let account: UserAccount | null = null;
  let accountId: string | null = null;
  let isNeedsReauth = false;
  let jarAccountIds: string[] = [];
  let combinedIds: string[] = [];

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

  jarAccountIds = jarCookie ? jarCookie.split(',').filter(Boolean) : [];
  combinedIds = [...jarAccountIds];
  for (const id of sessionAccountIds) {
    if (!combinedIds.includes(id)) {
      combinedIds.push(id);
    }
  }

  if (isIndex) {
    const indexNum = parseInt(reg_userid, 10);

    // Build stable combined account list: jar order first, then session-only accounts appended
    // This keeps jar indices stable while also covering accounts not yet in the jar.
    if (indexNum < 0 || indexNum >= combinedIds.length) {
      notFound();
    }

    accountId = combinedIds[indexNum];
    account = await getAccountById(accountId);
    if (account?.user_id) {
      user = await getUserById(account.user_id);
    }

    // Check if this account needs reauth (in jar but NOT in active session logons)
    if (accountId && !sessionAccountIds.has(accountId)) {
      isNeedsReauth = true;
    }
  } else {
    // Direct account ID
    accountId = reg_userid;
    account = await getAccountById(reg_userid);
    if (account?.user_id) {
      user = await getUserById(account.user_id);
    }

    // Check if this account needs reauth
    if (accountId && !sessionAccountIds.has(accountId)) {
      isNeedsReauth = true;
    }
  }

  if (!user || !account) {
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

  const topSignedInAccountId = combinedIds.find((id) => sessionAccountIds.has(id)) || null;
  const hasAnySignedInAccount = topSignedInAccountId !== null;
  const hasRememberedJarAccounts = jarAccountIds.length > 0;

  if (isNeedsReauth && hasAnySignedInAccount) {
    const targetId = topSignedInAccountId!;
    const redirectIndex = combinedIds.indexOf(targetId);
    const redirectSegment = redirectIndex >= 0 ? String(redirectIndex) : targetId;
    redirect(`/u/${redirectSegment}`);
  }

  // Reauth wall only when remembered accounts exist but all are signed out.
  if (isNeedsReauth && hasRememberedJarAccounts && !hasAnySignedInAccount) {
    const topRememberedAccountId = await getTopRememberedAccountId(jarCookie);
    if (topRememberedAccountId && accountId !== topRememberedAccountId) {
      const redirectIndex = combinedIds.indexOf(topRememberedAccountId);
      const redirectSegment = redirectIndex >= 0 ? String(redirectIndex) : topRememberedAccountId;
      redirect(`/u/${redirectSegment}`);
    }

    // Mask email: show first 2 chars + ***@domain
    const emailParts = account.email.split("@");
    const maskedEmail =
      emailParts[0].substring(0, 2) + "***@" + (emailParts[1] || "");

    return (
      <ReauthWall
        name={account.name}
        maskedEmail={maskedEmail}
        email={account.email}
        initial={account.name?.charAt(0)?.toUpperCase() || "?"}
        imageUrl={account.profile_image_url}
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
          <AvatarImage
            name={account.name}
            imageUrl={account.profile_image_url}
            redirectUrl={`/u/${reg_userid}/personal-info/profile-picture`}
            size={190}
          />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          {account.name || account.email.split("@")[0]}
        </h2>
        <p className="text-gray-600 mb-2">{account.email}</p>
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
