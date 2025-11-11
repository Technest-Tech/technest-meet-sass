import { NextRequest, NextResponse } from 'next/server';
import { requireClient } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';

// All possible features in the system
const ALL_FEATURES = [
  'RECORDING',
  'WAITING_ROOM',
  'PRIVATE_CHAT',
  'GUEST_UNMUTE',
  'HOST_APPROVAL',
  'SCREEN_ANNOTATION',
  'FILE_SHARING',
  'PDF_VIEWER',
  'REACTIONS',
  'RAISE_HAND',
  'E2EE',
  'CUSTOM_BRANDING',
  'PICTURE_IN_PICTURE',
  'STUDENT_MONITOR_PIP',
  'COLLABORATIVE_WHITEBOARD',
  'NORMAL_WHITEBOARD',
  'MANAGE_PARTICIPANTS',
  'VIRTUAL_BACKGROUND',
] as const;

export async function GET(request: NextRequest) {
  try {
    const session = await requireClient();

    if (!session.clientId) {
      return NextResponse.json(
        { error: 'معرف العميل غير موجود' },
        { status: 400 }
      );
    }

    const subscription = await prisma.subscription.findUnique({
      where: { clientId: session.clientId },
      include: {
        plan: {
          include: {
            features: true,
          },
        },
      },
    });

    if (!subscription) {
      return NextResponse.json({
        status: 'INACTIVE',
        plan: null,
      });
    }

    // Build complete feature list with enabled/disabled status
    const allFeaturesWithStatus = subscription.plan
      ? ALL_FEATURES.map((featureName) => {
          const planFeature = subscription.plan!.features.find(
            (f) => f.feature === featureName
          );
          return {
            feature: featureName,
            enabled: planFeature ? planFeature.enabled : false,
          };
        })
      : ALL_FEATURES.map((featureName) => ({
          feature: featureName,
          enabled: false,
        }));

    return NextResponse.json({
      status: subscription.status,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
      plan: subscription.plan
        ? {
            name: subscription.plan.name,
            description: subscription.plan.description,
            features: allFeaturesWithStatus,
          }
        : null,
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب معلومات الاشتراك' },
      { status: 500 }
    );
  }
}

