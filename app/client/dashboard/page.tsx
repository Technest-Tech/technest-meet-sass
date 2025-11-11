import { redirect } from 'next/navigation';
import { getSession, requireClient } from '@/lib/auth/server-auth';
import ClientDashboardClient from './ClientDashboardClient';

export default async function ClientDashboard() {
  try {
    const session = await requireClient();
    
    if (!session.clientId) {
      redirect('/client/login');
    }

    return <ClientDashboardClient clientId={session.clientId} userEmail={session.email} />;
  } catch (error) {
    redirect('/client/login');
  }
}

