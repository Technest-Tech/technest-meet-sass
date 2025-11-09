import { NextRequest, NextResponse } from 'next/server';
import { RoomServiceClient } from 'livekit-server-sdk';

const API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const API_SECRET = process.env.LIVEKIT_API_SECRET || 'secret';
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'ws://localhost:7880';

// POST - Mute all participants except host
export async function POST(request: NextRequest) {
  try {
    const { roomName, hostIdentity } = await request.json();

    if (!roomName) {
      return NextResponse.json(
        { error: 'Room name is required' },
        { status: 400 }
      );
    }

    // Create LiveKit Room Service client
    const roomService = new RoomServiceClient(LIVEKIT_URL, API_KEY, API_SECRET);

    // Get all participants in the room
    const participants = await roomService.listParticipants(roomName);

    let mutedCount = 0;
    const errors = [];

    // Mute all participants except the host
    for (const participant of participants) {
      // Skip the host
      if (hostIdentity && participant.identity === hostIdentity) {
        continue;
      }

      try {
        await roomService.mutePublishedTrack(
          roomName,
          participant.identity,
          'audio',
          true // Mute
        );
        mutedCount++;
      } catch (error) {
        console.error(`Failed to mute ${participant.identity}:`, error);
        errors.push({
          participantIdentity: participant.identity,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Muted ${mutedCount} participant(s)`,
      mutedCount,
      totalParticipants: participants.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Failed to mute all participants:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

