import { NextRequest, NextResponse } from 'next/server';
import { requireClient } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { checkTrialExpiration, getTrialDaysRemaining } from '@/lib/utils/trial-check';

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
  'NOISE_CANCELLATION',
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

    // Check and update trial expiration if needed
    const checkedSubscription = await checkTrialExpiration(subscription);

    // Build complete feature list with enabled/disabled status
    const allFeaturesWithStatus = checkedSubscription.plan
      ? ALL_FEATURES.map((featureName) => {
          const planFeature = checkedSubscription.plan!.features.find(
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

    // Calculate trial days remaining
    const trialDaysRemaining = checkedSubscription.isTrial 
      ? getTrialDaysRemaining(checkedSubscription)
      : null;

    return NextResponse.json({
      status: checkedSubscription.status,
      createdAt: checkedSubscription.createdAt,
      updatedAt: checkedSubscription.updatedAt,
      isTrial: checkedSubscription.isTrial,
      trialStartDate: checkedSubscription.trialStartDate,
      trialEndDate: checkedSubscription.trialEndDate,
      trialDays: checkedSubscription.trialDays,
      trialDaysRemaining,
      plan: checkedSubscription.plan
        ? {
            name: checkedSubscription.plan.name,
            description: checkedSubscription.plan.description,
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

