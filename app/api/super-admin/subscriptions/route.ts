import { NextRequest, NextResponse } from 'next/server';
import { ReferralEventType } from '@prisma/client';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { qualifyReferralEvent } from '@/lib/services/referrals';

const referralInfoSchema = z.object({
  eventId: z.string().optional(),
  email: z.string().email().optional(),
  code: z.string().optional(),
  type: z.enum(['SUBSCRIBED', 'LARGE_PLAN']).optional(),
  pointsOverride: z.number().int().min(0).optional(),
});

const createSubscriptionSchema = z.object({
  clientId: z.string().min(1, 'معرف العميل مطلوب'),
  planId: z.string().min(1, 'معرف الخطة مطلوب'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'EXPIRED', 'TRIAL', 'TRIAL_EXPIRED']).default('INACTIVE'),
  isTrial: z.boolean().optional(),
  trialDays: z.number().int().min(1).max(365).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  amountEGP: z.number().int().min(0).optional(),
  sourceId: z.string().optional(),
  referral: referralInfoSchema.optional(),
});

// GET - List all subscriptions
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const sourceId = request.nextUrl.searchParams.get('sourceId') || undefined;

    const [subscriptions, activeRoomsByClient] = await Promise.all([
      prisma.subscription.findMany({
        where: {
          ...(sourceId ? { sourceId } : {}),
        },
        include: {
          client: {
            include: {
              account: true,
              rooms: {
                select: {
                  id: true,
                  isActive: true,
                  maxParticipants: true,
                  createdAt: true,
                },
              },
            },
          },
          plan: {
            include: {
              features: true,
            },
          },
          source: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.room.groupBy({
        by: ['clientId'],
        where: {
          isActive: true,
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const activeRoomsLookup = activeRoomsByClient.reduce<Record<string, number>>((acc, curr) => {
      acc[curr.clientId] = curr._count._all;
      return acc;
    }, {});

    const formattedSubscriptions = subscriptions.map((subscription) => {
      const { rooms, ...clientWithoutRooms } = subscription.client;
      const totalRooms = rooms.length;
      const activeRooms = rooms.filter((room) => room.isActive).length;
      const avgRoomCapacity = rooms.length
        ? Math.round(
            rooms.reduce((sum, room) => sum + room.maxParticipants, 0) / rooms.length
          )
        : 0;
      const trialDaysRemaining =
        subscription.trialEndDate && subscription.trialDays
          ? Math.max(
              0,
              Math.ceil(
                (subscription.trialEndDate.getTime() - now.getTime()) /
                  (24 * 60 * 60 * 1000)
              )
            )
          : null;
      const trialProgress =
        subscription.trialDays && trialDaysRemaining !== null
          ? Math.min(
              100,
              Math.max(
                0,
                Math.round(
                  ((subscription.trialDays - trialDaysRemaining) / subscription.trialDays) *
                    100
                )
              )
            )
          : null;

      return {
        ...subscription,
        client: {
          ...clientWithoutRooms,
          roomStats: {
            totalRooms,
            activeRooms,
            avgRoomCapacity,
            activeNow: activeRoomsLookup[subscription.clientId] || 0,
            capacityUtilization:
              clientWithoutRooms.maxRooms > 0
                ? Math.min(1, totalRooms / clientWithoutRooms.maxRooms)
                : 0,
          },
        },
        metrics: {
          trialDaysRemaining,
          trialProgress,
          hasTrialEnded: trialDaysRemaining === 0,
          isExpiringSoon:
            !!subscription.trialEndDate &&
            subscription.trialEndDate <= sevenDaysFromNow &&
            subscription.status === 'TRIAL',
          lastRoomCreatedAt: rooms[0]?.createdAt ?? null,
        },
      };
    });

    const overview = formattedSubscriptions.reduce(
      (acc, sub) => {
        acc.total += 1;
        if (sub.status === 'ACTIVE') acc.active += 1;
        if (sub.status === 'TRIAL') acc.trials += 1;
        if (sub.metrics?.isExpiringSoon) acc.expiringTrials += 1;
        if (['EXPIRED', 'TRIAL_EXPIRED', 'INACTIVE'].includes(sub.status)) {
          acc.atRisk += 1;
        }
        if (sub.status === 'ACTIVE' && sub.metrics?.hasTrialEnded) {
          acc.renewalsDue += 1;
        }
        return acc;
      },
      {
        total: 0,
        active: 0,
        trials: 0,
        expiringTrials: 0,
        renewalsDue: 0,
        atRisk: 0,
      }
    );

    const planDistribution = formattedSubscriptions.reduce<Record<string, number>>(
      (acc, sub) => {
        const planName = sub.plan?.name ?? 'غير محدد';
        acc[planName] = (acc[planName] || 0) + 1;
        return acc;
      },
      {}
    );

    return NextResponse.json({
      subscriptions: formattedSubscriptions,
      overview,
      planDistribution,
    });
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

    const {
      clientId,
      planId,
      status,
      isTrial,
      trialDays,
      startDate,
      endDate,
      amountEGP,
      sourceId,
      referral,
    } =
      validated.data;

    const parsedStartDate = startDate ? new Date(startDate) : undefined;
    if (parsedStartDate && isNaN(parsedStartDate.getTime())) {
      return NextResponse.json(
        { error: 'تاريخ بداية الاشتراك غير صالح' },
        { status: 400 }
      );
    }

    const parsedEndDate = endDate ? new Date(endDate) : undefined;
    if (parsedEndDate && isNaN(parsedEndDate.getTime())) {
      return NextResponse.json(
        { error: 'تاريخ انتهاء الاشتراك غير صالح' },
        { status: 400 }
      );
    }

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

    // Prepare trial data if isTrial is true
    const trialDaysValue = trialDays || 3;
    const now = new Date();
    const trialEndDate = isTrial
      ? new Date(now.getTime() + trialDaysValue * 24 * 60 * 60 * 1000)
      : null;
    const defaultEndDate = parsedEndDate ?? trialEndDate ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    // Determine status: if isTrial is true, set status to TRIAL
    const finalStatus = isTrial ? 'TRIAL' : status;

    // Check if subscription exists to determine if we should set trialStartDate
    const existingSubscription = await prisma.subscription.findUnique({
      where: { clientId },
    });

    // Prepare update data
    const updateData: any = {
      planId,
      status: finalStatus,
      isTrial: isTrial ?? false,
    };

    if (parsedStartDate) {
      updateData.startDate = parsedStartDate;
    }

    if (parsedEndDate) {
      updateData.endDate = parsedEndDate;
    }

    if (typeof amountEGP === 'number') {
      updateData.amountEGP = amountEGP;
    }

    if (typeof sourceId !== 'undefined') {
      updateData.sourceId = sourceId || null;
    }

    if (isTrial) {
      // Set trial dates only if creating new trial or if it doesn't exist
      if (!existingSubscription?.trialStartDate) {
        updateData.trialStartDate = now;
      }
      updateData.trialEndDate = trialEndDate;
      updateData.trialDays = trialDaysValue;
      if (trialEndDate) {
        updateData.endDate = trialEndDate;
      }
    } else {
      // Clear trial fields if converting from trial to paid
      updateData.trialStartDate = null;
      updateData.trialEndDate = null;
      updateData.trialDays = null;
    }

    // Create or update subscription
    const subscription = await prisma.subscription.upsert({
      where: { clientId },
      update: updateData,
      create: {
        clientId,
        planId,
        status: finalStatus,
        isTrial: isTrial ?? false,
        trialStartDate: isTrial ? now : null,
        trialEndDate: isTrial ? trialEndDate : null,
        trialDays: isTrial ? trialDaysValue : null,
        startDate: parsedStartDate ?? now,
        endDate: defaultEndDate,
        amountEGP: typeof amountEGP === 'number' ? amountEGP : 0,
        sourceId,
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
        source: true,
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

    if (referral && finalStatus === 'ACTIVE') {
      try {
        await qualifyReferralEvent({
          referralEventId: referral.eventId,
          referralCode: referral.code,
          referredEmail: referral.email ?? client.email,
          referredClientId: clientId,
          eventType:
            referral.type === 'LARGE_PLAN'
              ? ReferralEventType.LARGE_PLAN
              : ReferralEventType.SUBSCRIBED,
          pointsOverride: referral.pointsOverride,
        });
      } catch (referralError) {
        console.error('Referral qualification failed', referralError);
      }
    }

    return NextResponse.json({ subscription }, { status: 201 });
  } catch (error) {
    console.error('Create subscription error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء إنشاء الاشتراك' },
      { status: 500 }
    );
  }
}

