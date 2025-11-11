import { redirect } from 'next/navigation';
import { getSession, requireClient } from '@/lib/auth/server-auth';
import SubscriptionPageClient from './SubscriptionPageClient';

export default async function SubscriptionPage() {
  try {
    const session = await requireClient();
    
    if (!session.clientId) {
      redirect('/client/login');
    }

    return <SubscriptionPageClient clientId={session.clientId} userEmail={session.email} />;
  } catch (error) {
    redirect('/client/login');
  }
}
