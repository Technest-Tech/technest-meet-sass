import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';

export async function GET() {
  try {
    await requireSuperAdmin();
    const requests = await prisma.redeemRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        client: true,
        reward: true,
      },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('List redeem requests error', error);
    return NextResponse.json(
      { error: 'Unable to fetch redeem requests' },
      { status: 500 },
    );
  }
}

