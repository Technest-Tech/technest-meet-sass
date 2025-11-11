import { redirect } from 'next/navigation';
import { getSession, requireClient } from '@/lib/auth/server-auth';
import SettingsPageClient from './SettingsPageClient';

export default async function SettingsPage() {
  try {
    const session = await requireClient();
    
    if (!session.clientId) {
      redirect('/client/login');
    }

    return <SettingsPageClient userEmail={session.email} />;
  } catch (error) {
    redirect('/client/login');
  }
}

