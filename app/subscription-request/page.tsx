import { redirect } from 'next/navigation';
import SubscriptionRequestClient from './SubscriptionRequestClient';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SubscriptionRequestPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const referralCode = params?.ref;

  if (!referralCode || Array.isArray(referralCode)) {
    redirect('/');
  }

  return <SubscriptionRequestClient referralCode={referralCode} />;
}

