import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';

const updateClientSchema = z
  .object({
    whatsappNumber: z
      .string()
      .min(6, 'رقم واتساب غير صالح')
      .max(20, 'رقم واتساب طويل للغاية')
      .regex(/^[0-9+]+$/, 'يجب أن يحتوي رقم واتساب على أرقام فقط')
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'لا توجد بيانات لتحديثها',
  });

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();

    const { id } = await params;
    const body = await request.json();
    const validated = updateClientSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0].message },
        { status: 400 }
      );
    }

    const client = await prisma.client.update({
      where: { id },
      data: validated.data,
      select: {
        id: true,
        name: true,
        email: true,
        whatsappNumber: true,
      },
    });

    return NextResponse.json({ client });
  } catch (error: any) {
    console.error('Update client contact error:', error);

    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'حدث خطأ أثناء تحديث بيانات العميل' },
      { status: 500 }
    );
  }
}

