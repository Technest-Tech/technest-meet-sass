import { NextRequest, NextResponse } from 'next/server';
import { requireClient } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { RoomServiceClient } from 'livekit-server-sdk';

const API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const API_SECRET = process.env.LIVEKIT_API_SECRET || 'secret';
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'ws://localhost:7880';

export async function GET(request: NextRequest) {
  try {
    const session = await requireClient();

    if (!session.clientId) {
      return NextResponse.json(
        { error: 'معرف العميل غير موجود' },
        { status: 400 }
      );
    }

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

    return NextResponse.json({
      name: client.name,
      email: client.email,
      maxRooms: client.maxRooms,
      maxParticipants: client.maxParticipants,
      currentRooms: client._count.rooms,
    });
  } catch (error) {
    console.error('Get limits error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب الحدود' },
      { status: 500 }
    );
  }
}

