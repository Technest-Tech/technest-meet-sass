import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';

const updateSourceSchema = z.object({
  label: z.string().min(2).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();

    const { id } = await params;
    const body = await request.json();
    const parsed = updateSourceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const source = await prisma.subscriptionSource.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({ source });
  } catch (error: any) {
    console.error('Update subscription source error:', error);
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'المصدر غير موجود' }, { status: 404 });
    }
    return NextResponse.json({ error: 'تعذر تحديث المصدر' }, { status: 500 });
  }
}

