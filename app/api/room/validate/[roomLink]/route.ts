import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomLink: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const guestName = searchParams.get('guestName');

    if (!type || (type !== 'host' && type !== 'guest')) {
      return NextResponse.json(
        { message: 'Invalid access type' },
        { status: 400 }
      );
    }

    // Await params for Next.js 15 compatibility
    const { roomLink } = await params;

    // Find room by host or guest link
    const room = await prisma.room.findFirst({
      where: {
        OR: [
          { hostLink: roomLink },
          { guestLink: roomLink }
        ]
      },
      include: {
        client: {
          include: {
            subscription: {
              include: {
                plan: {
                  include: {
                    features: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json(
        { exists: false, message: 'الغرفة غير موجودة' },
        { status: 404 }
      );
    }

    // Check if room is active
    if (!room.isActive) {
      return NextResponse.json(
        { exists: false, message: 'الغرفة غير نشطة' },
        { status: 403 }
      );
    }

    // Check subscription status
    if (!room.client.subscription || room.client.subscription.status !== 'ACTIVE') {
      return NextResponse.json(
        { exists: false, message: 'اشتراك العميل غير نشط' },
        { status: 403 }
      );
    }

    // Get enabled features from current plan (real-time check)
    const enabledFeatures = room.client.subscription.plan?.features
      .filter((f) => f.enabled)
      .map((f) => f.feature) || [];

    console.log('🔍 Room validation for:', room.name);
    console.log('📋 Plan features:', room.client.subscription.plan?.features.length || 0);
    console.log('✅ Enabled features:', enabledFeatures);
    console.log('🏠 Room stored features:', {
      enableReactions: room.enableReactions,
      enableRaiseHand: room.enableRaiseHand,
      enableCollaborativeWhiteboard: room.enableCollaborativeWhiteboard,
    });

    // Merge room settings with current plan features
    // Room settings (like canRecord) are only enabled if BOTH room setting AND plan feature are enabled
    return NextResponse.json({
      exists: true,
      room: {
        id: room.id,
        name: room.name,
        isActive: room.isActive,
        hostApproval: room.hostApproval,
        canRecord: room.canRecord && enabledFeatures.includes('RECORDING'),
        requireWaitingRoom: room.requireWaitingRoom && enabledFeatures.includes('WAITING_ROOM'),
        allowGuestUnmute: room.allowGuestUnmute && enabledFeatures.includes('GUEST_UNMUTE'),
        enablePrivateChat: room.enablePrivateChat && enabledFeatures.includes('PRIVATE_CHAT'),
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
        enableStudentMonitorPiP: enabledFeatures.includes('STUDENT_MONITOR_PIP'),
      },
      client: {
        name: room.client.name,
        email: room.client.email,
      }
    });

  } catch (error) {
    console.error('Error validating room:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
