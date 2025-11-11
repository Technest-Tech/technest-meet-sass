import { redirect } from 'next/navigation';
import { getSession, requireClient } from '@/lib/auth/server-auth';
import RoomsManagementClient from './RoomsManagementClient';

export default async function RoomsPage() {
  try {
    const session = await requireClient();
    
    if (!session.clientId) {
      redirect('/client/login');
    }

    return <RoomsManagementClient clientId={session.clientId} userEmail={session.email} />;
  } catch (error) {
    redirect('/client/login');
  }
}
