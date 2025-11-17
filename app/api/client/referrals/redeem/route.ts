import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireClient } from '@/lib/auth/server-auth';
import { createRedeemRequest } from '@/lib/services/referrals';

const redeemSchema = z.object({
  rewardId: z.string().min(1, 'Reward is required'),
  notes: z.string().optional(),
  payload: z.record(z.any()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireClient();
    const body = await request.json();
    const parsed = redeemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid payload' },
        { status: 400 },
      );
    }

    const redeemRequest = await createRedeemRequest({
      clientId: session.clientId!,
      rewardId: parsed.data.rewardId,
      notes: parsed.data.notes,
      payload: parsed.data.payload,
    });

    return NextResponse.json({ redeemRequest }, { status: 201 });
  } catch (error) {
    console.error('Create redeem request error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to create redeem request' },
      { status: 400 },
    );
  }
}

