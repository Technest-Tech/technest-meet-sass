import { EgressClient, EncodedFileOutput } from 'livekit-server-sdk';
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

    const {
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET,
      LIVEKIT_URL,
    } = process.env;

    const hostURL = new URL(LIVEKIT_URL!);
    // Keep the original protocol for local development
    if (!hostURL.hostname.includes('localhost') && !hostURL.hostname.includes('127.0.0.1')) {
      hostURL.protocol = 'https:';
    }

    const egressClient = new EgressClient(hostURL.origin, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

    const existingEgresses = await egressClient.listEgress({ roomName });
    if (existingEgresses.length > 0 && existingEgresses.some((e) => e.status < 2)) {
      return new NextResponse('Meeting is already being recorded', { status: 409 });
    }

    // Use local file storage (no S3)
    // Sanitize roomName in filename to prevent path issues
    const sanitizedRoomName = roomName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}-${sanitizedRoomName}.mp4`;
    
    const fileOutput = new EncodedFileOutput({
      filepath: filename,
    });

    // Record as screen share - use grid layout focused on screen share
    const egressInfo = await egressClient.startRoomCompositeEgress(
      roomName,
      {
        file: fileOutput,
      },
      {
        layout: 'grid', // Use grid layout to capture screen share
        resolution: '1920x1080',
        videoBitrate: 3000,
        audioBitrate: 160,
        videoCodec: 'h264',
        audioCodec: 'aac',
        // Prioritize screen share tracks
        customBaseUrl: undefined,
      },
    );

    // Return the egress ID for tracking
    return new NextResponse(JSON.stringify({ 
      egressId: egressInfo.egressId,
      filename: filename,
      status: 'started'
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Recording start error:', error);
    if (error instanceof Error) {
      return new NextResponse(JSON.stringify({ 
        error: error.message,
        details: 'Failed to start recording. Check LiveKit server configuration and permissions.'
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new NextResponse('Unknown error occurred', { status: 500 });
  }
}
