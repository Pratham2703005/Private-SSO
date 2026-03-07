import { cookies } from "next/headers";
import { getSession, getUserById, getAccountById } from "@/lib/db";
import { getAllAccountsWithIndices } from "@/lib/account-indexing";
import { PersonalInfo } from "@/components/account/personal-info";
import { User } from "@/types/account";
import { notFound } from "next/navigation";
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
  let accountId: string | null = null;
  let isNeedsReauth = false;

  // Resolve account from reg_userid (index or account ID)
  const isIndex = /^\d+$/.test(reg_userid);

  // Get session data + session account IDs for reauth detection
  let sessionAccountIds: Set<string> = new Set();

  if (sessionId) {
    const session = await getSession(sessionId);
    if (session) {
      const sessionAccounts = await getAllAccountsWithIndices(sessionId);
      sessionAccountIds = new Set(sessionAccounts.map(a => a.id));
    }
  }

  if (isIndex) {
    const indexNum = parseInt(reg_userid, 10);

    // Build stable combined account list: jar order first, then session-only accounts appended
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
    notFound();
  }

  // Account exists in jar but session expired — show reauth wall
  if (isNeedsReauth) {
    const emailParts = user.email.split("@");
    const maskedEmail =
      emailParts[0].substring(0, 2) + "***@" + (emailParts[1] || "");

    return (
      <ReauthWall
        name={user.name}
        maskedEmail={maskedEmail}
        email={user.email}
        initial={user.name?.charAt(0)?.toUpperCase() || "?"}
        returnTo={`/u/${reg_userid}/personal-info`}
      />
    );
  }

  // Logged in - show personal info page
  return (
    <PersonalInfo user={user} />
  );
}
