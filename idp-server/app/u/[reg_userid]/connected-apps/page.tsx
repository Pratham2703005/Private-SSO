import { cookies } from "next/headers";
import { getSession, getUserById, getAccountById, switchActiveAccount } from "@/lib/db";
import { getAllAccountsWithIndices, getTopRememberedAccountId } from "@/lib/account-indexing";
import { notFound, redirect } from "next/navigation";
import { ReauthWall } from "@/components/account/reauth-wall";
import { LandingHeader, LandingHero } from "@/components/ui";
import { ConnectedAppsList } from "@/components/account/connected-apps-list";
import type { User, UserAccount } from "@/types/database";

interface PageProps {
  params: Promise<{ reg_userid: string }>;
}

export const metadata = {
  title: "Connected Apps - MyOwn SSO",
  description: "Manage your connected OAuth applications",
};

export default async function ConnectedAppsPage({ params }: PageProps) {
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
    if (indexNum < 0 || indexNum >= combinedIds.length) {
      notFound();
    }

    accountId = combinedIds[indexNum];
    account = await getAccountById(accountId);
    if (account?.user_id) {
      user = await getUserById(account.user_id);
    }

    // Check if this account needs reauth
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
    // Not logged in - show landing page
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
    redirect(`/u/${redirectSegment}/connected-apps`);
  }

  // Reauth wall only when remembered accounts exist but all are signed out.
  if (isNeedsReauth && hasRememberedJarAccounts && !hasAnySignedInAccount) {
    const topRememberedAccountId = await getTopRememberedAccountId(jarCookie);
    if (topRememberedAccountId && accountId !== topRememberedAccountId) {
      const redirectIndex = combinedIds.indexOf(topRememberedAccountId);
      const redirectSegment = redirectIndex >= 0 ? String(redirectIndex) : topRememberedAccountId;
      redirect(`/u/${redirectSegment}/connected-apps`);
    }

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
        returnTo={`/u/${reg_userid}/connected-apps`}
      />
    );
  }

  // Sync URL → Active Account
  if (accountId && session && session.active_account_id !== accountId) {
    await switchActiveAccount(sessionId!, accountId);
  }

  // Logged in - show connected apps carousel
  return (
    <div className="h-full flex flex-col items-center justify-center">
        <ConnectedAppsList />
    </div>
  );
}
