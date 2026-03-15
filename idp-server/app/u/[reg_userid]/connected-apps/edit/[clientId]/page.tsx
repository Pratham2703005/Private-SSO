import { cookies } from 'next/headers';
import { getSession, getAccountById, getUserById, supabase } from '@/lib/db';
import { redirect } from 'next/navigation';
import { AddDomainForm } from '@/app/u/[reg_userid]/connected-apps/add-domain/add-domain-form';
import type { User, UserAccount } from '@/types/database';

const AUTHORIZED_EMAILS = [
  'pk2732004@gmail.com',
  'admin@example.com',
];

interface PageProps {
  params: Promise<{ reg_userid: string; clientId: string }>;
}

export const metadata = {
  title: 'Edit Domain - MyOwn SSO',
  description: 'Edit OAuth application domain',
};

export default async function EditDomainPage({ params }: PageProps) {
  const { reg_userid, clientId } = await params;
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('__sso_session')?.value;

  if (!sessionId) redirect('/login');

  const session = await getSession(sessionId);
  if (!session) redirect('/login');

  let account: UserAccount | null = null;
  let user: User | null = null;

  if (session.active_account_id) {
    account = await getAccountById(session.active_account_id);
    if (account?.user_id) {
      user = await getUserById(account.user_id);
    }
  }

  const userEmail = account?.email || user?.email || '';
  const isAuthorized = AUTHORIZED_EMAILS.includes(userEmail.toLowerCase());

  const { data: oauthClient } = await supabase
    .from("oauth_clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (!oauthClient) {
    redirect(`/u/${reg_userid}/connected-apps`);
  }

  return (
    <AddDomainForm
      regUserId={reg_userid}
      userEmail={userEmail}
      isAuthorized={isAuthorized}
      generatedClientId={oauthClient.client_id}
      isEdit={true}
      existingClient={oauthClient}
    />
  );
}
