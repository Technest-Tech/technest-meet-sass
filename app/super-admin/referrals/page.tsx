import { redirect } from 'next/navigation';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import ReferralManagementClient from './ReferralManagementClient';

export default async function ReferralManagementPage() {
  try {
    const session = await requireSuperAdmin();
    return <ReferralManagementClient userEmail={session.email} />;
  } catch (error) {
    redirect('/super-admin/login');
  }
}

