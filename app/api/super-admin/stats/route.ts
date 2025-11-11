import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const [totalAccounts, totalClients, totalPlans, activeSubscriptions] = await Promise.all([
      prisma.account.count(),
      prisma.client.count(),
      prisma.plan.count(),
      prisma.subscription.count({
        where: { status: 'ACTIVE' },
      }),
    ]);

    return NextResponse.json({
      totalAccounts,
      totalClients,
      totalPlans,
      activeSubscriptions,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب الإحصائيات' },
      { status: 500 }
    );
  }
}

