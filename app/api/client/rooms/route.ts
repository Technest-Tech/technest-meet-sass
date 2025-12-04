import { NextRequest, NextResponse } from 'next/server';
import { requireClient } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { z } from 'zod';
import { checkTrialExpiration, isSubscriptionActive } from '@/lib/utils/trial-check';
import { generateRoomLink } from '@/lib/database';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

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
  allowMultipleHosts: z.boolean().optional(),
  canRecord: z.boolean().optional(),
  requireWaitingRoom: z.boolean().optional(),
  allowGuestUnmute: z.boolean().optional(),
  enablePrivateChat: z.boolean().optional(),
  password: z.string().optional(),
  passwordRequired: z.boolean().optional(),
  passwordFor: z.enum(['HOST_ONLY', 'HOST_AND_GUEST']).optional(),
  customRoomLink: z.string().min(1).max(50).regex(/^[a-zA-Z0-9]+$/, 'يجب أن يحتوي رابط الغرفة على أحرف وأرقام فقط').optional(),
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

    if (!subscription) {
      return NextResponse.json(
        { error: 'الاشتراك غير موجود. يرجى التواصل مع المسؤول' },
        { status: 403 }
      );
    }

    // Check and update trial expiration if needed
    const checkedSubscription = await checkTrialExpiration(subscription);

    // Check if subscription is active (ACTIVE or valid TRIAL)
    if (!isSubscriptionActive(checkedSubscription)) {
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
    const enabledFeatures = checkedSubscription.plan?.features
      .filter((f) => f.enabled)
      .map((f) => f.feature) || [];

    // Check if client is almajd@admin.com and customRoomLink is provided
    const isAlmajdAccount = session.email === 'almajd@admin.com';
    let hostLink: string;
    let guestLink: string;

    if (isAlmajdAccount && validated.data.customRoomLink) {
      // Use custom room link for almajd account
      const customLink = validated.data.customRoomLink.trim();

      // Validate uniqueness within the same client
      const existingRoom = await prisma.room.findFirst({
        where: {
          clientId: session.clientId,
          OR: [{ hostLink: customLink }, { guestLink: customLink }],
        },
      });

      if (existingRoom) {
        return NextResponse.json(
          { error: 'رابط الغرفة مستخدم بالفعل. يرجى اختيار رابط آخر' },
          { status: 400 }
        );
      }

      hostLink = customLink;
      guestLink = customLink;
    } else {
      // Generate room link using 7 random characters
      // Both host and guest use the same base link, distinguished by /h or /g in the route
      let roomLink: string;
      let attempts = 0;
      const maxAttempts = 10;

      do {
        // Generate link with 7 random characters
        roomLink = generateRoomLink();

        const existingRoom = await prisma.room.findFirst({
          where: {
            OR: [{ hostLink: roomLink }, { guestLink: roomLink }],
          },
        });

        if (!existingRoom) break;
        attempts++;
      } while (attempts < maxAttempts);

      if (attempts >= maxAttempts) {
        return NextResponse.json(
          { error: 'فشل في إنشاء رابط فريد للغرفة. يرجى المحاولة مرة أخرى' },
          { status: 400 }
        );
      }

      // Use the same link for both host and guest
      hostLink = roomLink;
      guestLink = roomLink;
    }
    
    let observerLink: string | null = null;
    if (client.enableObserverLinks) {
      observerLink = await generateUniqueObserverLink();
    }

    // Hash password if provided
    let hashedPassword: string | null = null;
    if (validated.data.passwordRequired && validated.data.password) {
      hashedPassword = await bcrypt.hash(validated.data.password, 10);
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
        allowMultipleHosts: validated.data.allowMultipleHosts ?? false,
        maxParticipants: client.maxParticipants, // Use client's maxParticipants from their plan
        isActive: true,
        canRecord: validated.data.canRecord ?? false,
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
        enableNoiseCancellation: enabledFeatures.includes('NOISE_CANCELLATION'),
        password: hashedPassword,
        passwordRequired: validated.data.passwordRequired ?? false,
        passwordFor: validated.data.passwordFor ?? null,
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

