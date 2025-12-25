import { EgressClient } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { sanitizeRoomIdentifier } from '@/lib/utils/sanitize';
import { uploadRecordingToR2 } from '@/lib/services/recordingStorage';
import { join } from 'path';
import { stat, readdir } from 'fs/promises';
import { existsSync } from 'fs';

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

    if (!roomNameParam) {
      return new NextResponse('Missing roomName parameter', { status: 400 });
    }

    // Sanitize room name to prevent injection
    const roomName = sanitizeRoomIdentifier(roomNameParam);
    if (!roomName || roomName !== roomNameParam) {
      return new NextResponse('Invalid room name format', { status: 400 });
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
      return new NextResponse('Room not found or inactive', { status: 404 });
    }

    // Check if client account is active
    if (!room.client.account || room.client.account.status !== 'ACTIVE') {
      return new NextResponse('Room access denied', { status: 403 });
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
    // The recording was started on a specific server, we must stop it on the same server
    const livekitRouting = getLiveKitServerForRoom(actualLiveKitRoomName);
    const serverUrl = livekitRouting.serverUrl;
    
    console.log(`[Recording Stop] Server routing: ${actualLiveKitRoomName} -> ${serverUrl}`);
    
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
    const activeEgresses = (await egressClient.listEgress({ roomName: actualLiveKitRoomName })).filter(
      (info) => info.status < 2,
    );
    if (activeEgresses.length === 0) {
      return new NextResponse(JSON.stringify({ 
        error: 'No active recording found',
        message: 'No active recording found for this room'
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const stoppedEgresses = await Promise.all(
      activeEgresses.map(async (info) => {
        try {
          await egressClient.stopEgress(info.egressId);
          
          // Wait a bit for the file to be finalized (egress needs time to write the file)
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Get updated egress info after stopping - use listEgress and filter
          const updatedEgresses = await egressClient.listEgress({ roomName: actualLiveKitRoomName });
          const updatedInfo = updatedEgresses.find((e: any) => e.egressId === info.egressId) || info;
          
          // Get startedAt from egress info FIRST (before file search) to use for timestamp matching
          let startedAt = new Date();
          if (updatedInfo.startedAt) {
            if (typeof updatedInfo.startedAt === 'number') {
              startedAt = new Date(updatedInfo.startedAt);
            } else if (updatedInfo.startedAt instanceof Date) {
              startedAt = updatedInfo.startedAt;
            } else if (typeof updatedInfo.startedAt.getTime === 'function') {
              startedAt = updatedInfo.startedAt;
            } else if (typeof updatedInfo.startedAt === 'string') {
              startedAt = new Date(updatedInfo.startedAt);
            }
          } else if (updatedInfo.createdAt) {
            if (typeof updatedInfo.createdAt === 'number') {
              startedAt = new Date(updatedInfo.createdAt);
            } else if (updatedInfo.createdAt instanceof Date) {
              startedAt = updatedInfo.createdAt;
            } else if (typeof updatedInfo.createdAt.getTime === 'function') {
              startedAt = updatedInfo.createdAt;
            } else if (typeof updatedInfo.createdAt === 'string') {
              startedAt = new Date(updatedInfo.createdAt);
            }
          }
          
          const recordingStartTime = startedAt.getTime();
          console.log(`[Recording Stop] Recording started at: ${startedAt.toISOString()} (egressId: ${info.egressId})`);
          
          // Get filename from egress info - check both file.filepath and files array
          let filename = updatedInfo.file?.filepath || info.file?.filepath || '';
          
          // If not in file.filepath, check files array (newer egress format)
          if (!filename && updatedInfo.files && updatedInfo.files.length > 0) {
            filename = updatedInfo.files[0].filename || updatedInfo.files[0].location || '';
          }
          if (!filename && info.files && info.files.length > 0) {
            filename = info.files[0].filename || info.files[0].location || '';
          }
          
          console.log(`[Recording Stop] Egress file info - filepath: ${info.file?.filepath || 'N/A'}, files array: ${info.files?.length || 0} files, extracted filename: ${filename || 'N/A'}`);
          
          // If no filename from egress info, try to find it in the filesystem using timestamp matching
          if (!filename || filename === 'recording.mp4') {
            console.log(`[Recording Stop] No filename from egress info, searching filesystem for egressId: ${info.egressId}`);
            const recordingsDir = join(process.cwd(), 'recordings');
            try {
              if (existsSync(recordingsDir)) {
                const files = await readdir(recordingsDir);
                
                // First, try to match by egressId (most specific)
                let matchingFile = files.find(file => 
                  file.endsWith('.mp4') && file.includes(info.egressId)
                );
                
                if (matchingFile) {
                  filename = matchingFile;
                  console.log(`[Recording Stop] ✅ Found file by egressId: ${filename}`);
                } else {
                  // Match by room name + timestamp (find file created closest to recording start time)
                  const roomFiles = files
                    .filter(file => 
                      file.endsWith('.mp4') && file.includes(actualLiveKitRoomName)
                    )
                    .map(file => {
                      // Extract timestamp from filename (format: YYYY-MM-DDTHH-MM-SS-milliseconds-roomName.mp4)
                      // Example: 2025-12-22T23-52-36-543Z-9h3t0u5.mp4
                      const timestampMatch = file.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d+)/);
                      let fileTime = 0;
                      
                      if (timestampMatch) {
                        try {
                          const timestampStr = timestampMatch[1];
                          // Convert to ISO format: 2025-12-22T23-52-36-543 -> 2025-12-22T23:20:36.543Z
                          const isoStr = timestampStr.replace(/(\d{4}-\d{2}-\d{2}T)(\d{2})-(\d{2})-(\d{2})-(\d+)/, 
                            (_, date, hour, min, sec, ms) => {
                              const msFormatted = ms.length === 3 ? ms : ms.padStart(3, '0').slice(0, 3);
                              return `${date}${hour}:${min}:${sec}.${msFormatted}Z`;
                            });
                          fileTime = new Date(isoStr).getTime();
                        } catch (e) {
                          // If parsing fails, try simpler format
                          try {
                            const simpleMatch = file.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
                            if (simpleMatch) {
                              const simpleStr = simpleMatch[1].replace(/(\d{4}-\d{2}-\d{2}T)(\d{2})-(\d{2})-(\d{2})/, 
                                '$1$2:$3:$4');
                              fileTime = new Date(simpleStr).getTime();
                            }
                          } catch (e2) {
                            // If all parsing fails, fileTime remains 0
                          }
                        }
                      }
                      
                      return { 
                        file, 
                        time: fileTime, 
                        diff: fileTime > 0 ? Math.abs(fileTime - recordingStartTime) : Infinity 
                      };
                    })
                    .filter(f => f.diff !== Infinity) // Only files with valid timestamps
                    .sort((a, b) => a.diff - b.diff); // Sort by time difference (closest first)
                  
                  if (roomFiles.length > 0) {
                    matchingFile = roomFiles[0].file;
                    const diffSeconds = Math.round(roomFiles[0].diff / 1000);
                    filename = matchingFile;
                    console.log(`[Recording Stop] ✅ Found file by timestamp (diff: ${diffSeconds}s): ${filename}`);
                  } else {
                    // Last resort: use file modification time
                    console.log(`[Recording Stop] ⚠️ No timestamp match, trying file modification time...`);
                    const roomFilesByMtime = await Promise.all(
                      files
                        .filter(file => 
                          file.endsWith('.mp4') && file.includes(actualLiveKitRoomName)
                        )
                        .map(async (file) => {
                          try {
                            const filePath = join(recordingsDir, file);
                            const fileStat = await stat(filePath);
                            const fileTime = fileStat.mtime.getTime();
                            const diff = Math.abs(fileTime - recordingStartTime);
                            return { file, time: fileTime, diff };
                          } catch {
                            return { file, time: 0, diff: Infinity };
                          }
                        })
                    );
                    
                    const sortedByMtime = roomFilesByMtime
                      .filter(f => f.diff !== Infinity)
                      .sort((a, b) => a.diff - b.diff);
                    
                    if (sortedByMtime.length > 0) {
                      matchingFile = sortedByMtime[0].file;
                      const diffSeconds = Math.round(sortedByMtime[0].diff / 1000);
                      filename = matchingFile;
                      console.log(`[Recording Stop] ✅ Found file by modification time (diff: ${diffSeconds}s): ${filename}`);
                    } else {
                      console.warn(`[Recording Stop] ⚠️ Could not find file for egressId ${info.egressId}, using default`);
                      filename = 'recording.mp4';
                    }
                  }
                }
              }
            } catch (fsError) {
              console.error(`[Recording Stop] Error searching filesystem:`, fsError);
              filename = filename || 'recording.mp4';
            }
          }
          
          // Extract filename from path (remove /recordings/ prefix if present)
          const baseFilename = filename.split('/').pop() || filename;
          
          // Generate human-readable name: room name + date
          const date = new Date();
          const dateStr = new Intl.DateTimeFormat('ar-SA', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }).format(date);
          const originalName = `${room.name} - ${dateStr}`;
          
          // Get file size if file exists locally
          let fileSize: number | null = null;
          const localFilePath = join(process.cwd(), 'recordings', baseFilename);
          try {
            const fileStat = await stat(localFilePath);
            fileSize = fileStat.size;
            console.log(`[Recording Stop] Found file: ${baseFilename}, size: ${fileSize} bytes`);
          } catch {
            // File might not exist yet or might be in different location
            console.log(`[Recording Stop] File not found locally yet: ${localFilePath}`);
          }
          
          // startedAt was already extracted above for file matching
          
          // Save recording to database
          let recording;
          let isUpdate = false;
          
          // Check if recording with same egressId already exists (prevent duplicates)
          const existingRecording = await prisma.recording.findUnique({
            where: { egressId: info.egressId },
          });
          
          if (existingRecording) {
            console.log(`[Recording Stop] Recording with egressId ${info.egressId} already exists (ID: ${existingRecording.id}), updating instead of creating duplicate`);
            isUpdate = true;
            
            // Update existing record with latest information
            // Only update if we have better/newer information
            const updateData: any = {
              status: 'COMPLETED',
              endedAt: new Date(),
            };
            
            // Update filename if we have a better one (not "recording.mp4")
            if (baseFilename && baseFilename !== 'recording.mp4' && baseFilename !== existingRecording.filename) {
              updateData.filename = baseFilename;
              updateData.storagePath = localFilePath;
              console.log(`[Recording Stop] Updating filename from "${existingRecording.filename}" to "${baseFilename}"`);
            }
            
            // Update file size if we have it and it's different
            if (fileSize !== null && fileSize !== existingRecording.fileSize) {
              updateData.fileSize = fileSize;
              console.log(`[Recording Stop] Updating fileSize from ${existingRecording.fileSize} to ${fileSize}`);
            }
            
            // Update originalName if missing or generic
            if (!existingRecording.originalName || existingRecording.originalName === 'Recording') {
              updateData.originalName = originalName;
            }
            
            try {
              recording = await prisma.recording.update({
                where: { egressId: info.egressId },
                data: updateData,
              });
              
              console.log(`[Recording Stop] ✅ Successfully updated existing recording in database:`, {
                recordingId: recording.id,
                roomId: room.id,
                clientId: room.clientId,
                egressId: info.egressId,
                filename: recording.filename,
                updatedFields: Object.keys(updateData),
              });
            } catch (updateError: any) {
              console.error(`[Recording Stop] ❌ Failed to update existing recording:`, updateError);
              // Fall back to using existing recording
              recording = existingRecording;
              console.log(`[Recording Stop] Using existing recording without updates: ${recording.id}`);
            }
          } else {
            // No existing recording, create new one
            try {
              console.log(`[Recording Stop] Attempting to create new recording:`, {
                roomId: room.id,
                clientId: room.clientId,
                egressId: info.egressId,
                filename: baseFilename,
              });
              
              recording = await prisma.recording.create({
                data: {
                  roomId: room.id,
                  egressId: info.egressId,
                  filename: baseFilename,
                  originalName: originalName,
                  fileSize: fileSize,
                  status: 'COMPLETED', // Will be updated when R2 upload completes
                  storageType: 'LOCAL',
                  storagePath: localFilePath,
                  startedAt: startedAt,
                  endedAt: new Date(),
                }
              });
              
              console.log(`[Recording Stop] ✅ Successfully created new recording in database:`, {
                recordingId: recording.id,
                roomId: room.id,
                clientId: room.clientId,
                egressId: info.egressId,
                filename: baseFilename,
                fileSize: fileSize,
              });
            } catch (dbError: any) {
              console.error(`[Recording Stop] ❌ Failed to create recording in database:`, dbError);
              console.error(`[Recording Stop] Error details:`, {
                message: dbError.message,
                code: dbError.code,
                meta: dbError.meta,
              });
              
              // Check if it's a unique constraint violation (duplicate egressId)
              // This shouldn't happen if we checked above, but handle it just in case
              if (dbError.code === 'P2002' || (dbError instanceof Error && dbError.message.includes('Unique constraint'))) {
                console.warn(`[Recording Stop] ⚠️ Unique constraint violation despite pre-check, fetching existing record`);
                recording = await prisma.recording.findUnique({
                  where: { egressId: info.egressId },
                });
                if (recording) {
                  console.log(`[Recording Stop] Found existing recording: ${recording.id}`);
                  isUpdate = true;
                }
              } else {
                // Re-throw if it's not a duplicate error
                throw dbError;
              }
            }
          }
          
          // CRITICAL: Ensure recording was saved before proceeding
          if (!recording) {
            console.error(`[Recording Stop] ❌ CRITICAL: Failed to save recording record for egressId: ${info.egressId}`);
            throw new Error(`Failed to save recording to database for egressId: ${info.egressId}`);
          }

          console.log(`[Recording Stop] ✅ Recording ${isUpdate ? 'updated' : 'saved'} successfully: ${recording.id} for room ${room.id} (clientId: ${room.clientId})`, {
            action: isUpdate ? 'UPDATE' : 'CREATE',
            recordingId: recording.id,
            egressId: info.egressId,
            filename: recording.filename,
            fileSize: recording.fileSize,
          });

          // Trigger background R2 upload (non-blocking)
          // First fetch file from LiveKit server if not found locally, then upload to R2
          (async () => {
            try {
              let filePathForR2 = localFilePath;
              
              // If file doesn't exist locally, fetch it from LiveKit server first
              if (!existsSync(localFilePath)) {
                console.log(`[Recording Stop] File not found locally, fetching from LiveKit server for R2 upload...`);
                
                try {
                  // Determine which LiveKit server has this room
                  const livekitRouting = getLiveKitServerForRoom(room.hostLink);
                  const serverUrl = livekitRouting.serverUrl;
                  
                  // Extract server IP from URL
                  const serverMatch = serverUrl.match(/http:\/\/([\d.]+):/);
                  if (serverMatch) {
                    const serverIp = serverMatch[1];
                    const isServer1 = serverIp === '178.128.78.195';
                    const containerName = isServer1 ? 'livekit-egress-server1' : 'livekit-egress-server2';
                    
                    // Find the file on the egress server
                    const { exec } = await import('child_process');
                    const { promisify } = await import('util');
                    const execAsync = promisify(exec);
                    
                    const findFileCmd = `ssh -o StrictHostKeyChecking=no root@${serverIp} "docker exec ${containerName} find /recordings -name '*.mp4' | grep -E '(${baseFilename.replace(/[^a-zA-Z0-9]/g, '.*')}|${room.hostLink})' | head -1"`;
                    const { stdout: remoteFilePath } = await execAsync(findFileCmd);
                    const foundPath = remoteFilePath.trim();
                    
                    if (foundPath) {
                      // Ensure recordings directory exists
                      const recordingsDir = join(process.cwd(), 'recordings');
                      const { mkdir } = await import('fs/promises');
                      await mkdir(recordingsDir, { recursive: true });
                      
                      // Copy file from LiveKit server to backend server
                      const copyCmd = `ssh -o StrictHostKeyChecking=no root@${serverIp} "docker cp ${containerName}:${foundPath} -" > "${localFilePath}"`;
                      await execAsync(copyCmd);
                      
                      if (existsSync(localFilePath)) {
                        filePathForR2 = localFilePath;
                        console.log(`[Recording Stop] ✅ Successfully fetched file from LiveKit server for R2 upload`);
                      }
                    }
                  }
                } catch (fetchError) {
                  console.error(`[Recording Stop] Error fetching file from LiveKit server:`, fetchError);
                  // Continue anyway - might upload later or use local if available
                }
              }
              
              // Now upload to R2 if file exists
              if (existsSync(filePathForR2)) {
                await uploadRecordingToR2(
                  recording.id,
                  filePathForR2,
                  room.clientId,
                  room.id,
                  baseFilename
                );
              } else {
                console.warn(`[Recording Stop] Cannot upload to R2: file not found at ${filePathForR2}`);
              }
            } catch (uploadError) {
              console.error(`[Recording Stop] Background R2 upload failed for ${recording.id}:`, uploadError);
              // Don't throw - recording is still available from local storage
            }
          })();

          return {
            egressId: info.egressId,
            recordingId: recording.id,
            filename: filename,
            status: 'stopped',
            message: 'Recording saved to your account. You can find it in your recordings page.'
          };
        } catch (stopError) {
          console.error('Error stopping egress:', stopError);
          return {
            egressId: info.egressId,
            filename: info.file?.filepath || 'unknown.mp4',
            status: 'error',
            error: stopError instanceof Error ? stopError.message : 'Failed to stop recording'
          };
        }
      })
    );

    // Return the first stopped recording (most common case)
    const primaryRecording = stoppedEgresses[0];

    return new NextResponse(JSON.stringify({ 
      recordings: stoppedEgresses,
      egressId: primaryRecording.egressId,
      recordingId: primaryRecording.recordingId,
      filename: primaryRecording.filename,
      message: 'Recording saved to your account. You can find it in your recordings page.'
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Stop recording error:', error);
    
    let errorMessage = 'Failed to stop recording';
    let details = 'Unknown error occurred';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      details = error.stack || 'Unknown error';
      
      // Check for specific error types
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('connect')) {
        errorMessage = 'Unable to connect to recording service';
        details = 'The LiveKit egress service may not be running or accessible.';
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
