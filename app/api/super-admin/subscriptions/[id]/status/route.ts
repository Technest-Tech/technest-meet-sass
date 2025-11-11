import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { z } from 'zod';

const updateStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'EXPIRED']),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();

    const { id } = await params;
    const body = await request.json();
    const validated = updateStatusSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0].message },
        { status: 400 }
      );
    }

    const { status } = validated.data;

    const subscription = await prisma.subscription.update({
      where: { id },
      data: { status },
      include: {
        client: {
          include: {
            account: true,
          },
        },
        plan: {
          include: {
            features: true,
          },
        },
      },
    });

    return NextResponse.json({ subscription });
  } catch (error) {
    console.error('Update subscription status error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تحديث حالة الاشتراك' },
      { status: 500 }
    );
  }
}

