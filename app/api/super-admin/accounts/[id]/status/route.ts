import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { z } from 'zod';

const updateStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
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

    // Check if account exists
    const account = await prisma.account.findUnique({
      where: { id },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'الحساب غير موجود' },
        { status: 404 }
      );
    }

    // Update status
    const updatedAccount = await prisma.account.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({ account: updatedAccount });
  } catch (error) {
    console.error('Update status error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تحديث حالة الحساب' },
      { status: 500 }
    );
  }
}

