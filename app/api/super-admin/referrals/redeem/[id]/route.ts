import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { RedeemRequestStatus } from '@prisma/client';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { updateRedeemRequestStatus } from '@/lib/services/referrals';

const updateSchema = z.object({
  status: z.nativeEnum(RedeemRequestStatus),
  notes: z.string().optional(),
});

type RouteParams = {
  params: {
    id: string;
  };
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSuperAdmin();
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid payload' },
        { status: 400 },
      );
    }

    const updated = await updateRedeemRequestStatus({
      requestId: params.id,
      status: parsed.data.status,
      reviewerId: session.userId,
      notes: parsed.data.notes,
    });

    return NextResponse.json({ request: updated });
  } catch (error) {
    console.error('Update redeem request error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update request' },
      { status: 400 },
    );
  }
}

