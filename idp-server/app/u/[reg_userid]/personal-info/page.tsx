import { cookies } from "next/headers";
import { getSession, getUserById, getAccountById } from "@/lib/db";
import { getAllAccountsWithIndices } from "@/lib/account-indexing";
import { PersonalInfo } from "@/components/account/personal-info";
import type { User, UserAccount } from "@/types/database";
import { notFound, redirect } from "next/navigation";
import { ReauthWall } from "@/components/account/reauth-wall";

export const metadata = {
  title: "Personal Info — My Accounts SSO",
  description: "Manage your personal information",
};

interface PageProps {
  params: Promise<{ reg_userid: string }>;
}

export default async function PersonalInfoPage({ params }: PageProps) {
  const { reg_userid } = await params;
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("__sso_session")?.value;
  const jarCookie = cookieStore.get("idp_jar")?.value || null;

  let user: User | null = null;
  let account: UserAccount | null = null;
  let accountId: string | null = null;
  let isNeedsReauth = false;

  // Resolve account from reg_userid (index or account ID)
  const isIndex = /^\d+$/.test(reg_userid);

  // Get session data + session account IDs for reauth detection
  let sessionAccountIds: Set<string> = new Set();
  let activeAccountId: string | null = null;
  let jarAccountIds: string[] = [];

  if (sessionId) {
    const session = await getSession(sessionId);
    if (session) {
      activeAccountId = session.active_account_id;
      const sessionAccounts = await getAllAccountsWithIndices(sessionId);
      sessionAccountIds = new Set(sessionAccounts.map(a => a.id));
    }
  }

  if (isIndex) {
    const indexNum = parseInt(reg_userid, 10);

    // Build stable combined account list: jar order first, then session-only accounts appended
    jarAccountIds = jarCookie ? jarCookie.split(',').filter(Boolean) : [];
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
    notFound();
  }

  // If current account needs reauth but there's an active account available
  // and it's different from the current one, redirect to the active account's page
  // This handles the case where the widget switched to a different account
  // so we should show that account's page instead of a reauth wall for the old account
  if (isNeedsReauth && activeAccountId && accountId !== activeAccountId && sessionAccountIds.has(activeAccountId)) {
    // Find the index of the active account to build the redirect path
    const activeAccountIndex = jarAccountIds.indexOf(activeAccountId);
    const redirectIndex = activeAccountIndex !== -1 ? activeAccountIndex : reg_userid;
    redirect(`/u/${redirectIndex}/personal-info`);
  }

  // Account exists in jar but session expired — show reauth wall
  if (isNeedsReauth) {
    const emailParts = account.email.split("@");
    const maskedEmail =
      emailParts[0].substring(0, 2) + "***@" + (emailParts[1] || "");

    return (
      <ReauthWall
        name={account.name}
        maskedEmail={maskedEmail}
        email={account.email}
        initial={account.name?.charAt(0)?.toUpperCase() || "?"}
        returnTo={`/u/${reg_userid}/personal-info`}
      />
    );
  }

  // Logged in - show personal info page
  return (
    <PersonalInfo account={account} />
  );
}
