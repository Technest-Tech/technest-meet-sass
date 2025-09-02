import { randomString } from '@/lib/client-utils';
import { getLiveKitURL } from '@/lib/getLiveKitURL';
import { ConnectionDetails } from '@/lib/types';
import { AccessToken, AccessTokenOptions, VideoGrant } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

const COOKIE_KEY = 'random-participant-postfix';

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const roomName = request.nextUrl.searchParams.get('roomName');
    const participantName = request.nextUrl.searchParams.get('participantName');
    const participantType = request.nextUrl.searchParams.get('participantType') || 'guest'; // 'host' or 'guest'
    const metadata = request.nextUrl.searchParams.get('metadata') ?? '';
    const region = request.nextUrl.searchParams.get('region');
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
    
    // Create a more unique identity that includes timestamp to prevent duplicates
    const timestamp = Date.now();
    const uniqueIdentity = `${participantName}__${randomParticipantPostfix}__${timestamp}`;
    
    const participantToken = await createParticipantToken(
      {
        identity: uniqueIdentity,
        name: participantName,
        metadata: JSON.stringify({ type: participantType, ...JSON.parse(metadata || '{}') }),
      },
      roomName,
      participantType,
    );

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
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function createParticipantToken(userInfo: AccessTokenOptions, roomName: string, participantType: string) {
  const at = new AccessToken(API_KEY, API_SECRET, userInfo);
  at.ttl = '30m'; // Increased from 5m to 30m to reduce reconnections
  
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
  return at.toJwt();
}

function getCookieExpirationTime(): string {
  var now = new Date();
  var time = now.getTime();
  var expireTime = time + 60 * 120 * 1000;
  now.setTime(expireTime);
  return now.toUTCString();
}
