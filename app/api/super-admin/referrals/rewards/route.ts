import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireSuperAdmin } from '@/lib/auth/server-auth';

export async function GET() {
  try {
    await requireSuperAdmin();
    const rewards = await prisma.rewardCatalog.findMany({
      orderBy: { createdAt: 'asc' },
      take: 4,
    });
    return NextResponse.json({ rewards });
  } catch (error) {
    console.error('List referral rewards error', error);
    return NextResponse.json(
      { error: 'Unable to fetch rewards' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin();
    return NextResponse.json(
      { error: 'Adding rewards is disabled. استخدم لوحة التحكم الحالية لتعديل المكافآت.' },
      { status: 403 },
    );
  } catch (error) {
    console.error('Create referral reward error', error);
    return NextResponse.json(
      { error: 'Unable to create reward' },
      { status: 500 },
    );
  }
}

