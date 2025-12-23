import { requireClient } from '@/lib/auth/server-auth';
import { redirect } from 'next/navigation';
import RecordingsListClient from './RecordingsListClient';

export default async function RecordingsPage() {
  const session = await requireClient();

  if (!session.clientId) {
    redirect('/client/login');
  }

  return <RecordingsListClient clientId={session.clientId} userEmail={session.email || ''} />;
}

