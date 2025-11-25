import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { getAccountBillingSnapshot } from '@/lib/services/accountMetrics';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSuperAdmin();
    const account = await prisma.account.findUnique({
      where: { id: params.id },
      select: { clientId: true },
    });

    if (!account?.clientId) {
      return NextResponse.json({ error: 'الحساب لا يملك عميلاً مرتبطاً' }, { status: 404 });
    }

    const snapshot = await getAccountBillingSnapshot(account.clientId);
    const lifetimePaidCents = snapshot.paidInvoices.reduce((sum, invoice) => sum + invoice.amountCents, 0);
    const upcomingRenewal = snapshot.subscription?.endDate || null;

    return NextResponse.json({
      snapshot,
      aggregates: {
        lifetimePaidCents,
        upcomingRenewal,
        overdueCount: snapshot.overdueInvoices.length,
      },
    });
  } catch (error) {
    console.error('Get billing snapshot error:', error);
    return NextResponse.json({ error: 'تعذر تحميل بيانات الفوترة' }, { status: 500 });
  }
}

