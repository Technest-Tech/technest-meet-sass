import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';

const createSourceSchema = z.object({
  label: z.string().min(2, 'اسم المصدر مطلوب'),
  description: z.string().optional(),
});

export async function GET() {
  try {
    await requireSuperAdmin();

    const sources = await prisma.subscriptionSource.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ sources });
  } catch (error) {
    console.error('Get subscription sources error:', error);
    return NextResponse.json({ error: 'تعذر جلب مصادر الاشتراكات' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const body = await request.json();
    const parsed = createSourceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const existing = await prisma.subscriptionSource.findFirst({
      where: { label: parsed.data.label },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'يوجد مصدر بنفس الاسم بالفعل' },
        { status: 409 }
      );
    }

    const source = await prisma.subscriptionSource.create({
      data: parsed.data,
    });

    return NextResponse.json({ source }, { status: 201 });
  } catch (error) {
    console.error('Create subscription source error:', error);
    return NextResponse.json({ error: 'تعذر إنشاء المصدر' }, { status: 500 });
  }
}

