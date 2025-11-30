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

const updateSubscriptionSchema = z.object({
  clientId: z.string().min(1, 'معرف العميل مطلوب').optional(),
  planId: z.string().min(1, 'معرف الخطة مطلوب').optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'EXPIRED', 'TRIAL', 'TRIAL_EXPIRED']).optional(),
  isTrial: z.boolean().optional(),
  trialDays: z.number().int().min(1).max(365).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  amountEGP: z.number().int().min(0).optional(),
  sourceId: z.string().nullable().optional(),
  referral: referralInfoSchema.optional(),
});

// PUT - Update subscription by ID
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();

    const { id } = await params;
    const body = await request.json();
    const validated = updateSubscriptionSchema.safeParse(body);

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
    } = validated.data;

    // Check if subscription exists
    const existingSubscription = await prisma.subscription.findUnique({
      where: { id },
      include: {
        client: true,
        plan: true,
      },
    });

    if (!existingSubscription) {
      return NextResponse.json(
        { error: 'الاشتراك غير موجود' },
        { status: 404 }
      );
    }

    // If clientId is being changed, verify the new client exists
    if (clientId && clientId !== existingSubscription.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
      });

      if (!client) {
        return NextResponse.json(
          { error: 'العميل غير موجود' },
          { status: 404 }
        );
      }
    }

    // If planId is being changed, verify the new plan exists
    if (planId && planId !== existingSubscription.planId) {
      const plan = await prisma.plan.findUnique({
        where: { id: planId },
      });

      if (!plan) {
        return NextResponse.json(
          { error: 'الخطة غير موجودة' },
          { status: 404 }
        );
      }
    }

    const finalClientId = clientId || existingSubscription.clientId;
    const finalPlanId = planId || existingSubscription.planId;

    // Get plan features for room sync
    const planWithFeatures = await prisma.plan.findUnique({
      where: { id: finalPlanId },
      include: {
        features: true,
      },
    });

    const enabledFeatures = planWithFeatures?.features
      .filter((f) => f.enabled)
      .map((f) => f.feature) || [];

    // Prepare update data
    const updateData: any = {};

    if (planId !== undefined) {
      updateData.planId = planId;
    }

    if (status !== undefined) {
      updateData.status = status;
    }

    if (isTrial !== undefined) {
      updateData.isTrial = isTrial;
    }

    const parsedStartDate = startDate ? new Date(startDate) : undefined;
    if (parsedStartDate && !isNaN(parsedStartDate.getTime())) {
      updateData.startDate = parsedStartDate;
    }

    const parsedEndDate = endDate ? new Date(endDate) : undefined;
    if (parsedEndDate && !isNaN(parsedEndDate.getTime())) {
      updateData.endDate = parsedEndDate;
    }

    if (amountEGP !== undefined) {
      updateData.amountEGP = amountEGP;
    }

    if (sourceId !== undefined) {
      updateData.sourceId = sourceId;
    }

    // Handle trial fields
    if (isTrial !== undefined) {
      const now = new Date();
      const trialDaysValue = trialDays || existingSubscription.trialDays || 3;

      if (isTrial) {
        // Setting up trial
        if (!existingSubscription.trialStartDate) {
          updateData.trialStartDate = now;
        }
        updateData.trialEndDate = new Date(now.getTime() + trialDaysValue * 24 * 60 * 60 * 1000);
        updateData.trialDays = trialDaysValue;
        if (!parsedEndDate) {
          updateData.endDate = updateData.trialEndDate;
        }
        if (status === undefined) {
          updateData.status = 'TRIAL';
        }
      } else {
        // Removing trial
        updateData.trialStartDate = null;
        updateData.trialEndDate = null;
        updateData.trialDays = null;
      }
    } else if (trialDays !== undefined) {
      // Just updating trial days
      const now = new Date();
      const trialStartDate = existingSubscription.trialStartDate || now;
      updateData.trialEndDate = new Date(trialStartDate.getTime() + trialDays * 24 * 60 * 60 * 1000);
      updateData.trialDays = trialDays;
      if (!parsedEndDate && existingSubscription.isTrial) {
        updateData.endDate = updateData.trialEndDate;
      }
    }

    // Update subscription
    const subscription = await prisma.subscription.update({
      where: { id },
      data: updateData,
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

    // Sync rooms if plan changed
    if (planId && planId !== existingSubscription.planId) {
      await prisma.room.updateMany({
        where: {
          clientId: finalClientId,
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

      console.log(`✅ Auto-synced rooms for client ${finalClientId} with new plan ${finalPlanId}`);
    }

    // Handle referral if provided
    if (referral && (status === 'ACTIVE' || existingSubscription.status === 'ACTIVE')) {
      try {
        await qualifyReferralEvent({
          referralEventId: referral.eventId,
          referralCode: referral.code,
          referredEmail: referral.email ?? subscription.client.email,
          referredClientId: finalClientId,
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

    return NextResponse.json({ subscription });
  } catch (error: any) {
    console.error('Update subscription error:', error);
    
    if (error?.code === 'P2025') {
      return NextResponse.json(
        { error: 'الاشتراك غير موجود' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'حدث خطأ أثناء تحديث الاشتراك' },
      { status: 500 }
    );
  }
}

// DELETE - Delete subscription by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();

    const { id } = await params;

    // Check if subscription exists
    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: {
        client: true,
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'الاشتراك غير موجود' },
        { status: 404 }
      );
    }

    // Delete the subscription
    await prisma.subscription.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: 'تم حذف الاشتراك بنجاح' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Delete subscription error:', error);
    
    if (error?.code === 'P2025') {
      return NextResponse.json(
        { error: 'الاشتراك غير موجود' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'حدث خطأ أثناء حذف الاشتراك' },
      { status: 500 }
    );
  }
}

