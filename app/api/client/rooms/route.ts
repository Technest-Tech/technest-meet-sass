import { NextRequest, NextResponse } from 'next/server';
import { requireClient } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { z } from 'zod';
import { generateRoomLink } from '@/lib/database';
import { randomBytes } from 'crypto';

async function generateUniqueObserverLink(): Promise<string> {
  const maxAttempts = 10;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate =
      'o' +
      randomBytes(3)
        .toString('base64')
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, 4);

    const existing = await prisma.room.findFirst({
      where: { observerLink: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  throw new Error('Failed to generate unique observer link after multiple attempts');
}

const createRoomSchema = z.object({
  name: z.string().min(1, 'اسم الغرفة مطلوب'),
  description: z.string().optional(),
  hostApproval: z.boolean().optional(),
  canRecord: z.boolean().optional(),
  requireWaitingRoom: z.boolean().optional(),
  allowGuestUnmute: z.boolean().optional(),
  enablePrivateChat: z.boolean().optional(),
});

// GET - List client's rooms
export async function GET(request: NextRequest) {
  try {
    const session = await requireClient();

    if (!session.clientId) {
      return NextResponse.json(
        { error: 'معرف العميل غير موجود' },
        { status: 400 }
      );
    }

    // Check subscription status
    const subscription = await prisma.subscription.findUnique({
      where: { clientId: session.clientId },
    });

    if (!subscription || subscription.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'الاشتراك غير نشط. يرجى التواصل مع المسؤول' },
        { status: 403 }
      );
    }

    const rooms = await prisma.room.findMany({
      where: { clientId: session.clientId },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        hostLink: true,
        guestLink: true,
        observerLink: true, // Include observer link for monitoring
        maxParticipants: true,
        createdAt: true,
        _count: {
          select: {
            participants: true,
            files: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ rooms });
  } catch (error) {
    console.error('Get rooms error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب الغرف' },
      { status: 500 }
    );
  }
}

// POST - Create new room
export async function POST(request: NextRequest) {
  try {
    const session = await requireClient();

    if (!session.clientId) {
      return NextResponse.json(
        { error: 'معرف العميل غير موجود' },
        { status: 400 }
      );
    }

    // Check subscription status
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

    if (!subscription || subscription.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'الاشتراك غير نشط. يرجى التواصل مع المسؤول' },
        { status: 403 }
      );
    }

    // Check room limits
    const client = await prisma.client.findUnique({
      where: { id: session.clientId },
      include: {
        _count: {
          select: {
            rooms: true,
          },
        },
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'العميل غير موجود' },
        { status: 404 }
      );
    }

    if (client._count.rooms >= client.maxRooms) {
      return NextResponse.json(
        { error: 'تم الوصول إلى الحد الأقصى لعدد الغرف' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = createRoomSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0].message },
        { status: 400 }
      );
    }

    // Get enabled features from plan
    const enabledFeatures = subscription.plan?.features
      .filter((f) => f.enabled)
      .map((f) => f.feature) || [];

    // Generate room link based on client name + room name
    // Both host and guest use the same base link, distinguished by /h or /g in the route
    let roomLink: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      // Generate link with room name, add suffix if needed for uniqueness
      const baseLink = generateRoomLink(client.name, validated.data.name);
      roomLink = attempts === 0 ? baseLink : `${baseLink}-${attempts}`;

      const existingRoom = await prisma.room.findFirst({
        where: {
          OR: [{ hostLink: roomLink }, { guestLink: roomLink }],
        },
      });

      if (!existingRoom) break;
      attempts++;
    } while (attempts < maxAttempts);

    // Use the same link for both host and guest
    const hostLink = roomLink;
    const guestLink = roomLink;
    
    let observerLink: string | null = null;
    if (client.enableObserverLinks) {
      observerLink = await generateUniqueObserverLink();
    }

    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { error: 'اسم الغرفة مستخدم بالفعل. يرجى اختيار اسم آخر' },
        { status: 400 }
      );
    }

    // Create room with feature settings based on plan
    const room = await prisma.room.create({
      data: {
        name: validated.data.name,
        description: validated.data.description,
        clientId: session.clientId,
        hostLink,
        guestLink,
        observerLink,
        hostApproval: validated.data.hostApproval ?? false,
        maxParticipants: client.maxParticipants, // Use client's maxParticipants from their plan
        isActive: true,
        canRecord: enabledFeatures.includes('RECORDING') && (validated.data.canRecord ?? false),
        requireWaitingRoom: enabledFeatures.includes('WAITING_ROOM') && (validated.data.requireWaitingRoom ?? false),
        allowGuestUnmute: enabledFeatures.includes('GUEST_UNMUTE') && (validated.data.allowGuestUnmute ?? true),
        enablePrivateChat: enabledFeatures.includes('PRIVATE_CHAT') && (validated.data.enablePrivateChat ?? true),
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

    return NextResponse.json({ room }, { status: 201 });
  } catch (error) {
    console.error('Create room error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء إنشاء الغرفة' },
      { status: 500 }
    );
  }
}

