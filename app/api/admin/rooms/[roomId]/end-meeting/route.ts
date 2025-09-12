import { NextRequest, NextResponse } from 'next/server';
import { RoomServiceClient } from 'livekit-server-sdk';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const resolvedParams = await params;
    console.log('🔧 End Meeting API called with params:', resolvedParams);
    
    const { roomName } = await request.json();
    console.log('📝 Request body roomName:', roomName);
    
    if (!roomName) {
      return NextResponse.json(
        { error: 'Missing roomName parameter' },
        { status: 400 }
      );
    }

    // Get LiveKit credentials from environment
    const apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
    const apiSecret = process.env.LIVEKIT_API_SECRET || 'secret';
    const livekitUrl = process.env.LIVEKIT_URL || 'ws://localhost:7880';
    
    console.log('🔑 LiveKit Config:', { 
      apiKey: apiKey ? '***' : 'undefined', 
      apiSecret: apiSecret ? '***' : 'undefined', 
      livekitUrl 
    });

    // Convert LiveKit WebSocket URL to HTTP URL for the API
    let hostURL: string;
    if (livekitUrl.startsWith('ws://')) {
      // Local development - convert ws://localhost:7880 to http://localhost:7880
      hostURL = livekitUrl.replace('ws://', 'http://');
    } else if (livekitUrl.startsWith('wss://')) {
      // Production - convert wss:// to https://
      hostURL = livekitUrl.replace('wss://', 'https://');
    } else {
      // Fallback - assume it's already an HTTP URL
      hostURL = livekitUrl;
    }
    
    console.log('LiveKit API URL:', hostURL);
    
    // Create RoomServiceClient to manage rooms
    const roomService = new RoomServiceClient(hostURL, apiKey, apiSecret);

    // Test connection to LiveKit server
    try {
      await roomService.listRooms();
      console.log('LiveKit server connection successful');
    } catch (error) {
      console.error('Failed to connect to LiveKit server:', error);
      
      // Check if it's a Docker/connection issue
      if (error instanceof Error && error.message.includes('fetch failed')) {
        return NextResponse.json(
          { 
            error: 'Cannot connect to LiveKit server',
            details: 'The LiveKit server appears to be offline. Please ensure Docker is running and the LiveKit container is started with: docker-compose up -d',
            solution: 'Start LiveKit server with: docker-compose up -d'
          },
          { status: 503 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Cannot connect to LiveKit server',
          details: error instanceof Error ? error.message : 'Unknown connection error',
          solution: 'Please check if the LiveKit server is running and accessible'
        },
        { status: 503 }
      );
    }

    try {
      // Get list of participants
      let participants = [];
      try {
        participants = await roomService.listParticipants(roomName);
        console.log(`Found ${participants.length} participants in room ${roomName}`);
      } catch (error) {
        console.log(`Could not list participants for room ${roomName}:`, error);
        // Continue with room deletion even if we can't list participants
      }
      
      // Disconnect each participant
      for (const participant of participants) {
        try {
          await roomService.removeParticipant(roomName, participant.identity);
          console.log(`Disconnected participant: ${participant.identity}`);
        } catch (error) {
          console.error(`Failed to disconnect participant ${participant.identity}:`, error);
        }
      }

      // Delete the room entirely
      try {
        await roomService.deleteRoom(roomName);
        console.log(`Room ${roomName} deleted successfully`);
      } catch (error) {
        console.error(`Failed to delete room ${roomName}:`, error);
        // If room deletion fails, it might already be deleted
      }

      return NextResponse.json({
        success: true,
        message: `Meeting ended successfully. ${participants.length} participants were disconnected and the room has been removed.`,
        participantsDisconnected: participants.length,
        roomDeleted: true
      });

    } catch (error) {
      console.error('Error managing room:', error);
      return NextResponse.json(
        { error: 'Failed to end meeting', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in end-meeting endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
