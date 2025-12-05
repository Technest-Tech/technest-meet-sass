import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { checkTrialExpiration, isSubscriptionActive } from '@/lib/utils/trial-check';
import { sanitizeRoomIdentifier } from '@/lib/utils/sanitize';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomLink: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const guestName = searchParams.get('guestName');

    if (!type || (type !== 'host' && type !== 'guest' && type !== 'observer')) {
      return NextResponse.json(
        { message: 'Invalid access type' },
        { status: 400 }
      );
    }

    // Await params for Next.js 15 compatibility
    const { roomLink: roomLinkParam } = await params;
    
    // Sanitize room link to prevent injection
    const roomLink = sanitizeRoomIdentifier(roomLinkParam);
    if (!roomLink || roomLink !== roomLinkParam) {
      return NextResponse.json(
        { message: 'Invalid room link format' },
        { status: 400 }
      );
    }

    // Find room by host, guest, or observer link
    const room = await prisma.room.findFirst({
      where: {
        OR: [
          { hostLink: roomLink },
          { guestLink: roomLink },
          { observerLink: roomLink }
        ]
      },
      include: {
        client: {
          include: {
            account: true,
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
        { exists: false, message: 'الغرفة غير موجودة', errorType: 'ROOM_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check if client account is active
    if (!room.client.account) {
      return NextResponse.json(
        { exists: false, message: 'حساب العميل غير موجود', errorType: 'ACCOUNT_NOT_FOUND' },
        { status: 403 }
      );
    }

    if (room.client.account.status === 'INACTIVE') {
      return NextResponse.json(
        { exists: false, message: 'حساب العميل غير نشط', errorType: 'ACCOUNT_INACTIVE' },
        { status: 403 }
      );
    }

    if (room.client.account.status === 'SUSPENDED') {
      return NextResponse.json(
        { exists: false, message: 'حساب العميل معطل', errorType: 'ACCOUNT_SUSPENDED' },
        { status: 403 }
      );
    }

    // Check if room is active
    if (!room.isActive) {
      return NextResponse.json(
        { exists: false, message: 'الغرفة غير نشطة', errorType: 'ROOM_INACTIVE' },
        { status: 403 }
      );
    }

    // Check subscription status and trial expiration
    if (!room.client.subscription) {
      return NextResponse.json(
        { exists: false, message: 'اشتراك العميل غير موجود', errorType: 'NO_SUBSCRIPTION' },
        { status: 403 }
      );
    }

    // Check and update trial expiration if needed
    const subscription = await checkTrialExpiration(room.client.subscription);

    // Check if subscription is active (ACTIVE or valid TRIAL)
    if (!isSubscriptionActive(subscription)) {
      const errorType = subscription.status === 'TRIAL_EXPIRED' 
        ? 'TRIAL_EXPIRED' 
        : subscription.status === 'EXPIRED'
        ? 'SUBSCRIPTION_EXPIRED'
        : 'SUBSCRIPTION_INACTIVE';
      
      return NextResponse.json(
        { 
          exists: false, 
          message: subscription.status === 'TRIAL_EXPIRED' 
            ? 'انتهت الفترة التجريبية'
            : subscription.status === 'EXPIRED'
            ? 'انتهى الاشتراك'
            : 'اشتراك العميل غير نشط',
          errorType 
        },
        { status: 403 }
      );
    }

    // Use the potentially updated subscription
    const activeSubscription = subscription;

    // Get enabled features from current plan (real-time check)
    const enabledFeatures = activeSubscription.plan?.features
      .filter((f) => f.enabled)
      .map((f) => f.feature) || [];

    console.log('🔍 Room validation for:', room.name);
    console.log('📋 Plan features:', activeSubscription.plan?.features.length || 0);
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
        allowMultipleHosts: room.allowMultipleHosts ?? false,
        canRecord: room.canRecord,
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
        enableNoiseCancellation: enabledFeatures.includes('NOISE_CANCELLATION'),
        enableStudentMonitorPiP: enabledFeatures.includes('STUDENT_MONITOR_PIP'),
        passwordRequired: room.passwordRequired ?? false,
        passwordFor: room.passwordFor,
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
