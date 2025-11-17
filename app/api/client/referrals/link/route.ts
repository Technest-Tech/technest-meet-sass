import { NextRequest, NextResponse } from 'next/server';
import { requireClient } from '@/lib/auth/server-auth';
import {
  buildReferralShareUrl,
  ensureReferralLink,
  regenerateReferralLink,
} from '@/lib/services/referrals';

export async function GET() {
  try {
    const session = await requireClient();
    const referralLink = await ensureReferralLink(session.clientId!);

    return NextResponse.json({
      referralLink,
      shareUrl: buildReferralShareUrl(referralLink.code),
    });
  } catch (error) {
    console.error('Get referral link error', error);
    return NextResponse.json(
      { error: 'Unable to fetch referral link' },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const session = await requireClient();
    const referralLink = await regenerateReferralLink(session.clientId!);

    return NextResponse.json({
      referralLink,
      shareUrl: buildReferralShareUrl(referralLink.code),
    });
  } catch (error) {
    console.error('Regenerate referral link error', error);
    return NextResponse.json(
      { error: 'Unable to regenerate referral link' },
      { status: 500 },
    );
  }
}

