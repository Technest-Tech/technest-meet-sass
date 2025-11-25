import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { DateTime } from 'luxon';

const HEADER_ROWS = [
  'Client Name',
  'Client Email',
  'Plan',
  'Status',
  'Amount (EGP)',
  'Start Date',
  'End Date',
  'Created At',
  'Source',
];

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const planId = searchParams.get('planId') || undefined;
    const sourceId = searchParams.get('sourceId') || undefined;
    const createdMonth = searchParams.get('createdMonth') || undefined; // format: YYYY-MM
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;

    const createdAtFilter =
      createdMonth && /^\d{4}-\d{2}$/.test(createdMonth)
        ? {
            gte: DateTime.fromFormat(createdMonth, 'yyyy-MM')
              .startOf('month')
              .toJSDate(),
            lte: DateTime.fromFormat(createdMonth, 'yyyy-MM')
              .endOf('month')
              .toJSDate(),
          }
        : undefined;

    const dateFilter =
      dateFrom || dateTo
        ? {
            gte: dateFrom ? new Date(dateFrom) : undefined,
            lte: dateTo ? new Date(dateTo) : undefined,
          }
        : undefined;

    const subscriptions = await prisma.subscription.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(planId ? { planId } : {}),
        ...(sourceId && sourceId !== 'UNASSIGNED'
          ? { sourceId }
          : sourceId === 'UNASSIGNED'
            ? { sourceId: null }
            : {}),
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
        ...(dateFilter ? { startDate: dateFilter } : {}),
      },
      include: {
        client: true,
        plan: true,
        source: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const csvRows = subscriptions.map((subscription) => [
      subscription.client.name,
      subscription.client.email,
      subscription.plan?.name ?? 'N/A',
      subscription.status,
      subscription.amountEGP ?? 0,
      subscription.startDate ? DateTime.fromJSDate(subscription.startDate).toISODate() : '',
      subscription.endDate ? DateTime.fromJSDate(subscription.endDate).toISODate() : '',
      DateTime.fromJSDate(subscription.createdAt).toISO(),
      subscription.source?.label ?? 'Unassigned',
    ]);

    const csv = [HEADER_ROWS, ...csvRows].map((row) => row.join(',')).join('\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="subscriptions-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export subscriptions error:', error);
    return NextResponse.json({ error: 'تعذر تصدير الاشتراكات' }, { status: 500 });
  }
}

