import { NextRequest, NextResponse } from 'next/server';
import { requireClient } from '@/lib/auth/server-auth';
import { getReferralOverview } from '@/lib/services/referrals';

export async function GET(request: NextRequest) {
  try {
    const session = await requireClient();
    const overview = await getReferralOverview(session.clientId!);
    return NextResponse.json(overview);
  } catch (error) {
    console.error('Get referral overview error', error);
    return NextResponse.json(
      { error: 'Unable to load referral overview' },
      { status: 500 },
    );
  }
}

