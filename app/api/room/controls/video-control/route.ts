import { NextRequest, NextResponse } from 'next/server';
import { RoomServiceClient } from 'livekit-server-sdk';

const API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const API_SECRET = process.env.LIVEKIT_API_SECRET || 'secret';
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'ws://localhost:7880';

// POST - Control participant video (disable only, not force enable)
export async function POST(request: NextRequest) {
  try {
    const { roomName, participantIdentity, disable } = await request.json();

    if (!roomName || !participantIdentity) {
      return NextResponse.json(
        { error: 'Room name and participant identity are required' },
        { status: 400 }
      );
    }

    // Create LiveKit Room Service client
    const roomService = new RoomServiceClient(LIVEKIT_URL, API_KEY, API_SECRET);

    // Disable the participant's video track
    // Note: We can only disable video, not force enable it (requires user consent)
    if (disable) {
      await roomService.mutePublishedTrack(
        roomName,
        participantIdentity,
        'video',
        true
      );

      return NextResponse.json({
        success: true,
        message: 'Participant video disabled',
        participantIdentity
      });
    } else {
      // For enabling video, we send a request via data channel instead
      // This is handled in the frontend
      return NextResponse.json({
        success: true,
        message: 'Video enable request should be sent via data channel',
        participantIdentity,
        requiresDataChannel: true
      });
    }

  } catch (error) {
    console.error('Failed to control participant video:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

