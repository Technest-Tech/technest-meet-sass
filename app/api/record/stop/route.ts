import { EgressClient } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { sanitizeRoomIdentifier } from '@/lib/utils/sanitize';

export async function GET(req: NextRequest) {
  try {
    const roomNameParam = req.nextUrl.searchParams.get('roomName');

    if (!roomNameParam) {
      return new NextResponse('Missing roomName parameter', { status: 400 });
    }

    // Sanitize room name to prevent injection
    const roomName = sanitizeRoomIdentifier(roomNameParam);
    if (!roomName || roomName !== roomNameParam) {
      return new NextResponse('Invalid room name format', { status: 400 });
    }

    // Validate room exists and is active (security check)
    const room = await prisma.room.findFirst({
      where: {
        OR: [
          { hostLink: roomName },
          { guestLink: roomName },
          { observerLink: roomName },
        ],
        isActive: true,
      },
      include: {
        client: {
          include: {
            account: true,
          },
        },
      },
    });

    if (!room) {
      return new NextResponse('Room not found or inactive', { status: 404 });
    }

    // Check if client account is active
    if (!room.client.account || room.client.account.status !== 'ACTIVE') {
      return new NextResponse('Room access denied', { status: 403 });
    }

    const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL } = process.env;

    const hostURL = new URL(LIVEKIT_URL!);
    // Keep the original protocol for local development
    if (!hostURL.hostname.includes('localhost') && !hostURL.hostname.includes('127.0.0.1')) {
      hostURL.protocol = 'https:';
    }

    const egressClient = new EgressClient(hostURL.origin, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    const activeEgresses = (await egressClient.listEgress({ roomName })).filter(
      (info) => info.status < 2,
    );
    if (activeEgresses.length === 0) {
      return new NextResponse('No active recording found', { status: 404 });
    }
    const stoppedEgresses = await Promise.all(
      activeEgresses.map(async (info) => {
        await egressClient.stopEgress(info.egressId);
        return {
          egressId: info.egressId,
          filename: info.file?.filepath || 'unknown.mp4',
          status: 'stopped'
        };
      })
    );

    return new NextResponse(JSON.stringify({ 
      recordings: stoppedEgresses,
      message: 'Recording stopped successfully'
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if (error instanceof Error) {
      return new NextResponse(error.message, { status: 500 });
    }
  }
}
