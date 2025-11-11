import { redirect } from 'next/navigation';
import { getSession, requireSuperAdmin } from '@/lib/auth/server-auth';
import ClientsManagementClient from './ClientsManagementClient';

export default async function ClientsPage() {
  try {
    await requireSuperAdmin();
  } catch (error) {
    redirect('/super-admin/login');
  }

  const session = await getSession();
  return <ClientsManagementClient userEmail={session?.email || ''} />;
}

