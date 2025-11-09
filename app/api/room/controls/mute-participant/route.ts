import { NextRequest, NextResponse } from 'next/server';
import { RoomServiceClient } from 'livekit-server-sdk';

const API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const API_SECRET = process.env.LIVEKIT_API_SECRET || 'secret';
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'ws://localhost:7880';

// POST - Mute specific participant
export async function POST(request: NextRequest) {
  try {
    const { roomName, participantIdentity, mute } = await request.json();

    if (!roomName || !participantIdentity) {
      return NextResponse.json(
        { error: 'Room name and participant identity are required' },
        { status: 400 }
      );
    }

    // Create LiveKit Room Service client
    const roomService = new RoomServiceClient(LIVEKIT_URL, API_KEY, API_SECRET);

    // Mute or unmute the participant's audio track
    await roomService.mutePublishedTrack(
      roomName,
      participantIdentity,
      'audio', // Track source (audio)
      mute !== false // Default to mute if not specified
    );

    return NextResponse.json({
      success: true,
      message: `Participant ${mute !== false ? 'muted' : 'unmuted'}`,
      participantIdentity,
      muted: mute !== false
    });

  } catch (error) {
    console.error('Failed to mute participant:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

