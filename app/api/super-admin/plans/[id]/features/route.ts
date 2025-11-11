import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { z } from 'zod';
import { FeatureType } from '@prisma/client';

const updateFeaturesSchema = z.object({
  features: z.array(z.object({
    feature: z.nativeEnum(FeatureType),
    enabled: z.boolean(),
  })),
});

// GET - Get plan features
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();

    const { id } = await params;

    const features = await prisma.planFeature.findMany({
      where: { planId: id },
    });

    return NextResponse.json({ features });
  } catch (error) {
    console.error('Get features error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب الميزات' },
      { status: 500 }
    );
  }
}

// POST - Update plan features
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();

    const { id } = await params;
    const body = await request.json();
    
    console.log('📥 Received features update request for plan:', id);
    console.log('📦 Number of features received:', body.features?.length || 0);
    console.log('📋 Features:', body.features);
    
    const validated = updateFeaturesSchema.safeParse(body);

    if (!validated.success) {
      console.error('❌ Validation failed:', validated.error);
      return NextResponse.json(
        { error: validated.error.errors[0].message },
        { status: 400 }
      );
    }

    const { features } = validated.data;
    console.log('✅ Validated features count:', features.length);

    // Delete existing features
    await prisma.planFeature.deleteMany({
      where: { planId: id },
    });

    // Create new features
    await prisma.planFeature.createMany({
      data: features.map((f) => ({
        planId: id,
        feature: f.feature,
        enabled: f.enabled,
      })),
    });

    const updatedFeatures = await prisma.planFeature.findMany({
      where: { planId: id },
    });

    // Get enabled features list
    const enabledFeatures = features
      .filter((f) => f.enabled)
      .map((f) => f.feature);

    // Automatically sync all rooms for clients with this plan
    // Find all clients subscribed to this plan
    const subscriptions = await prisma.subscription.findMany({
      where: {
        planId: id,
        status: 'ACTIVE',
      },
      select: {
        clientId: true,
      },
    });

    const clientIds = subscriptions.map((s) => s.clientId);

    if (clientIds.length > 0) {
      // Update all rooms for these clients to reflect new plan features
      await prisma.room.updateMany({
        where: {
          clientId: {
            in: clientIds,
          },
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

      console.log(`✅ Auto-synced features for ${clientIds.length} clients with plan ${id}`);
    }

    return NextResponse.json({ 
      features: updatedFeatures,
      syncedClients: clientIds.length,
    });
  } catch (error) {
    console.error('Update features error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تحديث الميزات' },
      { status: 500 }
    );
  }
}

