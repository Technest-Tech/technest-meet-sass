import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { RewardType } from '@prisma/client';
import { prisma } from '@/lib/database';
import { requireSuperAdmin } from '@/lib/auth/server-auth';

const rewardUpdateSchema = z.object({
  label: z.string().min(3).optional(),
  description: z.string().optional(),
  rewardType: z.nativeEnum(RewardType).optional(),
  costPoints: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
  config: z.record(z.any()).optional(),
});

type RouteParams = {
  params: {
    id: string;
  };
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireSuperAdmin();
    const body = await request.json();
    const parsed = rewardUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid payload' },
        { status: 400 },
      );
    }

    const reward = await prisma.rewardCatalog.update({
      where: { id: params.id },
      data: parsed.data,
    });

    return NextResponse.json({ reward });
  } catch (error) {
    console.error('Update reward error', error);
    return NextResponse.json(
      { error: 'Unable to update reward' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await requireSuperAdmin();
    return NextResponse.json(
      { error: 'حذف المكافآت معطل. يمكنك إلغاء التفعيل فقط.' },
      { status: 403 },
    );
  } catch (error) {
    console.error('Archive reward error', error);
    return NextResponse.json(
      { error: 'Unable to archive reward' },
      { status: 500 },
    );
  }
}

