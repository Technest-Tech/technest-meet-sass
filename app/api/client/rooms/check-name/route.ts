import { NextRequest, NextResponse } from 'next/server';
import { requireClient } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { generateRoomLink } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const session = await requireClient();

    if (!session.clientId) {
      return NextResponse.json(
        { error: 'معرف العميل غير موجود' },
        { status: 400 }
      );
    }

    const { roomName } = await request.json();

    if (!roomName || typeof roomName !== 'string' || roomName.trim().length === 0) {
      return NextResponse.json(
        { available: false, error: 'اسم الغرفة مطلوب' },
        { status: 400 }
      );
    }

    // Get client to generate the link
    const client = await prisma.client.findUnique({
      where: { id: session.clientId },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'العميل غير موجود' },
        { status: 404 }
      );
    }

    // Generate the room link that would be used
    const roomLink = generateRoomLink(client.name, roomName);

    // Check if a room with this link already exists
    const existingRoom = await prisma.room.findFirst({
      where: {
        clientId: session.clientId,
        OR: [{ hostLink: roomLink }, { guestLink: roomLink }],
      },
    });

    return NextResponse.json({
      available: !existingRoom,
      roomLink,
    });
  } catch (error) {
    console.error('Check room name error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء التحقق من اسم الغرفة' },
      { status: 500 }
    );
  }
}

