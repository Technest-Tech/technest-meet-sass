import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { registerReferralSignup } from '@/lib/services/referrals';

const referralRegisterSchema = z.object({
  referralCode: z.string().min(4, 'Referral code is required'),
  email: z.string().email().optional(),
  metadata: z.record(z.any()).optional(),
  prospect: z
    .object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      companyName: z.string().optional(),
      desiredPlanId: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = referralRegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid payload' },
        { status: 400 },
      );
    }

    const { referralCode, email, metadata, prospect } = parsed.data;
    const event = await registerReferralSignup({
      referralCode,
      referredEmail: email,
      metadata,
      prospect,
    });

    return NextResponse.json({ event });
  } catch (error) {
    console.error('Referral register error', error);
    return NextResponse.json(
      { error: 'Unable to record referral' },
      { status: 500 },
    );
  }
}

