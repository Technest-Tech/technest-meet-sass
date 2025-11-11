import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireClientAuth } from '@/lib/middleware/auth';
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

/**
 * GET /api/client/rooms/[id]/observer-link
 * Get the observer link for a specific room
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate the client
    const auth = await requireClientAuth(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول.' },
        { status: 401 }
      );
    }

    const roomId = params.id;

    // Verify the room exists and belongs to the authenticated client
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        name: true,
        clientId: true,
        observerLink: true,
        client: {
          select: {
            id: true,
            enableObserverLinks: true,
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json(
        { error: 'الغرفة غير موجودة' },
        { status: 404 }
      );
    }

    // Verify the room belongs to the authenticated client
    if (room.clientId !== auth.clientId) {
      return NextResponse.json(
        { error: 'غير مصرح لك بالوصول إلى هذه الغرفة' },
        { status: 403 }
      );
    }

    if (!room.client?.enableObserverLinks) {
      return NextResponse.json(
        { error: 'روابط المراقب غير مفعلة لهذا العميل' },
        { status: 403 }
      );
    }

    // If no observer link exists, generate one (5 short random characters)
    if (!room.observerLink) {
      const observerLink = await generateUniqueObserverLink();
      
      await prisma.room.update({
        where: { id: roomId },
        data: { observerLink },
      });

      return NextResponse.json({
        roomId: room.id,
        roomName: room.name,
        observerLink,
      });
    }

    return NextResponse.json({
      roomId: room.id,
      roomName: room.name,
      observerLink: room.observerLink,
    });
  } catch (error) {
    console.error('Error fetching observer link:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب رابط المراقب' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/client/rooms/[id]/observer-link
 * Regenerate the observer link for a specific room
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate the client
    const auth = await requireClientAuth(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول.' },
        { status: 401 }
      );
    }

    const roomId = params.id;

    // Verify the room exists and belongs to the authenticated client
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        name: true,
        clientId: true,
        client: {
          select: {
            id: true,
            enableObserverLinks: true,
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json(
        { error: 'الغرفة غير موجودة' },
        { status: 404 }
      );
    }

    // Verify the room belongs to the authenticated client
    if (room.clientId !== auth.clientId) {
      return NextResponse.json(
        { error: 'غير مصرح لك بالوصول إلى هذه الغرفة' },
        { status: 403 }
      );
    }

    if (!room.client?.enableObserverLinks) {
      return NextResponse.json(
        { error: 'روابط المراقب غير مفعلة لهذا العميل' },
        { status: 403 }
      );
    }

    // Generate new short observer link (5 random characters)
    const newObserverLink = await generateUniqueObserverLink();

    // Update the room with the new observer link
    await prisma.room.update({
      where: { id: roomId },
      data: { observerLink: newObserverLink },
    });

    return NextResponse.json({
      roomId: room.id,
      roomName: room.name,
      observerLink: newObserverLink,
      message: 'تم إعادة إنشاء رابط المراقب بنجاح',
    });
  } catch (error) {
    console.error('Error regenerating observer link:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء إعادة إنشاء رابط المراقب' },
      { status: 500 }
    );
  }
}


