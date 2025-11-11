import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

// POST - Clear active host when they disconnect
export async function POST(request: NextRequest) {
  try {
    const { roomLink, hostIdentity } = await request.json();

    if (!roomLink || !hostIdentity) {
      return NextResponse.json(
        { error: 'Room link and host identity are required' },
        { status: 400 }
      );
    }

    // Find the room by hostLink or guestLink
    const room = await prisma.room.findFirst({
      where: {
        OR: [
          { hostLink: roomLink },
          { guestLink: roomLink },
        ],
      },
    });

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // Only clear if this is the active host
    await prisma.room.updateMany({
      where: {
        id: room.id,
        activeHostIdentity: hostIdentity,
      },
      data: {
        activeHostIdentity: null,
        activeHostSessionId: null,
        activeHostLastSeen: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Active host cleared',
    });
  } catch (error) {
    console.error('Failed to clear active host:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

