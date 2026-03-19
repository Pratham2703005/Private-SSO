import { cookies } from "next/headers";
import { getSession, getUserById, getAccountById } from "@/lib/db";
import { getAllAccountsWithIndices } from "@/lib/account-indexing";
import type { User, UserAccount } from "@/types/database";

export type PersonalInfoAccessResult =
  | { status: "not-found" }
  | { status: "redirect"; destination: string }
  | { status: "reauth"; account: UserAccount; returnTo: string }
  | { status: "ok"; account: UserAccount; user: User };

function buildMaskedEmail(email: string): string {
  const emailParts = email.split("@");
  return emailParts[0].substring(0, 2) + "***@" + (emailParts[1] || "");
}

export function getMaskedEmailForReauth(account: UserAccount): string {
  return buildMaskedEmail(account.email);
}

export async function resolvePersonalInfoAccess(
  regUserId: string,
  returnTo: string,
): Promise<PersonalInfoAccessResult> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("__sso_session")?.value;
  const jarCookie = cookieStore.get("idp_jar")?.value || null;

  let user: User | null = null;
  let account: UserAccount | null = null;
  let accountId: string | null = null;
  let isNeedsReauth = false;

  const isIndex = /^\d+$/.test(regUserId);

  let sessionAccountIds: Set<string> = new Set();
  let activeAccountId: string | null = null;
  let jarAccountIds: string[] = [];

  if (sessionId) {
    const session = await getSession(sessionId);
    if (session) {
      activeAccountId = session.active_account_id;
      const sessionAccounts = await getAllAccountsWithIndices(sessionId);
      sessionAccountIds = new Set(sessionAccounts.map((sessionAccount) => sessionAccount.id));
    }
  }

  if (isIndex) {
    const indexNum = parseInt(regUserId, 10);

    jarAccountIds = jarCookie ? jarCookie.split(",").filter(Boolean) : [];
    const combinedIds = [...jarAccountIds];

    for (const sessionAccountId of sessionAccountIds) {
      if (!combinedIds.includes(sessionAccountId)) {
        combinedIds.push(sessionAccountId);
      }
    }

    if (indexNum < 0 || indexNum >= combinedIds.length) {
      return { status: "not-found" };
    }

    accountId = combinedIds[indexNum];
    account = await getAccountById(accountId);
    if (account?.user_id) {
      user = await getUserById(account.user_id);
    }

    if (accountId && !sessionAccountIds.has(accountId)) {
      isNeedsReauth = true;
    }
  } else {
    accountId = regUserId;
    account = await getAccountById(regUserId);
    if (account?.user_id) {
      user = await getUserById(account.user_id);
    }

    if (accountId && !sessionAccountIds.has(accountId)) {
      isNeedsReauth = true;
    }
  }

  if (!user || !account) {
    return { status: "not-found" };
  }

  if (isNeedsReauth && activeAccountId && accountId !== activeAccountId && sessionAccountIds.has(activeAccountId)) {
    const activeAccountIndex = jarAccountIds.indexOf(activeAccountId);
    const redirectIndex = activeAccountIndex !== -1 ? activeAccountIndex.toString() : regUserId;
    return {
      status: "redirect",
      destination: `/u/${redirectIndex}/personal-info`,
    };
  }

  if (isNeedsReauth) {
    return {
      status: "reauth",
      account,
      returnTo,
    };
  }

  return {
    status: "ok",
    account,
    user,
  };
}
