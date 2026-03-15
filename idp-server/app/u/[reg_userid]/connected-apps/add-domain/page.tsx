import { cookies } from 'next/headers';
import { getSession, getAccountById, getUserById } from '@/lib/db';
import { redirect } from 'next/navigation';
import { AddDomainForm } from './add-domain-form';
import type { User, UserAccount } from '@/types/database';
import { randomBytes } from 'crypto';

// ─── Allowed emails that can register OAuth apps ──────────────────────────────
const AUTHORIZED_EMAILS = [
  'pk2732004@gmail.com',
  'admin@example.com',
  // add more as needed
];

interface PageProps {
  params: Promise<{ reg_userid: string }>;
}

export const metadata = {
  title: 'Add Domain - MyOwn SSO',
  description: 'Register a new OAuth application domain',
};

function generateClientId(): string {
  // Format: <prefix>_<random hex>  e.g. "sso_a3f9c12e847b0d56"
  return `sso_${randomBytes(8).toString('hex')}`;
}

export default async function AddDomainPage({ params }: PageProps) {
  const { reg_userid } = await params;
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

  // Generate a fresh client ID server-side on every page load.
  // The client cannot edit this — it's passed as a read-only prop.
  const generatedClientId = generateClientId();

  return (
    <AddDomainForm
      regUserId={reg_userid}
      userEmail={userEmail}
      isAuthorized={isAuthorized}
      generatedClientId={generatedClientId}
    />
  );
}