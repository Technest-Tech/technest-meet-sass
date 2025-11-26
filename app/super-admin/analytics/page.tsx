import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server-auth';
import AnalyticsClient from './AnalyticsClient';

export default async function AnalyticsPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== 'SUPER_ADMIN') {
    redirect('/super-admin/login');
  }

  return <AnalyticsClient userEmail={user.email} />;
}

