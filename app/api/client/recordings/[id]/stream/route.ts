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

    // If file not found locally and not in R2, try to fetch from LiveKit server via SSH
    if ((!localFilePath || !existsSync(localFilePath)) && recording.room.hostLink && recording.egressId) {
      try {
        // Determine which LiveKit server has this room
        const livekitRouting = getLiveKitServerForRoom(recording.room.hostLink);
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
          
          // Find file by egressId or room name
          const findFileCmd = `ssh -o StrictHostKeyChecking=no root@${serverIp} "docker exec ${containerName} find /recordings -name '*.mp4' | grep -E '(${recording.egressId}|${recording.egressId.replace('EG_', '')}|${recording.room.hostLink})' | head -1"`;
          
          console.log(`[Stream Recording] Searching for file on ${serverIp}...`);
          const { stdout: filePath } = await execAsync(findFileCmd);
          const remoteFilePath = filePath.trim();
          
          if (remoteFilePath) {
            console.log(`[Stream Recording] ✅ Found file on server: ${remoteFilePath}`);
            
            // Copy file from LiveKit server to backend server temporarily
            const recordingsDir = join(process.cwd(), 'recordings');
            const { mkdir } = await import('fs/promises');
            await mkdir(recordingsDir, { recursive: true });
            
            const tempFilename = `${recording.egressId}.mp4`;
            const localTempPath = join(recordingsDir, tempFilename);
            const copyCmd = `ssh -o StrictHostKeyChecking=no root@${serverIp} "docker cp ${containerName}:${remoteFilePath} -" > "${localTempPath}"`;
            
            console.log(`[Stream Recording] Copying file from server...`);
            await execAsync(copyCmd);
            
            if (existsSync(localTempPath)) {
              const fileStat = await stat(localTempPath);
              const fileSize = fileStat.size;
              const range = request.headers.get('range');
              
              if (range) {
                const parts = range.replace(/bytes=/, '').split('-');
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                const chunkSize = (end - start) + 1;
                
                const fileStream = createReadStream(localTempPath, { start, end });
                
                return new NextResponse(fileStream as any, {
                  status: 206,
                  headers: {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunkSize.toString(),
                    'Content-Type': 'video/mp4',
                  },
                });
              } else {
                const fileStream = createReadStream(localTempPath);
                
                return new NextResponse(fileStream as any, {
                  headers: {
                    'Content-Type': 'video/mp4',
                    'Content-Length': fileSize.toString(),
                    'Accept-Ranges': 'bytes',
                  },
                });
              }
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
