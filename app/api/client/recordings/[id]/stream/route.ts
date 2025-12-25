import { NextRequest, NextResponse } from 'next/server';
import { requireClient } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { getRecordingFile } from '@/lib/services/recordingStorage';
import { join } from 'path';
import { existsSync, createReadStream } from 'fs';
import { stat } from 'fs/promises';

// Consistent hashing for LiveKit server routing
function getLiveKitServerForRoom(roomName: string): { 
  clientUrl: string; 
  serverUrl: string;
} {
  const livekit1Client = process.env.LIVEKIT_1_CLIENT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://rtc.acadmyq.com';
  const livekit1Server = process.env.LIVEKIT_1_SERVER_URL || process.env.LIVEKIT_URL || 'http://178.128.78.195:7880';
  
  const livekit2Client = process.env.LIVEKIT_2_CLIENT_URL;
  const livekit2Server = process.env.LIVEKIT_2_SERVER_URL;
  
  if (!livekit2Client || !livekit2Server) {
    return { 
      clientUrl: livekit1Client, 
      serverUrl: livekit1Server 
    };
  }
  
  let hash = 0;
  for (let i = 0; i < roomName.length; i++) {
    hash = ((hash << 5) - hash) + roomName.charCodeAt(i);
    hash = hash & hash;
  }
  
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

/**
 * GET /api/client/recordings/[id]/stream
 * Stream recording file for video playback
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireClient();

    if (!session.clientId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { id } = await params;

    const recording = await prisma.recording.findFirst({
      where: {
        id,
        room: {
          clientId: session.clientId,
        },
      },
      include: {
        room: {
          select: {
            hostLink: true,
          },
        },
      },
    });

    if (!recording) {
      return new NextResponse('Recording not found', { status: 404 });
    }

    // Try R2 first if storageType is R2
    if (recording.storageType === 'R2' && recording.storagePath) {
      try {
        const fileBuffer = await getRecordingFile(
          recording.storageType,
          recording.storagePath,
          '' // No local file path needed for R2
        );
        
        if (fileBuffer) {
          const fileSize = fileBuffer.length;
          const range = request.headers.get('range');
          
          if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunkSize = (end - start) + 1;
            const chunk = fileBuffer.slice(start, end + 1);
            
            return new NextResponse(chunk, {
              status: 206,
              headers: {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize.toString(),
                'Content-Type': 'video/mp4',
              },
            });
          } else {
            return new NextResponse(fileBuffer, {
              headers: {
                'Content-Type': 'video/mp4',
                'Content-Length': fileSize.toString(),
                'Accept-Ranges': 'bytes',
              },
            });
          }
        }
      } catch (r2Error) {
        console.error(`[Stream Recording] R2 error:`, r2Error);
        // Fall through to try local/LiveKit server
      }
    }

    // Try local file
    let localFilePath: string | null = null;
    if (recording.storageType === 'LOCAL' && recording.storagePath && existsSync(recording.storagePath)) {
      localFilePath = recording.storagePath;
    } else if (recording.filename && recording.filename !== 'N/A' && recording.filename !== 'recording.mp4') {
      localFilePath = join(process.cwd(), 'recordings', recording.filename);
    }
    
    // If file doesn't exist, try to find it by egressId
    if ((!localFilePath || !existsSync(localFilePath)) && recording.egressId) {
      try {
        const { readdir } = await import('fs/promises');
        const recordingsDir = join(process.cwd(), 'recordings');
        if (existsSync(recordingsDir)) {
          const files = await readdir(recordingsDir);
          const matchingFile = files.find(f => 
            f.endsWith('.mp4') && 
            (f.includes(recording.egressId) || f.includes(recording.egressId.replace('EG_', '')))
          );
          
          if (matchingFile) {
            localFilePath = join(recordingsDir, matchingFile);
          }
        }
      } catch (e) {
        console.error(`[Stream Recording] Error searching for file: ${e}`);
      }
    }

    // Stream file if it exists locally
    if (localFilePath && existsSync(localFilePath)) {
      const fileStat = await stat(localFilePath);
      const fileSize = fileStat.size;
      
      // Get range header for partial content support (video seeking)
      const range = request.headers.get('range');
      
      if (range) {
        // Parse range header
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;
        
        const fileStream = createReadStream(localFilePath, { start, end });
        
        return new NextResponse(fileStream as any, {
          status: 206, // Partial Content
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize.toString(),
            'Content-Type': 'video/mp4',
          },
        });
      } else {
        // Full file stream
        const fileStream = createReadStream(localFilePath);
        
        return new NextResponse(fileStream as any, {
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': fileSize.toString(),
            'Accept-Ranges': 'bytes',
          },
        });
      }
    }

    // If file not found locally and not in R2, try to fetch from LiveKit server using EgressClient
    if ((!localFilePath || !existsSync(localFilePath)) && recording.room.hostLink && recording.egressId) {
      try {
        const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
        
        if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
          throw new Error('LiveKit credentials not configured');
        }
        
        // Determine which LiveKit server has this room
        const livekitRouting = getLiveKitServerForRoom(recording.room.hostLink);
        const serverUrl = livekitRouting.serverUrl;
        const hostURL = new URL(serverUrl);
        
        // Use EgressClient to get egress info
        const { EgressClient } = await import('livekit-server-sdk');
        const egressClient = new EgressClient(hostURL.origin, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
        
        // Get egress info to find the file
        const egresses = await egressClient.listEgress({ roomName: recording.room.hostLink });
        const egressInfo = egresses.find(e => e.egressId === recording.egressId);
        
        if (egressInfo) {
          // Update database with correct filename if we have it
          if (egressInfo.file?.filepath && (!recording.filename || recording.filename === 'N/A')) {
            const baseFilename = egressInfo.file.filepath.split('/').pop() || `${recording.egressId}.mp4`;
            try {
              await prisma.recording.update({
                where: { id: recording.id },
                data: { filename: baseFilename },
              });
              console.log(`[Stream Recording] ✅ Updated database with filename: ${baseFilename}`);
            } catch (updateError) {
              console.warn(`[Stream Recording] Failed to update filename:`, updateError);
            }
          }
          
          // Use the /api/record/file endpoint which handles file access
          if (egressInfo.file?.filepath) {
            const fileUrl = `/api/record/file?egressId=${encodeURIComponent(recording.egressId)}&roomName=${encodeURIComponent(recording.room.hostLink)}`;
            
            // Fetch from our own file endpoint (which proxies from LiveKit server)
            try {
              const range = request.headers.get('range');
              const fileResponse = await fetch(`http://localhost:3000${fileUrl}`, {
                headers: {
                  'Authorization': request.headers.get('authorization') || '',
                  ...(range ? { 'Range': range } : {}),
                },
              });
              
              if (fileResponse.ok) {
                const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());
                const contentLength = fileResponse.headers.get('content-length') || fileBuffer.length.toString();
                const contentRange = fileResponse.headers.get('content-range');
                const status = fileResponse.status;
                
                console.log(`[Stream Recording] ✅ Successfully fetched file via file endpoint (${fileBuffer.length} bytes)`);
                
                // Handle range requests for video seeking
                if (range && status === 206) {
                  const parts = range.replace(/bytes=/, '').split('-');
                  const start = parseInt(parts[0], 10);
                  const end = parts[1] ? parseInt(parts[1], 10) : fileBuffer.length - 1;
                  const chunk = fileBuffer.slice(start, end + 1);
                  
                  return new NextResponse(chunk, {
                    status: 206,
                    headers: {
                      'Content-Range': contentRange || `bytes ${start}-${end}/${fileBuffer.length}`,
                      'Accept-Ranges': 'bytes',
                      'Content-Length': chunk.length.toString(),
                      'Content-Type': 'video/mp4',
                    },
                  });
                } else {
                  return new NextResponse(fileBuffer, {
                    status: status === 206 ? 206 : 200,
                    headers: {
                      'Content-Type': 'video/mp4',
                      'Content-Length': contentLength,
                      'Accept-Ranges': 'bytes',
                      ...(contentRange ? { 'Content-Range': contentRange } : {}),
                    },
                  });
                }
              } else {
                console.warn(`[Stream Recording] File endpoint returned ${fileResponse.status}`);
              }
            } catch (fetchError) {
              console.error(`[Stream Recording] Error fetching via file endpoint:`, fetchError);
            }
          }
        }
      } catch (serverError) {
        console.error(`[Stream Recording] Error fetching from LiveKit server:`, serverError);
      }
    }

    return new NextResponse('Recording file not found', { status: 404 });
  } catch (error) {
    console.error('Stream recording error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
