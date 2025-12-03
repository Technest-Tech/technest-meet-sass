import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { prisma } from '@/lib/database';

// Consistent hashing for LiveKit server routing
// Ensures same room always routes to same server
function getLiveKitServerForRoom(roomName: string): { 
  clientUrl: string; 
  serverUrl: string;
} {
  // Get LiveKit server URLs from env (backward compatible)
  const livekit1Client = process.env.LIVEKIT_1_CLIENT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://rtc.acadmyq.com';
  const livekit1Server = process.env.LIVEKIT_1_SERVER_URL || process.env.LIVEKIT_URL || 'http://178.128.78.195:7880';
  
  const livekit2Client = process.env.LIVEKIT_2_CLIENT_URL;
  const livekit2Server = process.env.LIVEKIT_2_SERVER_URL;
  
  // If second server not configured, use single server (backward compatible)
  if (!livekit2Client || !livekit2Server) {
    return { 
      clientUrl: livekit1Client, 
      serverUrl: livekit1Server 
    };
  }
  
  // Consistent hashing: same room always goes to same server
  let hash = 0;
  for (let i = 0; i < roomName.length; i++) {
    hash = ((hash << 5) - hash) + roomName.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Route based on hash (0 or 1)
  const serverIndex = Math.abs(hash) % 2;
  
  if (serverIndex === 0) {
    return { 
      clientUrl: livekit1Client, 
      serverUrl: livekit1Server 
    };
  } else {
    return { 
      clientUrl: livekit2Client, 
      serverUrl: livekit2Server 
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { roomName, participantName, participantType } = await request.json();

    if (!roomName || !participantName || !participantType) {
      return NextResponse.json(
        { error: 'Missing required parameters: roomName, participantName, participantType' },
        { status: 400 }
      );
    }

    // Get LiveKit API key and secret from environment variables
    const apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
    const apiSecret = process.env.LIVEKIT_API_SECRET || 'secret';
    
    // Look up room to get hostLink for consistent routing
    // roomName could be hostLink, guestLink, or observerLink
    const room = await prisma.room.findFirst({
      where: {
        OR: [
          { hostLink: roomName },
          { guestLink: roomName },
          { observerLink: roomName },
        ],
      },
    }) as any;

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // ALWAYS use hostLink as the LiveKit room name to ensure consistency
    // This ensures all participants (host, guest, observer) use the same room name
    const actualRoomName = room.hostLink;

    // Route room to specific LiveKit server using consistent hashing
    const livekitRouting = getLiveKitServerForRoom(actualRoomName);
    const livekitUrl = livekitRouting.clientUrl;

    console.log('🔧 LiveKit routing (token endpoint):', { 
      inputRoomName: roomName,
      actualRoomName: actualRoomName,
      clientUrl: livekitUrl,
      serverUrl: livekitRouting.serverUrl 
    });

    console.log('🔑 LiveKit Config:', { apiKey, apiSecret: apiSecret ? '***' : 'undefined', livekitUrl });
    console.log('👤 Participant:', { roomName, participantName, participantType });

    // Create the access token
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
      name: participantName,
    });

    console.log('✅ AccessToken created:', at);

    // Grant permissions based on participant type
    // Use actualRoomName (hostLink) to ensure all participants join the same LiveKit room
    if (participantType === 'HOST' || participantType.toLowerCase() === 'host') {
      // Hosts can publish, subscribe, and manage the room
      at.addGrant({
        room: actualRoomName,
        roomJoin: true,
        roomAdmin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });
    } else {
      // Guests can only publish and subscribe (no admin rights)
      at.addGrant({
        room: actualRoomName,
        roomJoin: true,
        roomAdmin: false,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });
    }

    console.log('✅ Grants added to token');

    // Generate the token (handle both sync and async versions)
    let token;
    try {
      // Try async version first (newer LiveKit versions)
      token = await at.toJwt();
    } catch (error) {
      // Fallback to sync version (older LiveKit versions)
      token = at.toJwt();
    }
    
    console.log('🎫 Generated token:', token ? 'Token exists' : 'Token is empty', 'Length:', token ? token.length : 0);

    return NextResponse.json({
      token,
      livekitUrl,
      roomName: actualRoomName, // Return actual room name (hostLink) for consistency
      participantName,
      participantType,
      debug: {
        apiKeyExists: !!apiKey,
        apiSecretExists: !!apiSecret,
        tokenLength: token ? token.length : 0,
        tokenType: typeof token
      }
    });

  } catch (error) {
    console.error('❌ Failed to generate LiveKit token:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
