import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';

const settingsSchema = z.object({
  registerPoints: z.number().int().min(0),
  subscribePoints: z.number().int().min(0),
  largePlanPoints: z.number().int().min(0),
  largePlanThreshold: z.number().int().min(0).nullable().optional(),
  minRedeemPoints: z.number().int().min(0),
  creditPointValue: z.number().int().min(0),
  freeRoomDays: z.number().int().min(0),
});

export async function GET() {
  try {
    await requireSuperAdmin();
    const settings = await prisma.referralSetting.findFirst();
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Get referral settings error', error);
    return NextResponse.json(
      { error: 'Unable to fetch referral settings' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireSuperAdmin();
    const body = await request.json();
    const parsed = settingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid payload' },
        { status: 400 },
      );
    }

    const existing = await prisma.referralSetting.findFirst();
    const settings = existing
      ? await prisma.referralSetting.update({
          where: { id: existing.id },
          data: parsed.data,
        })
      : await prisma.referralSetting.create({ data: parsed.data });

    return NextResponse.json({ settings, updatedBy: session.userId });
  } catch (error) {
    console.error('Update referral settings error', error);
    return NextResponse.json(
      { error: 'Unable to update referral settings' },
      { status: 500 },
    );
  }
}

