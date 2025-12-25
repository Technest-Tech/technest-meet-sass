import { EgressClient } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { sanitizeRoomIdentifier } from '@/lib/utils/sanitize';
import { existsSync } from 'fs';
import { join } from 'path';
import { readdir } from 'fs/promises';

// Consistent hashing for LiveKit server routing - same as connection-details and start
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
    const egressIdParam = req.nextUrl.searchParams.get('egressId');

    if (!roomNameParam) {
      return new NextResponse(JSON.stringify({ error: 'Missing roomName parameter' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Sanitize room name
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

    const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return new NextResponse(JSON.stringify({ 
        error: 'LiveKit configuration missing',
        details: 'LiveKit API credentials are not configured'
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // CRITICAL: Use hostLink as the actual LiveKit room name (same as start endpoint)
    // All participants (host, guest, observer) join the same LiveKit room using hostLink
    const actualLiveKitRoomName = room.hostLink;
    
    // CRITICAL: Use consistent hashing to determine which server this room is on
    // The recording was started on a specific server, we must check the same server
    const livekitRouting = getLiveKitServerForRoom(actualLiveKitRoomName);
    const serverUrl = livekitRouting.serverUrl;
    
    // CRITICAL FIX: Reduce logging - only log once per minute per room to avoid log spam
    const logKey = `recording-status-${actualLiveKitRoomName}`;
    const lastLogTime = (global as any).__recordingStatusLogs?.[logKey] || 0;
    const now = Date.now();
    if (now - lastLogTime > 60000) { // Only log once per minute
      console.log(`[Recording Status] Server routing: ${actualLiveKitRoomName} -> ${serverUrl}`);
      if (!(global as any).__recordingStatusLogs) {
        (global as any).__recordingStatusLogs = {};
      }
      (global as any).__recordingStatusLogs[logKey] = now;
    }
    
    const hostURL = new URL(serverUrl);
    // Keep the original protocol - don't force HTTPS for IP addresses
    // Production servers may use HTTP for internal API calls (port 7880)
    if (hostURL.protocol === 'http:' && 
        !hostURL.hostname.match(/^\d+\.\d+\.\d+\.\d+$/) && 
        !hostURL.hostname.includes('localhost') && 
        !hostURL.hostname.includes('127.0.0.1')) {
      hostURL.protocol = 'https:';
    }

    const egressClient = new EgressClient(hostURL.origin, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

    let egressInfo;

    if (egressIdParam) {
      // Get specific egress by ID - use listEgress and filter by ID
      try {
        // First try with actualLiveKitRoomName (hostLink) filter
        let egresses = await Promise.race([
          egressClient.listEgress({ roomName: actualLiveKitRoomName }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Egress service timeout')), 5000)
          )
        ]) as any[];
        
        // Find the specific egress by ID
        egressInfo = egresses.find((e: any) => e.egressId === egressIdParam);
        
        // If not found with roomName, try without filter (might be completed and not in room list)
        if (!egressInfo) {
          try {
            const allEgresses = await Promise.race([
              egressClient.listEgress(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Egress service timeout')), 5000)
              )
            ]) as any[];
            egressInfo = allEgresses.find((e: any) => e.egressId === egressIdParam);
          } catch (allError) {
            console.warn('Error getting all egresses:', allError);
          }
        }
        
        if (!egressInfo) {
          return new NextResponse(JSON.stringify({ 
            error: 'Recording not found',
            details: `No recording found with ID: ${egressIdParam}`
          }), { 
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } catch (error) {
        console.error('Error getting egress by ID:', error);
        
        const errorString = String(error);
        if (errorString.includes('panic') || errorString.includes('Internal Server Error')) {
          return new NextResponse(JSON.stringify({ 
            error: 'Egress service error',
            details: 'The recording service encountered an internal error. Please check that the egress service is running.',
            egressServiceError: true
          }), { 
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        return new NextResponse(JSON.stringify({ 
          error: 'Recording not found',
          details: error instanceof Error ? error.message : 'Unknown error'
        }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else {
      // Get latest active egress for the room
      try {
        const egresses = await Promise.race([
          egressClient.listEgress({ roomName: actualLiveKitRoomName }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Egress service timeout')), 5000)
          )
        ]) as any[];
        
        if (!egresses || egresses.length === 0) {
          return new NextResponse(JSON.stringify({ 
            status: 0, // idle
            message: 'No recording found for this room'
          }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Helper to get timestamp from various date formats
        const getTime = (date: any): number => {
          if (!date) return 0;
          if (typeof date === 'number') return date;
          if (date instanceof Date) return date.getTime();
          if (typeof date.getTime === 'function') return date.getTime();
          if (typeof date === 'string') return new Date(date).getTime() || 0;
          return 0;
        };
        
        // Status priority: 1 (active) > 0 (starting) > 2 (completed) > 3/4/5 (failed/ended)
        const statusPriority = (status: number) => {
          if (status === 1) return 100; // Active - highest priority
          if (status === 0) return 50;  // Starting - second priority
          if (status === 2) return 10; // Completed - third priority
          return 0; // Failed/ended - lowest priority
        };
        
        // Prioritize ACTIVE recordings (status 1) over completed ones (status 2)
        // Sort by: 1) Active status first, 2) Then by creation time (most recent first)
        egressInfo = egresses.sort((a, b) => {
          const aPriority = statusPriority(a.status || 0);
          const bPriority = statusPriority(b.status || 0);
          
          // If different priorities, sort by priority
          if (aPriority !== bPriority) {
            return bPriority - aPriority;
          }
          
          // If same priority, sort by creation time (most recent first)
          const aTime = getTime(a.createdAt);
          const bTime = getTime(b.createdAt);
          return bTime - aTime;
        })[0];
        
        console.log(`[Status Check] Selected egress: ${egressInfo.egressId}, status: ${egressInfo.status}, priority: ${statusPriority(egressInfo.status || 0)}`);
      } catch (listError) {
        console.error('Error listing egresses:', listError);
        
        const errorString = String(listError);
        if (errorString.includes('panic') || errorString.includes('Internal Server Error')) {
          return new NextResponse(JSON.stringify({ 
            error: 'Egress service error',
            details: 'The recording service encountered an internal error. Please check that the egress service is running.',
            egressServiceError: true,
            status: 0
          }), { 
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Return idle status if we can't check
        return new NextResponse(JSON.stringify({ 
          status: 0, // idle
          message: 'Unable to check recording status',
          error: 'Egress service may be unavailable'
        }), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (!egressInfo) {
      return new NextResponse(JSON.stringify({ 
        status: 0, // idle
        message: 'No recording found'
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Map LiveKit egress status to our status
    // 0 = EGRESS_STARTING
    // 1 = EGRESS_ACTIVE
    // 2 = EGRESS_COMPLETE
    // 3 = EGRESS_ABORTED
    // 4 = EGRESS_FAILED
    // 5 = EGRESS_ENDED (recording ended, may or may not have file)
    let status = egressInfo.status;
    
    // Handle status 5 - check if it has a file (completed) or is aborted
    if (status === 5) {
      // Status 5 can mean ended - check if there's a file
      if (egressInfo.file?.filepath) {
        // Has a file, treat as completed
        status = 2;
      } else if (egressInfo.error) {
        // Check if error indicates actual failure or just processing
        const errorLower = egressInfo.error.toLowerCase();
        const isProcessingError = 
          errorLower.includes('processing') ||
          errorLower.includes('encoding') ||
          errorLower.includes('finalizing');
        
        if (isProcessingError) {
          // Still processing, keep as active (status 1) to allow more time
          status = 1;
        } else {
          // Has real error, treat as aborted/failed
          status = 3;
        }
      } else {
        // No file and no error - might still be processing
        // Check how long ago it ended - if very recent, might still be processing
        const endedAt = egressInfo.endedAt;
        const now = Date.now();
        let endedTime = 0;
        
        if (endedAt) {
          if (typeof endedAt === 'number') {
            endedTime = endedAt;
          } else if (endedAt instanceof Date) {
            endedTime = endedAt.getTime();
          } else if (typeof endedAt.getTime === 'function') {
            endedTime = endedAt.getTime();
          } else if (typeof endedAt === 'string') {
            endedTime = new Date(endedAt).getTime();
          }
        }
        
        // If ended less than 10 seconds ago, might still be processing
        // Give it more time before marking as failed
        if (endedTime > 0 && (now - endedTime) < 10000) {
          // Still processing, keep as active
          status = 1;
        } else {
          // Been too long, likely failed
          status = 3;
        }
      }
    }

    // Check for "no signal" errors in error message
    let errorMessage: string | undefined;
    let hasNoSignalError = false;

    if (egressInfo.error) {
      errorMessage = egressInfo.error;
      hasNoSignalError = 
        errorMessage.toLowerCase().includes('no signal') ||
        errorMessage.toLowerCase().includes('no signal received') ||
        errorMessage.toLowerCase().includes('no tracks') ||
        errorMessage.toLowerCase().includes('no participants');
    }

    // Helper function to safely convert date to ISO string
    const toISOString = (date: any): string | undefined => {
      if (!date) return undefined;
      if (typeof date === 'string') return date;
      if (typeof date === 'number') return new Date(date).toISOString();
      if (date instanceof Date) return date.toISOString();
      if (typeof date.toISOString === 'function') return date.toISOString();
      return undefined;
    };

    // Prepare response - use the mapped status (status 5 might become 2 if file exists)
    const response: any = {
      status: status, // This is the mapped status (2 if status 5 had a file)
      egressId: egressInfo.egressId,
      roomName: egressInfo.roomName,
      createdAt: toISOString(egressInfo.createdAt),
      originalStatus: egressInfo.status, // Keep original for debugging
    };

    // Add status-specific information
    if (status === 2) {
      // Completed
      response.filename = egressInfo.file?.filepath || 'recording.mp4';
      response.endedAt = toISOString(egressInfo.endedAt);
      response.duration = egressInfo.file?.duration;
      response.fileSize = egressInfo.file?.fileSize;
      response.downloadUrl = `/api/record/file?egressId=${encodeURIComponent(egressInfo.egressId)}`;
    } else if (status === 3 || status === 4) {
      // Aborted or Failed
      response.error = errorMessage || 'Recording failed';
      response.hasNoSignalError = hasNoSignalError;
      if (hasNoSignalError) {
        response.suggestion = 'Please ensure participants have their camera or microphone enabled before starting recording.';
      }
      // Even if aborted, check if there's a file (partial recording)
      if (egressInfo.file?.filepath) {
        response.filename = egressInfo.file.filepath;
        response.downloadUrl = `/api/record/file?egressId=${encodeURIComponent(egressInfo.egressId)}`;
        response.partialRecording = true;
      }
    } else if (status === 1) {
      // Active - check for time limit
      try {
        response.startedAt = toISOString(egressInfo.startedAt);
      } catch (dateError) {
        console.warn(`[Recording Status] Error converting startedAt to ISO string:`, dateError);
        // Try to get startedAt using helper function
        const startedAtTime = getTime(egressInfo.startedAt);
        if (startedAtTime > 0) {
          response.startedAt = new Date(startedAtTime).toISOString();
        }
      }
      
      // Check if recording has exceeded time limit
      const maxDurationSeconds = parseInt(process.env.RECORDING_MAX_DURATION_SECONDS || '7200', 10); // Default 2 hours
      
      if (maxDurationSeconds > 0 && egressInfo.startedAt) {
        try {
          // Handle BigInt or regular number/Date for startedAt
          let startedAtTime: number;
          if (typeof egressInfo.startedAt === 'bigint') {
            // Convert BigInt nanoseconds to milliseconds
            startedAtTime = Number(egressInfo.startedAt) / 1000000;
          } else if (typeof egressInfo.startedAt === 'number') {
            // If it's already a number, check if it's in milliseconds or seconds
            startedAtTime = egressInfo.startedAt > 1e12 ? egressInfo.startedAt : egressInfo.startedAt * 1000;
          } else if (egressInfo.startedAt instanceof Date) {
            startedAtTime = egressInfo.startedAt.getTime();
          } else if (typeof egressInfo.startedAt === 'string') {
            startedAtTime = new Date(egressInfo.startedAt).getTime();
          } else {
            // Use the helper function
            startedAtTime = getTime(egressInfo.startedAt);
          }
          
          // Validate the time is reasonable (not NaN, not 0, not in the future)
          if (isNaN(startedAtTime) || startedAtTime <= 0 || startedAtTime > Date.now()) {
            console.warn(`[Recording Status] Invalid startedAt time: ${startedAtTime}, skipping time limit check`);
          } else {
            const now = new Date();
            const elapsedSeconds = Math.floor((now.getTime() - startedAtTime) / 1000);
            
            if (elapsedSeconds >= maxDurationSeconds) {
              // Recording has exceeded time limit - auto-stop it
              console.log(`[Recording Status] ⏰ Recording ${egressInfo.egressId} has exceeded time limit (${elapsedSeconds}s >= ${maxDurationSeconds}s), auto-stopping...`);
              
              try {
                // Use the existing egressClient that was created earlier
                await egressClient.stopEgress(egressInfo.egressId);
                console.log(`[Recording Status] ✅ Auto-stopped recording ${egressInfo.egressId} due to time limit`);
                
                // Return status indicating it was auto-stopped
                response.status = 2; // Completed
                response.message = 'Recording automatically stopped due to time limit';
                status = 2;
              } catch (stopError) {
                console.error(`[Recording Status] ❌ Error auto-stopping recording ${egressInfo.egressId}:`, stopError);
                // Continue with normal response - the recording will be stopped on next check
                response.warning = 'Recording exceeded time limit but could not be automatically stopped. Please stop manually.';
              }
            } else {
              // Calculate time remaining and add to response
              const remainingSeconds = maxDurationSeconds - elapsedSeconds;
              response.timeRemaining = remainingSeconds;
              response.maxDuration = maxDurationSeconds;
              
              // Add warning if approaching limit
              const warningThreshold = parseInt(process.env.RECORDING_WARNING_THRESHOLD_SECONDS || '300', 10); // Default 5 minutes
              if (remainingSeconds <= warningThreshold && remainingSeconds > 0) {
                const minutesRemaining = Math.ceil(remainingSeconds / 60);
                response.warning = `Recording will automatically stop in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}`;
              }
            }
          }
        } catch (timeLimitError) {
          console.error(`[Recording Status] Error checking time limit for recording ${egressInfo.egressId}:`, timeLimitError);
          // Don't fail the entire request if time limit check fails - just log and continue
        }
      }
    }
    
    // Handle status 5 separately (after status mapping)
    if (egressInfo.status === 5 && status !== 2) {
      // Status 5 - Ended/Aborted (check if has file)
      if (egressInfo.file?.filepath) {
        // Has a file, treat as completed
        response.filename = egressInfo.file.filepath;
        response.endedAt = toISOString(egressInfo.endedAt);
        response.duration = egressInfo.file.duration;
        response.fileSize = egressInfo.file.fileSize;
        response.downloadUrl = `/api/record/file?egressId=${encodeURIComponent(egressInfo.egressId)}`;
        // Override status to 2 (completed) if file exists
        response.status = 2;
        status = 2; // Update local status for consistency
      } else {
        // No file in egressInfo - check filesystem for file existence
        // Try to find file by egressId or roomName pattern
        const recordingsDir = join(process.cwd(), 'recordings');
        let fileFound = false;
        let foundFilename = '';
        
        try {
          if (existsSync(recordingsDir)) {
            const files = await readdir(recordingsDir);
            // Look for files that might match this recording
            // Pattern: timestamp-roomName.mp4 or files with egressId in name
            const roomNamePattern = egressInfo.roomName || actualLiveKitRoomName;
            const matchingFile = files.find(file => 
              file.endsWith('.mp4') && 
              (file.includes(roomNamePattern) || file.includes(egressInfo.egressId))
            );
            
            if (matchingFile) {
              fileFound = true;
              foundFilename = matchingFile;
            }
          }
        } catch (fsError) {
          console.warn('Error checking filesystem for recording:', fsError);
          // Continue with normal flow if filesystem check fails
        }
        
        if (fileFound) {
          // File exists on disk! Treat as completed
          response.filename = foundFilename;
          response.endedAt = toISOString(egressInfo.endedAt);
          response.downloadUrl = `/api/record/file?egressId=${encodeURIComponent(egressInfo.egressId)}`;
          response.status = 2;
          status = 2;
          console.log(`[Status Check] File found on disk for egress ${egressInfo.egressId}: ${foundFilename}`);
        } else {
          // No file - aborted/failed
          response.error = errorMessage || 'Recording was stopped before it could start';
          response.hasNoSignalError = true;
          response.suggestion = 'Recording was stopped too quickly or no active tracks were available. Please ensure participants have their camera or microphone enabled and wait a moment before stopping.';
          response.status = 3; // Mark as aborted
        }
      }
    }
    
    // Also check filesystem for status 3/4 (failed/aborted) if no file in egressInfo
    if ((status === 3 || status === 4) && !egressInfo.file?.filepath && !response.filename) {
      const recordingsDir = join(process.cwd(), 'recordings');
      let fileFound = false;
      let foundFilename = '';
      
      try {
        if (existsSync(recordingsDir)) {
          const files = await readdir(recordingsDir);
          const roomNamePattern = egressInfo.roomName || actualLiveKitRoomName;
          const matchingFile = files.find(file => 
            file.endsWith('.mp4') && 
            (file.includes(roomNamePattern) || file.includes(egressInfo.egressId))
          );
          
          if (matchingFile) {
            fileFound = true;
            foundFilename = matchingFile;
          }
        }
      } catch (fsError) {
        console.warn('Error checking filesystem for failed recording:', fsError);
      }
      
      if (fileFound) {
        // File exists! Treat as completed (partial recording)
        response.filename = foundFilename;
        response.downloadUrl = `/api/record/file?egressId=${encodeURIComponent(egressInfo.egressId)}`;
        response.partialRecording = true;
        response.status = 2;
        status = 2;
        // Clear error since file exists
        response.error = undefined;
        response.hasNoSignalError = false;
        response.suggestion = undefined;
        console.log(`[Status Check] File found on disk for failed egress ${egressInfo.egressId}: ${foundFilename}`);
      }
    }

    // Add stream info if available
    if (egressInfo.stream) {
      response.streamUrl = egressInfo.stream.url;
    }

    return new NextResponse(JSON.stringify(response), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Status check error:', error);
    
    let errorMessage = 'Failed to check recording status';
    let details = 'Unknown error';

    if (error instanceof Error) {
      errorMessage = error.message;
      details = error.stack || 'Unknown error';

      // Check for specific error types
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('connect')) {
        errorMessage = 'Unable to connect to recording service';
        details = 'The LiveKit egress service may not be running or accessible.';
      } else if (errorMessage.includes('timeout')) {
        errorMessage = 'Request timeout';
        details = 'The recording service did not respond in time.';
      }
    }

    return new NextResponse(JSON.stringify({ 
      error: errorMessage,
      details: details,
      status: 0 // idle/unknown
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

