import { redirect } from 'next/navigation';
import { getSession, requireSuperAdmin } from '@/lib/auth/server-auth';
import SubscriptionsManagementClient from './SubscriptionsManagementClient';

export default async function SubscriptionsPage() {
  try {
    await requireSuperAdmin();
  } catch (error) {
    redirect('/super-admin/login');
  }

  const session = await getSession();
  return <SubscriptionsManagementClient userEmail={session?.email || ''} />;
}

