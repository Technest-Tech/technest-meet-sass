import { redirect } from 'next/navigation';
import { getSession, requireSuperAdmin } from '@/lib/auth/server-auth';
import AccountsManagementClient from './AccountsManagementClient';

export default async function AccountsPage() {
  try {
    await requireSuperAdmin();
  } catch (error) {
    redirect('/super-admin/login');
  }

  const session = await getSession();
  return <AccountsManagementClient userEmail={session?.email || ''} />;
}

