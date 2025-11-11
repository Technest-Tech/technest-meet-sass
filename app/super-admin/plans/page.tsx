import { redirect } from 'next/navigation';
import { getSession, requireSuperAdmin } from '@/lib/auth/server-auth';
import PlansManagementClient from './PlansManagementClient';

export default async function PlansPage() {
  try {
    await requireSuperAdmin();
  } catch (error) {
    redirect('/super-admin/login');
  }

  const session = await getSession();
  return <PlansManagementClient userEmail={session?.email || ''} />;
}

