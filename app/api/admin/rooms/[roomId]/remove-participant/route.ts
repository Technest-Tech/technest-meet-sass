import { NextRequest, NextResponse } from 'next/server';
import { RoomServiceClient } from 'livekit-server-sdk';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const body = await request.json();
    const { participantIdentity, roomName } = body;

    console.log('🔧 Remove Participant API called with params:', { roomId });
    console.log('📝 Request body:', { participantIdentity, roomName });

    if (!participantIdentity) {
      return NextResponse.json(
        { error: 'Participant identity is required' },
        { status: 400 }
      );
    }

    if (!roomName) {
      return NextResponse.json(
        { error: 'Room name is required' },
        { status: 400 }
      );
    }

    // Get LiveKit configuration from environment variables
    const hostURL = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!hostURL || !apiKey || !apiSecret) {
      console.error('Missing LiveKit configuration');
      return NextResponse.json(
        { 
          error: 'LiveKit configuration missing',
          details: 'Server configuration error'
        },
        { status: 503 }
      );
    }

    try {
      // Create RoomServiceClient to manage rooms
      const roomService = new RoomServiceClient(hostURL, apiKey, apiSecret);

      // Verify the room exists
      try {
        await roomService.listRooms();
      } catch (error) {
        console.error('Failed to connect to LiveKit:', error);
        return NextResponse.json(
          { 
            error: 'Failed to connect to LiveKit server',
            details: 'Please check your LiveKit configuration'
          },
          { status: 503 }
        );
      }

      // Get list of participants to verify the participant exists
      let participants = [];
      try {
        participants = await roomService.listParticipants(roomName);
        console.log(`Found ${participants.length} participants in room ${roomName}`);
      } catch (error) {
        console.log(`Could not list participants for room ${roomName}:`, error);
        return NextResponse.json(
          { 
            error: 'Could not access room participants',
            details: 'The room may not exist or may have been deleted'
          },
          { status: 404 }
        );
      }

      // Check if the participant exists in the room
      const participantExists = participants.some(p => p.identity === participantIdentity);
      if (!participantExists) {
        return NextResponse.json(
          { 
            error: 'Participant not found',
            details: `Participant "${participantIdentity}" is not in the room`
          },
          { status: 404 }
        );
      }

      // Remove the participant
      try {
        console.log(`Attempting to remove participant: ${participantIdentity} from room: ${roomName}`);
        await roomService.removeParticipant(roomName, participantIdentity);
        console.log(`✅ Successfully removed participant: ${participantIdentity}`);
      } catch (error) {
        console.error(`❌ Failed to remove participant ${participantIdentity}:`, error);
        return NextResponse.json(
          { 
            error: 'Failed to remove participant',
            details: error instanceof Error ? error.message : 'Unknown error'
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Participant "${participantIdentity}" has been removed from the meeting`,
        participantRemoved: participantIdentity,
        roomName: roomName,
        action: 'remove_participant_only' // Explicitly indicate this is only participant removal
      });

    } catch (error) {
      console.error('Error managing participant:', error);
      return NextResponse.json(
        { error: 'Failed to remove participant', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in remove-participant endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
