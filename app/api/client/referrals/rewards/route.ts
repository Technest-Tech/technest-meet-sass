import { NextRequest, NextResponse } from 'next/server';
import { requireClient } from '@/lib/auth/server-auth';
import { listRewardsForClient } from '@/lib/services/referrals';

export async function GET(request: NextRequest) {
  try {
    const session = await requireClient();
    const data = await listRewardsForClient(session.clientId!);
    return NextResponse.json(data);
  } catch (error) {
    console.error('List referral rewards error', error);
    return NextResponse.json(
      { error: 'Unable to fetch rewards' },
      { status: 500 },
    );
  }
}

