import { randomString } from '@/lib/client-utils';
import { getLiveKitURL } from '@/lib/getLiveKitURL';
import { ConnectionDetails } from '@/lib/types';
import { AccessToken, AccessTokenOptions, VideoGrant, RoomServiceClient } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { checkTrialExpiration, isSubscriptionActive } from '@/lib/utils/trial-check';

const API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const API_SECRET = process.env.LIVEKIT_API_SECRET || 'secret';
// For local development, use local IP instead of localhost for mobile devices
// Check if we're in development mode (using devkey or NODE_ENV)
const isDevelopment = (process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production') && API_KEY === 'devkey';
const defaultLivekitUrl = isDevelopment 
  ? 'ws://192.168.1.13:7880' 
  : 'ws://localhost:7880';
const LIVEKIT_URL = process.env.LIVEKIT_URL || defaultLivekitUrl;
const PUBLIC_LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || defaultLivekitUrl;

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
    
    // Validate required parameters
    if (!roomName || !participantName) {
      return NextResponse.json(
        { error: 'Room name and participant name are required' },
        { status: 400 }
      );
    }
    console.log('🔧 Environment check:', { 
      apiKey: API_KEY ? '***' : 'undefined', 
      apiSecret: API_SECRET ? '***' : 'undefined',
      livekitUrl: LIVEKIT_URL
    });
    
    if (!LIVEKIT_URL) {
      throw new Error('LIVEKIT_URL is not defined');
    }
    // Use the public URL for client connections, internal URL for server operations
    const clientLivekitUrl = region ? getLiveKitURL(PUBLIC_LIVEKIT_URL, region) : PUBLIC_LIVEKIT_URL;
    const serverLivekitUrl = region ? getLiveKitURL(LIVEKIT_URL, region) : LIVEKIT_URL;
    let randomParticipantPostfix = request.cookies.get(COOKIE_KEY)?.value;
    if (clientLivekitUrl === undefined || serverLivekitUrl === undefined) {
      throw new Error('Invalid region');
    }

    // These checks are now redundant since we check above, but keep for safety
    if (typeof roomName !== 'string') {
      return NextResponse.json({ error: 'Missing required query parameter: roomName' }, { status: 400 });
    }
    if (!participantName || typeof participantName !== 'string') {
      return NextResponse.json({ error: 'Missing required query parameter: participantName' }, { status: 400 });
    }

    // Validate participant type
    if (participantType !== 'host' && participantType !== 'guest' && participantType !== 'observer') {
      return NextResponse.json({ error: 'Invalid participant type. Must be "host", "guest", or "observer"' }, { status: 400 });
    }

    // Check room exists and subscription is active
    // roomName is the room link (hostLink, guestLink, or observerLink)
    const room = await prisma.room.findFirst({
      where: {
        OR: [
          { hostLink: roomName },
          { guestLink: roomName },
          { observerLink: roomName },
        ],
      },
      include: {
        client: {
          include: {
            subscription: true,
          },
        },
      } as any,
    }) as any;

    if (!room) {
      return NextResponse.json(
        { error: 'الغرفة غير موجودة' },
        { status: 404 }
      );
    }

    if (!room.isActive) {
      return NextResponse.json(
        { error: 'الغرفة غير نشطة' },
        { status: 403 }
      );
    }

    if (!room.client.subscription) {
      return NextResponse.json(
        { error: 'اشتراك العميل غير موجود' },
        { status: 403 }
      );
    }

    // Check and update trial expiration if needed
    const subscription = await checkTrialExpiration(room.client.subscription);

    // Check if subscription is active (ACTIVE or valid TRIAL)
    if (!isSubscriptionActive(subscription)) {
      return NextResponse.json(
        { error: 'اشتراك العميل غير نشط. يرجى التواصل مع المسؤول' },
        { status: 403 }
      );
    }

    // Check if accessing via host link, guest link, or observer link
    const isHostLink = room.hostLink === roomName;
    const isGuestLink = room.guestLink === roomName;
    const isObserverLink = room.observerLink === roomName;
    
    // For observers, use the actual room's link (hostLink/guestLink) as the LiveKit room name
    // This ensures they join the SAME room as the host and guests
    const actualRoomName = isObserverLink ? room.hostLink : roomName;

    // Validate participant type matches link type
    // Note: hostLink and guestLink may be the same, so we check both conditions
    if (isHostLink && !isGuestLink && !isObserverLink && participantType !== 'host') {
      return NextResponse.json(
        { error: 'يجب استخدام رابط المضيف للدخول كمضيف' },
        { status: 403 }
      );
    }

    if (isGuestLink && !isHostLink && !isObserverLink && participantType !== 'guest') {
      return NextResponse.json(
        { error: 'يجب استخدام رابط الضيف للدخول كضيف' },
        { status: 403 }
      );
    }

    if (isObserverLink && participantType !== 'observer') {
      return NextResponse.json(
        { error: 'يجب استخدام رابط المراقب للدخول كمراقب' },
        { status: 403 }
      );
    }

    // If both host and guest links are the same, participant type determines access
    if (isHostLink && isGuestLink && !isObserverLink) {
      // Both links are the same, so we allow either host or guest
      // The access control below will enforce the rules
    }

    // Observers bypass all access control checks (no limits, no waiting room)
    // They are invisible participants that can only subscribe, not publish
    const isObserver = participantType === 'observer';

    // Check host access: Only one host can be active at a time per room (unless allowMultipleHosts is enabled)
    if (participantType === 'host' && isHostLink && !isObserver && !room.allowMultipleHosts) {
      // Normalize participant name (remove any "host" suffix and trim whitespace)
      // Ensure participantName is a string
      const safeParticipantName = String(participantName || '').trim();
      if (!safeParticipantName) {
        return NextResponse.json(
          { error: 'Participant name is required' },
          { status: 400 }
        );
      }
      
      const normalizedName = safeParticipantName.toLowerCase().replace(/\s+host\s*$/i, '').trim();
      const hostIdentity = `${normalizedName}_host_${actualRoomName}`.toLowerCase();
      
      // Use a transaction to atomically check and set the active host
      // This prevents race conditions when multiple hosts try to join simultaneously
      try {
        // Use Prisma transaction to ensure atomicity
        const result = await prisma.$transaction(async (tx) => {
          // 1. First, check LiveKit for ANY active hosts (most reliable source of truth)
          let livekitHasActiveHost = false;
          let livekitActiveHostIdentity = '';
          
          try {
            const roomService = new RoomServiceClient(LIVEKIT_URL, API_KEY, API_SECRET);
            const participants = await roomService.listParticipants(actualRoomName).catch((err) => {
              console.log('LiveKit listParticipants error:', err);
              return [];
            });
            
            if (participants && participants.length > 0) {
              const activeHosts = participants.filter(
                (p: any) => {
                  try {
                    const metadata = p.metadata ? JSON.parse(p.metadata) : {};
                    return metadata.type === 'host';
                  } catch {
                    return p.identity && (
                      p.identity.toLowerCase().includes('_host_') || 
                      p.identity.toLowerCase().endsWith('_host')
                    );
                  }
                }
              );

              if (activeHosts.length > 0) {
                livekitHasActiveHost = true;
                livekitActiveHostIdentity = (activeHosts[0] as any).identity?.toLowerCase() || '';
                
                // If there's an active host in LiveKit and it's not us, block
                if (livekitActiveHostIdentity !== hostIdentity) {
                  return { blocked: true, reason: 'active_host_in_livekit' };
                }
              }
            }
          } catch (error) {
            console.log('LiveKit check failed, continuing with database check:', error);
          }

          // 2. Check database state
          const currentRoom = await tx.room.findUnique({
            where: { id: room.id },
            select: {
              activeHostIdentity: true,
              activeHostLastSeen: true,
            } as any,
          }) as any;

          // 3. If database has an active host but LiveKit doesn't, clear the stale entry
          if (currentRoom?.activeHostIdentity && !livekitHasActiveHost) {
            console.log('Clearing stale active host entry (not found in LiveKit)');
            await tx.room.update({
              where: { id: room.id },
              data: {
                activeHostIdentity: null,
                activeHostSessionId: null,
                activeHostLastSeen: null,
              } as any,
            });
          }
          // 4. If database has an active host that's different from us, verify with LiveKit
          else if (currentRoom?.activeHostIdentity && currentRoom.activeHostIdentity.toLowerCase() !== hostIdentity) {
            const existingIdentity = currentRoom.activeHostIdentity.toLowerCase();
            const lastSeen = currentRoom.activeHostLastSeen ? new Date(currentRoom.activeHostLastSeen) : null;
            const now = new Date();
            const secondsSinceLastSeen = lastSeen ? (now.getTime() - lastSeen.getTime()) / 1000 : Infinity;
            
            // If seen within 10 seconds and LiveKit confirms they're active, block
            if (secondsSinceLastSeen < 10 && livekitHasActiveHost && livekitActiveHostIdentity === existingIdentity) {
              return { blocked: true, reason: 'active_host_in_livekit' };
            }
            
            // If not seen recently or not in LiveKit, clear the stale entry
            if (secondsSinceLastSeen >= 10 || !livekitHasActiveHost) {
              console.log(`Clearing stale active host entry (last seen ${secondsSinceLastSeen}s ago)`);
              await tx.room.update({
                where: { id: room.id },
                data: {
                  activeHostIdentity: null,
                  activeHostSessionId: null,
                  activeHostLastSeen: null,
                } as any,
              });
            }
          }

          // 5. Atomically update: only set if no active host or if we're the active host
          const updated = await tx.room.updateMany({
            where: {
              id: room.id,
              OR: [
                { activeHostIdentity: null } as any,
                { activeHostIdentity: hostIdentity } as any,
              ],
            },
            data: {
              activeHostIdentity: hostIdentity,
              activeHostSessionId: hostIdentity,
              activeHostLastSeen: new Date(),
            } as any,
          });

          // If no rows were updated, it means another host just became active
          if (updated.count === 0) {
            return { blocked: true, reason: 'race_condition' };
          }

          return { blocked: false, updated: updated.count };
        });

        // Handle the result
        if (result.blocked) {
          console.log(`�� Blocking host join: ${result.reason}`, {
            roomName,
            hostIdentity,
          });
          
          return NextResponse.json(
            { error: 'There is already an active host in this room. Only one host can access at a time' },
            { status: 403 }
          );
        }

        console.log(`✅ Host access granted`, {
          roomName,
          hostIdentity,
          updatedCount: result.updated,
        });
      } catch (error) {
        console.error('Error in host access check transaction:', error);
        // On error, block to be safe
        return NextResponse.json(
          { error: 'There is already an active host in this room. Only one host can access at a time' },
          { status: 403 }
        );
      }
    }

    // Check guest access: Verify room hasn't reached max participants
    // Use the guestLink as the LiveKit room name (or hostLink if they're the same)
    // Observers bypass participant limits
    if (participantType === 'guest' && (isGuestLink || (isHostLink && isGuestLink)) && !isObserver) {
      try {
        const roomService = new RoomServiceClient(LIVEKIT_URL, API_KEY, API_SECRET);
        // Use actual room name for LiveKit operations
        const livekitRoomName = actualRoomName;
        const participants = await roomService.listParticipants(livekitRoomName).catch((err) => {
          console.log('LiveKit listParticipants error:', err);
          return [];
        });
        
        if (participants && participants.length >= room.maxParticipants) {
          return NextResponse.json(
            { error: `تم الوصول إلى الحد الأقصى للمشاركين (${room.maxParticipants}). يرجى المحاولة لاحقاً` },
            { status: 403 }
          );
        }
      } catch (error) {
        // If room doesn't exist yet, that's fine - first guest can join
        console.log('Room check result:', error instanceof Error ? error.message : 'Room may not exist yet');
      }
    }

    // Generate participant token with more stable identity
    if (!randomParticipantPostfix) {
      randomParticipantPostfix = randomString(8); // Longer random string for uniqueness
    }
    
    // Create a stable identity that doesn't change on reconnection
    // For hosts, use the same normalized identity format as stored in database
    // For observers, use a random identity to allow multiple observers
    // Use room name and participant type to ensure uniqueness while maintaining stability
    let uniqueIdentity: string;
    if (participantType === 'host') {
      // Normalize the name the same way we did in the host check above
      const safeName = String(participantName || '').trim();
      const normalizedName = safeName.toLowerCase().replace(/\s+host\s*$/i, '').trim();
      uniqueIdentity = `${normalizedName}_host_${actualRoomName}`.toLowerCase();
    } else if (participantType === 'observer') {
      // Observers use a random identity to allow multiple observers
      // Add timestamp to ensure uniqueness
      const safeName = String(participantName || 'Observer').trim();
      uniqueIdentity = `${safeName.toLowerCase()}_observer_${Date.now()}_${randomString(8)}`.toLowerCase();
    } else {
      const safeName = String(participantName || '').trim();
      uniqueIdentity = `${safeName.toLowerCase()}_${participantType}_${actualRoomName}`.toLowerCase();
    }
    
    const participantToken = await createParticipantToken(
      {
        identity: uniqueIdentity,
        name: participantName,
        metadata: JSON.stringify({ type: participantType, ...JSON.parse(metadata || '{}') }),
      },
      actualRoomName, // Use actual room name so all participants join the same LiveKit room
      participantType,
      serverLivekitUrl,
    );

    console.log('✅ Token generated successfully, length:', participantToken ? participantToken.length : 0);
    
    // Return connection details
    const data: ConnectionDetails = {
      serverUrl: clientLivekitUrl,
      roomName: actualRoomName, // Use actual room name for consistency
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
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    if (error instanceof Error) {
      return NextResponse.json(
        { 
          error: 'Internal server error',
          message: process.env.NODE_ENV === 'development' ? error.message : undefined,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function createParticipantToken(userInfo: AccessTokenOptions, roomName: string, participantType: string, serverUrl: string) {
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
  // Note: algorithm is set during token creation, not after
  
  // Base grant for all participants
  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };

  // Add participant-specific permissions
  if (participantType === 'host') {
    grant.roomAdmin = true; // Host can manage the room
    grant.roomCreate = true; // Host can create rooms
    grant.canPublish = true; // Host can always publish
    grant.canPublishData = true; // Host can send data
    grant.canSubscribe = true; // Host can subscribe to all
  } else if (participantType === 'observer') {
    // Observer permissions (completely invisible, read-only)
    grant.roomAdmin = false; // Observers cannot manage the room
    grant.roomCreate = false; // Observers cannot create rooms
    grant.canPublish = false; // Observers CANNOT publish (no camera/mic)
    grant.canPublishData = false; // Observers CANNOT send data (no chat/reactions)
    grant.canSubscribe = true; // Observers CAN subscribe to all (see/hear everything)
    grant.hidden = true; // Mark as hidden participant
  } else {
    // Guest permissions (more restricted than host)
    grant.roomAdmin = false; // Guests cannot manage the room
    grant.roomCreate = false; // Guests cannot create rooms
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

