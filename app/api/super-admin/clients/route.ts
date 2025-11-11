import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';

// GET - List all clients
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const clients = await prisma.client.findMany({
      include: {
        account: true,
        subscription: {
          include: {
            plan: {
              include: {
                features: true,
              },
            },
          },
        },
        _count: {
          select: {
            rooms: true,
            hostAccounts: true,
            guestAccounts: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ clients });
  } catch (error) {
    console.error('Get clients error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب العملاء' },
      { status: 500 }
    );
  }
}

