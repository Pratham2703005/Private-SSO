import { cookies } from "next/headers";
import { getSession } from "@/lib/db";
import { getAllAccountsWithIndices } from "@/lib/account-indexing";
import { redirect } from "next/navigation";

/**
 * /u — redirects to the first active account's page, or /signup if none exist.
 */
export default async function UIndexPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("__sso_session")?.value;

  if (sessionId) {
    const session = await getSession(sessionId);
    if (session?.active_account_id) {
      // Has an active account — find its jar index for a stable URL
      const jarCookie = cookieStore.get("idp_jar")?.value || null;
      const jarAccountIds = jarCookie ? jarCookie.split(",").filter(Boolean) : [];
      const jarIndex = jarAccountIds.indexOf(session.active_account_id);

      if (jarIndex !== -1) {
        redirect(`/u/${jarIndex}`);
      }

      // Fallback: find session index
      const accounts = await getAllAccountsWithIndices(sessionId);
      const activeIdx = accounts.findIndex(a => a.id === session.active_account_id);
      redirect(`/u/${activeIdx !== -1 ? activeIdx : 0}`);
    }

    // Session exists but no active account — check if any accounts exist
    const accounts = await getAllAccountsWithIndices(sessionId);
    if (accounts.length > 0) {
      redirect("/u/0");
    }
  }

  // No session or no accounts — send to signup
  redirect("/signup");
}
