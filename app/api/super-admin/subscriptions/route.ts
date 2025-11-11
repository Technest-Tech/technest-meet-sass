import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { z } from 'zod';

const createSubscriptionSchema = z.object({
  clientId: z.string().min(1, 'معرف العميل مطلوب'),
  planId: z.string().min(1, 'معرف الخطة مطلوب'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'EXPIRED']).default('INACTIVE'),
});

// GET - List all subscriptions
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const subscriptions = await prisma.subscription.findMany({
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ subscriptions });
  } catch (error) {
    console.error('Get subscriptions error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب الاشتراكات' },
      { status: 500 }
    );
  }
}

// POST - Create or update subscription
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const body = await request.json();
    const validated = createSubscriptionSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0].message },
        { status: 400 }
      );
    }

    const { clientId, planId, status } = validated.data;

    // Check if client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'العميل غير موجود' },
        { status: 404 }
      );
    }

    // Check if plan exists
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return NextResponse.json(
        { error: 'الخطة غير موجودة' },
        { status: 404 }
      );
    }

    // Get plan features
    const planWithFeatures = await prisma.plan.findUnique({
      where: { id: planId },
      include: {
        features: true,
      },
    });

    const enabledFeatures = planWithFeatures?.features
      .filter((f) => f.enabled)
      .map((f) => f.feature) || [];

    // Create or update subscription
    const subscription = await prisma.subscription.upsert({
      where: { clientId },
      update: {
        planId,
        status,
      },
      create: {
        clientId,
        planId,
        status,
      },
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

    // Automatically sync all existing rooms for this client with new plan features
    await prisma.room.updateMany({
      where: {
        clientId: clientId,
      },
      data: {
        canRecord: enabledFeatures.includes('RECORDING'),
        requireWaitingRoom: enabledFeatures.includes('WAITING_ROOM'),
        allowGuestUnmute: enabledFeatures.includes('GUEST_UNMUTE'),
        enablePrivateChat: enabledFeatures.includes('PRIVATE_CHAT'),
        enableScreenAnnotation: enabledFeatures.includes('SCREEN_ANNOTATION'),
        enableFileSharing: enabledFeatures.includes('FILE_SHARING'),
        enablePdfViewer: enabledFeatures.includes('PDF_VIEWER'),
        enableReactions: enabledFeatures.includes('REACTIONS'),
        enableRaiseHand: enabledFeatures.includes('RAISE_HAND'),
        enableE2EE: enabledFeatures.includes('E2EE'),
        enableCollaborativeWhiteboard: enabledFeatures.includes('COLLABORATIVE_WHITEBOARD'),
        enableNormalWhiteboard: enabledFeatures.includes('NORMAL_WHITEBOARD'),
        enableManageParticipants: enabledFeatures.includes('MANAGE_PARTICIPANTS'),
        enableVirtualBackground: enabledFeatures.includes('VIRTUAL_BACKGROUND'),
      },
    });

    console.log(`✅ Auto-synced rooms for client ${clientId} with new plan ${planId}`);

    return NextResponse.json({ subscription }, { status: 201 });
  } catch (error) {
    console.error('Create subscription error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء إنشاء الاشتراك' },
      { status: 500 }
    );
  }
}

