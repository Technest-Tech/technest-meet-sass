import { randomString } from '@/lib/client-utils';
import { getLiveKitURL } from '@/lib/getLiveKitURL';
import { ConnectionDetails } from '@/lib/types';
import { AccessToken, AccessTokenOptions, VideoGrant } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const API_SECRET = process.env.LIVEKIT_API_SECRET || 'secret';
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'ws://localhost:7880';

const COOKIE_KEY = 'random-participant-postfix';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Connection details request received');
    
    // Parse query parameters
    const roomName = request.nextUrl.searchParams.get('roomName');
    const participantName = request.nextUrl.searchParams.get('participantName');
    const participantType = request.nextUrl.searchParams.get('participantType') || 'guest'; // 'host' or 'guest'
    const metadata = request.nextUrl.searchParams.get('metadata') ?? '';
    const region = request.nextUrl.searchParams.get('region');
    
    console.log('📋 Request params:', { roomName, participantName, participantType, metadata, region });
    console.log('🔧 Environment check:', { 
      apiKey: API_KEY ? '***' : 'undefined', 
      apiSecret: API_SECRET ? '***' : 'undefined',
      livekitUrl: LIVEKIT_URL
    });
    
    if (!LIVEKIT_URL) {
      throw new Error('LIVEKIT_URL is not defined');
    }
    const livekitServerUrl = region ? getLiveKitURL(LIVEKIT_URL, region) : LIVEKIT_URL;
    let randomParticipantPostfix = request.cookies.get(COOKIE_KEY)?.value;
    if (livekitServerUrl === undefined) {
      throw new Error('Invalid region');
    }

    if (typeof roomName !== 'string') {
      return NextResponse.json({ error: 'Missing required query parameter: roomName' }, { status: 400 });
    }
    if (participantName === null) {
      return NextResponse.json({ error: 'Missing required query parameter: participantName' }, { status: 400 });
    }

    // Validate participant type
    if (participantType !== 'host' && participantType !== 'guest') {
      return NextResponse.json({ error: 'Invalid participant type. Must be "host" or "guest"' }, { status: 400 });
    }

    // Generate participant token with more stable identity
    if (!randomParticipantPostfix) {
      randomParticipantPostfix = randomString(8); // Longer random string for uniqueness
    }
    
    // Create a simpler identity that's still unique but more compatible
    const timestamp = Date.now();
    const uniqueIdentity = `${participantName}_${timestamp}`;
    
    const participantToken = await createParticipantToken(
      {
        identity: uniqueIdentity,
        name: participantName,
        metadata: JSON.stringify({ type: participantType, ...JSON.parse(metadata || '{}') }),
      },
      roomName,
      participantType,
    );

    console.log('✅ Token generated successfully, length:', participantToken ? participantToken.length : 0);
    
    // Return connection details
    const data: ConnectionDetails = {
      serverUrl: livekitServerUrl,
      roomName: roomName,
      participantToken: participantToken,
      participantName: participantName,
    };
    return NextResponse.json(data, {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `${COOKIE_KEY}=${randomParticipantPostfix}; Path=/; HttpOnly; SameSite=Strict; Secure; Expires=${getCookieExpirationTime()}`,
      },
    });
  } catch (error) {
    console.error('❌ Connection details error:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function createParticipantToken(userInfo: AccessTokenOptions, roomName: string, participantType: string) {
  console.log('🔑 Creating token with:', { 
    apiKey: API_KEY ? '***' : 'undefined', 
    apiSecret: API_SECRET ? '***' : 'undefined',
    userInfo,
    roomName,
    participantType
  });
  
  // Create AccessToken with explicit algorithm specification
  const at = new AccessToken(API_KEY, API_SECRET, userInfo);
  at.ttl = '30m'; // Increased from 5m to 30m to reduce reconnections
  
  // Ensure we're using the correct JWT algorithm for LiveKit
  // LiveKit expects HS256 by default
  // Also ensure the identity is properly formatted for LiveKit
  
  // Set explicit JWT algorithm to avoid compatibility issues
  at.algorithm = 'HS256';
  
  // Base grant for all participants
  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };

  // Add host-specific permissions
  if (participantType === 'host') {
    grant.roomAdmin = true; // Host can manage the room
    grant.roomCreate = true; // Host can create rooms
    grant.roomUpdate = true; // Host can update room settings
    grant.canPublish = true; // Host can always publish
    grant.canPublishData = true; // Host can send data
    grant.canSubscribe = true; // Host can subscribe to all
  } else {
    // Guest permissions (more restricted)
    grant.roomAdmin = false; // Guests cannot manage the room
    grant.roomCreate = false; // Guests cannot create rooms
    grant.roomUpdate = false; // Guests cannot update room settings
    grant.canPublish = true; // Guests can publish (camera/mic)
    grant.canPublishData = true; // Guests can send chat messages
    grant.canSubscribe = true; // Guests can subscribe to others
  }

  at.addGrant(grant);
  
  // Generate the token (handle both sync and async versions)
  let token;
  try {
    console.log('🔐 Attempting to generate JWT token...');
    // Try async version first (newer LiveKit versions)
    token = await at.toJwt();
    console.log('✅ Async token generation successful');
  } catch (error) {
    console.log('⚠️ Async token generation failed, trying sync version:', error);
    try {
      // Fallback to sync version (older LiveKit versions)
      token = at.toJwt();
      console.log('✅ Sync token generation successful');
    } catch (syncError) {
      console.error('❌ Both async and sync token generation failed:', syncError);
      throw syncError;
    }
  }
  
  console.log('🎫 Generated token:', token ? 'Token exists' : 'Token is empty', 'Length:', token ? token.length : 0);
  
  return token;
}

function getCookieExpirationTime(): string {
  var now = new Date();
  var time = now.getTime();
  var expireTime = time + 60 * 120 * 1000;
  now.setTime(expireTime);
  return now.toUTCString();
}
