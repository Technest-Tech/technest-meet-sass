import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

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
    // For local development, use local IP instead of localhost for mobile devices
    // Check if we're in development mode (using devkey or NODE_ENV)
    const isDevelopment = (process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production') && apiKey === 'devkey';
    const defaultLivekitUrl = isDevelopment 
      ? 'ws://192.168.1.13:7880' 
      : 'ws://localhost:7880';
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || defaultLivekitUrl;

    console.log('🔑 LiveKit Config:', { apiKey, apiSecret: apiSecret ? '***' : 'undefined', livekitUrl });
    console.log('👤 Participant:', { roomName, participantName, participantType });

    // Create the access token
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
      name: participantName,
    });

    console.log('✅ AccessToken created:', at);

    // Grant permissions based on participant type
    if (participantType === 'HOST') {
      // Hosts can publish, subscribe, and manage the room
      at.addGrant({
        room: roomName,
        roomJoin: true,
        roomAdmin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });
    } else {
      // Guests can only publish and subscribe (no admin rights)
      at.addGrant({
        room: roomName,
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
      roomName,
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
