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
      select: {
        id: true,
        name: true,
        isActive: true,
        hostApproval: true,
        canRecord: true
      }
    });

    if (!room) {
      return NextResponse.json(
        { exists: false, message: 'Room not found' },
        { status: 404 }
      );
    }



    // Regular room validation
    return NextResponse.json({
      exists: true,
      room: {
        id: room.id,
        name: room.name,
        isActive: room.isActive,
        hostApproval: room.hostApproval,
        canRecord: room.canRecord
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
