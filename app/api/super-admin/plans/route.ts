import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { z } from 'zod';
import { FeatureType } from '@prisma/client';

const createPlanSchema = z.object({
  name: z.string().min(1, 'اسم الخطة مطلوب'),
  description: z.string().optional(),
  features: z.array(z.nativeEnum(FeatureType)).default([]),
});

// GET - List all plans
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const plans = await prisma.plan.findMany({
      include: {
        features: true,
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ plans });
  } catch (error) {
    console.error('Get plans error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب الخطط' },
      { status: 500 }
    );
  }
}

// POST - Create new plan
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const body = await request.json();
    console.log('Received body:', JSON.stringify(body, null, 2));
    console.log('Features type:', typeof body.features);
    console.log('Features array:', body.features);
    if (body.features && Array.isArray(body.features)) {
      body.features.forEach((f: any, i: number) => {
        console.log(`Feature ${i}:`, f, 'Type:', typeof f, 'Value:', JSON.stringify(f));
      });
    }
    
    const validated = createPlanSchema.safeParse(body);

    if (!validated.success) {
      console.error('Validation error:', JSON.stringify(validated.error, null, 2));
      const errorMessage = validated.error.errors?.[0]?.message || validated.error.message || 'Validation failed';
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    const { name, description, features } = validated.data;

    // Create plan
    const plan = await prisma.plan.create({
      data: {
        name,
        description,
        isActive: true,
        features: {
          create: features.map((feature) => ({
            feature,
            enabled: true,
          })),
        },
      },
      include: {
        features: true,
      },
    });

    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    console.error('Create plan error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء إنشاء الخطة' },
      { status: 500 }
    );
  }
}

