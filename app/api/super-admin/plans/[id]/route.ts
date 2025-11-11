import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { z } from 'zod';

const updatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

// PUT - Update plan
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();

    const { id } = await params;
    const body = await request.json();
    const validated = updatePlanSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0].message },
        { status: 400 }
      );
    }

    const plan = await prisma.plan.update({
      where: { id },
      data: validated.data,
      include: {
        features: true,
      },
    });

    return NextResponse.json({ plan });
  } catch (error: any) {
    console.error('Update plan error:', error);
    
    // Provide more specific error messages
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'الخطة غير موجودة' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'حدث خطأ أثناء تحديث الخطة' },
      { status: 500 }
    );
  }
}

// DELETE - Delete plan
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();

    const { id } = await params;

    // Check if plan has active subscriptions
    const subscriptions = await prisma.subscription.count({
      where: {
        planId: id,
        status: 'ACTIVE',
      },
    });

    if (subscriptions > 0) {
      return NextResponse.json(
        { error: 'لا يمكن حذف الخطة لأنها مرتبطة باشتراكات نشطة' },
        { status: 400 }
      );
    }

    await prisma.plan.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete plan error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء حذف الخطة' },
      { status: 500 }
    );
  }
}

