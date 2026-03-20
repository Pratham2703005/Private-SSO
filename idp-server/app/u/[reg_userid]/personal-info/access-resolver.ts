import { cookies } from "next/headers";
import { getSession, getUserById, getAccountById } from "@/lib/db";
import { getAllAccountsWithIndices, getTopRememberedAccountId } from "@/lib/account-indexing";
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
  let jarAccountIds: string[] = [];
  let combinedIds: string[] = [];

  if (sessionId) {
    const session = await getSession(sessionId);
    if (session) {
      const sessionAccounts = await getAllAccountsWithIndices(sessionId);
      sessionAccountIds = new Set(sessionAccounts.map((sessionAccount) => sessionAccount.id));
    }
  }

  jarAccountIds = jarCookie ? jarCookie.split(",").filter(Boolean) : [];
  combinedIds = [...jarAccountIds];
  for (const sessionAccountId of sessionAccountIds) {
    if (!combinedIds.includes(sessionAccountId)) {
      combinedIds.push(sessionAccountId);
    }
  }

  if (isIndex) {
    const indexNum = parseInt(regUserId, 10);

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

  const topSignedInAccountId = combinedIds.find((id) => sessionAccountIds.has(id)) || null;
  const hasAnySignedInAccount = topSignedInAccountId !== null;
  const hasRememberedJarAccounts = jarAccountIds.length > 0;

  if (isNeedsReauth && hasAnySignedInAccount) {
    const targetId = topSignedInAccountId!;
    const redirectIndex = combinedIds.indexOf(targetId);
    const redirectSegment = redirectIndex >= 0 ? String(redirectIndex) : targetId;
    return {
      status: "redirect",
      destination: `/u/${redirectSegment}/personal-info`,
    };
  }

  // Reauth wall should only appear when there are remembered jar accounts,
  // the requested account needs reauth, and no account is currently signed in.
  if (isNeedsReauth && hasRememberedJarAccounts && !hasAnySignedInAccount) {
    const topRememberedAccountId = await getTopRememberedAccountId(jarCookie);
    if (topRememberedAccountId && accountId !== topRememberedAccountId) {
      const redirectIndex = combinedIds.indexOf(topRememberedAccountId);
      const redirectSegment = redirectIndex >= 0 ? String(redirectIndex) : topRememberedAccountId;
      const rewrittenReturnTo = returnTo.replace(/^\/u\/[^/]+/, `/u/${redirectSegment}`);
      return {
        status: "redirect",
        destination: rewrittenReturnTo,
      };
    }

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
