import { redirect } from 'next/navigation';
import { requireClient } from '@/lib/auth/server-auth';
import ReferralCenterClient from './ReferralCenterClient';

export default async function ReferralCenterPage() {
  try {
    const session = await requireClient();
    if (!session.clientId) {
      redirect('/client/login');
    }

    return <ReferralCenterClient userEmail={session.email} clientId={session.clientId} />;
  } catch (error) {
    redirect('/client/login');
  }
}

