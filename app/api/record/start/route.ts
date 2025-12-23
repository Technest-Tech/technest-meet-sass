import { EgressClient, EncodedFileOutput, RoomServiceClient } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { sanitizeRoomIdentifier } from '@/lib/utils/sanitize';

// Consistent hashing for LiveKit server routing - same as connection-details
function getLiveKitServerForRoom(roomName: string): { 
  clientUrl: string; 
  serverUrl: string;
} {
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

export async function GET(req: NextRequest) {
  try {
    const roomNameParam = req.nextUrl.searchParams.get('roomName');

    if (!roomNameParam) {
      return new NextResponse(JSON.stringify({ error: 'Missing roomName parameter' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Sanitize room name to prevent injection
    const roomName = sanitizeRoomIdentifier(roomNameParam);
    if (!roomName || roomName !== roomNameParam) {
      return new NextResponse(JSON.stringify({ error: 'Invalid room name format' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate room exists and is active (security check)
    const room = await prisma.room.findFirst({
      where: {
        OR: [
          { hostLink: roomName },
          { guestLink: roomName },
          { observerLink: roomName },
        ],
        isActive: true,
      },
      include: {
        client: {
          include: {
            account: true,
          },
        },
      },
    });

    if (!room) {
      return new NextResponse(JSON.stringify({ error: 'Room not found or inactive' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if client account is active
    if (!room.client.account || room.client.account.status !== 'ACTIVE') {
      return new NextResponse(JSON.stringify({ error: 'Room access denied' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // CRITICAL: Use hostLink as the actual LiveKit room name
    // All participants (host, guest, observer) join the same LiveKit room using hostLink
    // This ensures we check participants in the correct room
    const actualLiveKitRoomName = room.hostLink;
    
    console.log(`[Recording Start] Room name mapping: ${roomName} -> ${actualLiveKitRoomName} (hostLink)`);

    const {
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET,
    } = process.env;

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return new NextResponse(JSON.stringify({ 
        error: 'LiveKit configuration missing',
        details: 'LiveKit API credentials are not configured'
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // CRITICAL: Use consistent hashing to determine which server this room is on
    // Participants connect to the server determined by consistent hashing
    // We must check the same server they're connected to
    // The egress service will automatically use the correct egress instance:
    // - Rooms on Server 1 (178.128.78.195) -> egress-server1 (web_base_url: wss://rtc.acadmyq.com)
    // - Rooms on Server 2 (167.99.107.128) -> egress-server2 (web_base_url: wss://rtc2.acadmyq.com)
    const livekitRouting = getLiveKitServerForRoom(actualLiveKitRoomName);
    const serverUrl = livekitRouting.serverUrl;
    const clientUrl = livekitRouting.clientUrl;
    
    console.log(`[Recording Start] Server routing: ${actualLiveKitRoomName} -> Server URL: ${serverUrl}, Client URL: ${clientUrl}`);
    
    const hostURL = new URL(serverUrl);
    // Keep the original protocol - don't force HTTPS for IP addresses
    // Production servers may use HTTP for internal API calls (port 7880)
    // Only convert to HTTPS if it's a domain name (not IP) and currently HTTP
    if (hostURL.protocol === 'http:' && 
        !hostURL.hostname.match(/^\d+\.\d+\.\d+\.\d+$/) && 
        !hostURL.hostname.includes('localhost') && 
        !hostURL.hostname.includes('127.0.0.1')) {
      // Only convert domain names (like rtc.acadmyq.com) to HTTPS, not IP addresses
      hostURL.protocol = 'https:';
    }

    // Check if room has participants before starting recording
    // Use actualLiveKitRoomName (hostLink) instead of roomName parameter
    try {
      const roomServiceClient = new RoomServiceClient(hostURL.origin, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
      const participants = await roomServiceClient.listParticipants(actualLiveKitRoomName);
      
      if (!participants || participants.length === 0) {
        return new NextResponse(JSON.stringify({ 
          error: 'No participants in room',
          details: 'Please wait for participants to join before starting recording.'
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if any participant has active tracks - CRITICAL: Block if no tracks!
      let hasActiveTracks = false;
      let trackCount = 0;
      const trackDetails: string[] = [];
      
      for (const participant of participants) {
        // Check actual published tracks from the tracks object
        const tracks = participant.tracks || {};
        const trackSids = Object.keys(tracks);
        
        // Also check trackSidToPublishIdentity as fallback
        const publishedTracks = participant.trackSidToPublishIdentity || {};
        const publishedSids = Object.keys(publishedTracks);
        
        // Combine both sources
        const allTrackSids = [...new Set([...trackSids, ...publishedSids])];
        
        for (const sid of allTrackSids) {
          const track = tracks[sid];
          if (track) {
            const isMuted = track.muted === true;
            const trackType = track.type === 1 ? 'video' : track.type === 2 ? 'audio' : 'unknown';
            
            if (!isMuted && (track.type === 1 || track.type === 2)) {
              hasActiveTracks = true;
              trackCount++;
              trackDetails.push(`${participant.identity}: ${trackType} (${sid})`);
            }
          } else if (publishedTracks[sid]) {
            // Track is published but not in tracks object - assume it's active
            hasActiveTracks = true;
            trackCount++;
            trackDetails.push(`${participant.identity}: published track (${sid})`);
          }
        }
      }

      console.log(`[Recording Start] Participants: ${participants.length}, Active Tracks: ${trackCount}`);
      if (trackDetails.length > 0) {
        console.log(`[Recording Start] Track details:`, trackDetails);
      }

      if (!hasActiveTracks || trackCount === 0) {
        // BLOCK recording if no active tracks - this prevents "Start signal not received" error
        console.warn(`[Recording Start] BLOCKED: No active tracks found. Participants: ${participants.length}`);
        return new NextResponse(JSON.stringify({ 
          error: 'No signal received',
          details: `No active tracks detected (found ${trackCount} tracks from ${participants.length} participants). Please ensure at least one participant has their camera or microphone enabled and published before starting recording.`,
          hasNoSignalError: true,
          suggestion: 'Wait for participants to join, enable their camera or microphone, and ensure tracks are published. Then try starting the recording again.'
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      console.log(`✅ Starting recording with ${trackCount} active tracks from ${participants.length} participants`);
      
      // CRITICAL: Wait 4-5 seconds to ensure tracks are fully published and egress can subscribe
      // This prevents "Start signal not received" errors
      // Egress needs time to:
      // 1. Join the room as a participant
      // 2. Subscribe to all tracks
      // 3. Receive the start signal from LiveKit server
      console.log('[Recording Start] Waiting 4 seconds for tracks to be fully available for egress subscription...');
      await new Promise(resolve => setTimeout(resolve, 4000));
      console.log('[Recording Start] Delay complete, starting egress...');
    } catch (roomError) {
      console.error('Error checking room participants:', roomError);
      // Continue anyway - the egress service will handle the error
      // This is not a blocking error as the egress service can still work
    }

    // Verify egress service is available before proceeding
    const egressClient = new EgressClient(hostURL.origin, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    
    // Check for existing active recordings with timeout and better error handling
    // Use actualLiveKitRoomName (hostLink) for all LiveKit API calls
    try {
      const existingEgresses = await Promise.race([
        egressClient.listEgress({ roomName: actualLiveKitRoomName }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Egress service timeout')), 5000)
        )
      ]) as any[];
      
      if (existingEgresses && existingEgresses.length > 0 && existingEgresses.some((e) => e.status < 2)) {
        return new NextResponse(JSON.stringify({ 
          error: 'Meeting is already being recorded',
          details: 'A recording is already in progress for this room.'
        }), { 
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (listError) {
      console.error('Error checking existing egresses:', listError);
      
      // Check if it's a service unavailable error
      const errorMessage = listError instanceof Error ? listError.message : String(listError);
      const errorString = String(listError);
      
      // Only block if it's a clear panic or connection error
      if (errorString.includes('panic') || 
          errorString.includes('Internal Server Error') ||
          (errorString.includes('ECONNREFUSED') && !errorString.includes('timeout'))) {
        // Check egress health endpoint before giving up
        try {
          const healthUrl = hostURL.origin.replace('ws://', 'http://').replace('wss://', 'https://').replace(':7880', ':8080');
          const healthResponse = await fetch(healthUrl, { signal: AbortSignal.timeout(2000) });
          if (!healthResponse.ok) {
            return new NextResponse(JSON.stringify({ 
              error: 'Egress service unavailable',
              details: 'The recording service is not available. Please check that the LiveKit egress service is running and properly configured.',
              egressServiceError: true
            }), { 
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        } catch (healthError) {
          // Health check failed, but continue anyway - might be network issue
          console.warn('Egress health check failed, but continuing:', healthError);
        }
      }
      
      // For other errors (timeouts, etc.), continue - might be a temporary issue
      // The actual recording start will fail if egress is really unavailable
      console.warn('Continuing despite egress list error - will attempt to start recording');
    }

    // Use local file storage (no S3)
    // Sanitize roomName in filename to prevent path issues
    const sanitizedRoomName = roomName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}-${sanitizedRoomName}.mp4`;
    
    // IMPORTANT: Use full path including /recordings/
    // The egress service needs the full path, not just the filename
    // This matches the output.file.path in egress-config.yaml
    const filepath = `/recordings/${filename}`;
    
    const fileOutput = new EncodedFileOutput({
      filepath: filepath,
    });

    // Start recording with grid layout to capture all participants
    let egressInfo;
    try {
      console.log('[Recording Start] Calling startRoomCompositeEgress...');
      console.log(`[Recording Start] EgressClient connecting to: ${hostURL.origin}`);
      console.log(`[Recording Start] Room: ${actualLiveKitRoomName}, Server: ${serverUrl}`);
      // Add timeout for egress start (increased to 15 seconds to allow egress to connect)
      // Use actualLiveKitRoomName (hostLink) - this is the actual room name in LiveKit
      // NOTE: The LiveKit server will look for egress services via Redis
      // Make sure the egress service is connected to the SAME Redis instance as the LiveKit server
      egressInfo = await Promise.race([
        egressClient.startRoomCompositeEgress(
          actualLiveKitRoomName,
          {
            file: fileOutput,
          },
          {
            layout: 'grid', // Use grid layout to capture all participants
            resolution: '1920x1080',
            videoBitrate: 3000,
            audioBitrate: 160,
            videoCodec: 'h264',
            audioCodec: 'aac',
            // web_base_url is configured in egress-config.yaml
            // No need to pass it here - egress will use the config file value
          },
        ),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Egress start timeout')), 30000) // Increased to 30s to allow Redis discovery
        )
      ]) as any;
      
      console.log(`[Recording Start] Egress started successfully: ${egressInfo.egressId}`);
      
      // Give egress a moment to actually connect and subscribe to tracks
      // This helps prevent "Start signal not received" errors
      console.log('[Recording Start] Waiting 2 seconds for egress to connect and subscribe...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify egress is actually starting (optional check)
      // Use actualLiveKitRoomName (hostLink) for consistency
      try {
        const verifyEgresses = await egressClient.listEgress({ roomName: actualLiveKitRoomName });
        const ourEgress = verifyEgresses.find((e: any) => e.egressId === egressInfo.egressId);
        if (ourEgress) {
          console.log(`[Recording Start] Egress status verified: ${ourEgress.status} (0=starting, 1=active)`);
        }
      } catch (verifyError) {
        console.warn('[Recording Start] Could not verify egress status:', verifyError);
        // Don't fail - egress might still be starting
      }
    } catch (egressError) {
      console.error('Egress start error:', egressError);
      console.error('Egress error details:', {
        message: egressError instanceof Error ? egressError.message : String(egressError),
        stack: egressError instanceof Error ? egressError.stack : undefined,
        serverUrl,
        roomName: actualLiveKitRoomName
      });
      
      const errorMessage = egressError instanceof Error ? egressError.message : String(egressError);
      const errorString = String(egressError);
      
      // Detect specific error types
      if (errorMessage.includes('no signal') || 
          errorMessage.includes('No signal') ||
          errorMessage.includes('no tracks') ||
          errorMessage.includes('no participants')) {
        return new NextResponse(JSON.stringify({ 
          error: 'No signal received',
          details: 'Unable to receive participant signals. Please ensure participants have their camera or microphone enabled.',
          hasNoSignalError: true
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check for egress service panic or internal errors
      if (errorString.includes('panic') || 
          errorString.includes('Internal Server Error') ||
          errorString.includes('Internal service panic')) {
        return new NextResponse(JSON.stringify({ 
          error: 'Egress service error',
          details: 'The recording service encountered an internal error. Please check that the LiveKit egress service is running and properly configured. You may need to restart the egress service.',
          egressServiceError: true,
          troubleshooting: [
            'Verify the egress service is running',
            'Check LiveKit server logs for errors',
            'Ensure egress service has proper permissions',
            'Restart the egress service if needed'
          ]
        }), { 
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (errorMessage.includes('egress') && errorMessage.includes('not available')) {
        return new NextResponse(JSON.stringify({ 
          error: 'Egress service unavailable',
          details: 'The recording service is not available. Please check LiveKit server configuration and ensure the egress service is running.'
        }), { 
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (errorMessage.includes('ECONNREFUSED') || 
          errorMessage.includes('connect') ||
          errorMessage.includes('timeout')) {
        return new NextResponse(JSON.stringify({ 
          error: 'Connection error',
          details: 'Unable to connect to LiveKit egress service. Please check server configuration, network connectivity, and ensure the egress service is running.',
          connectionError: true
        }), { 
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Generic error
      return new NextResponse(JSON.stringify({ 
        error: errorMessage,
        details: 'Failed to start recording. Check LiveKit server configuration and permissions.',
        originalError: errorString
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Return the egress ID for tracking
    return new NextResponse(JSON.stringify({ 
      egressId: egressInfo.egressId,
      filename: filename,
      status: 'started'
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Recording start error:', error);
    
    let errorMessage = 'Failed to start recording';
    let details = 'Unknown error occurred';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      details = error.stack || 'Unknown error';
      
      // Check for network errors
      if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
        errorMessage = 'Network error';
        details = 'Unable to connect to recording service. Please check your network connection.';
      }
    }
    
    return new NextResponse(JSON.stringify({ 
      error: errorMessage,
      details: details
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
