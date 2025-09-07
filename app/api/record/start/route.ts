import { EgressClient, EncodedFileOutput } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const roomName = req.nextUrl.searchParams.get('roomName');

    /**
     * CAUTION:
     * for simplicity this implementation does not authenticate users and therefore allows anyone with knowledge of a roomName
     * to start/stop recordings for that room.
     * DO NOT USE THIS FOR PRODUCTION PURPOSES AS IS
     */

    if (roomName === null) {
      return new NextResponse('Missing roomName parameter', { status: 403 });
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
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}-${roomName}.mp4`;
    
    const fileOutput = new EncodedFileOutput({
      filepath: filename,
    });

    const egressInfo = await egressClient.startRoomCompositeEgress(
      roomName,
      {
        file: fileOutput,
      },
      {
        layout: 'speaker',
        resolution: '1920x1080',
        videoBitrate: 3000,
        audioBitrate: 160,
        videoCodec: 'h264',
        audioCodec: 'aac',
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
