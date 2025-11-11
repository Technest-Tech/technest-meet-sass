import { redirect } from 'next/navigation';
import { getSession, requireSuperAdmin } from '@/lib/auth/server-auth';
import SuperAdminDashboardClient from './SuperAdminDashboardClient';

export default async function SuperAdminDashboard() {
  try {
    await requireSuperAdmin();
  } catch (error) {
    redirect('/super-admin/login');
  }

  const session = await getSession();

  return <SuperAdminDashboardClient userEmail={session?.email || ''} />;
}

