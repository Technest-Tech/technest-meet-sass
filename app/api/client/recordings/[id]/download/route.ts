import { NextRequest, NextResponse } from 'next/server';
import { requireClient } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { getRecordingFile } from '@/lib/services/recordingStorage';
import { join } from 'path';
import { existsSync } from 'fs';

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
 * GET /api/client/recordings/[id]/download
 * Download recording file
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

    // Try local file first (if synced to backend)
    let localFilePath: string;
    if (recording.storageType === 'LOCAL' && recording.storagePath && existsSync(recording.storagePath)) {
      localFilePath = recording.storagePath;
      console.log(`[Download Recording] ✅ Using storagePath: ${localFilePath}`);
    } else {
      localFilePath = join(process.cwd(), 'recordings', recording.filename);
      console.log(`[Download Recording] 📁 Constructed file path: ${localFilePath}`);
    }
    
    // If file doesn't exist locally, try to find it by egressId (fallback)
    if (!existsSync(localFilePath) && recording.egressId) {
      console.log(`[Download Recording] 🔍 File not found at ${localFilePath}, searching by egressId: ${recording.egressId}`);
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
            console.log(`[Download Recording] ✅ Found file by egressId: ${matchingFile}`);
          }
        }
      } catch (e) {
        console.error(`[Download Recording] Error searching for file: ${e}`);
      }
    }

    // Try to get file from local storage first
    if (existsSync(localFilePath)) {
      const fileBuffer = await getRecordingFile(
        recording.storageType,
        recording.storagePath,
        localFilePath
      );

      if (fileBuffer) {
        const downloadFilename = recording.originalName || recording.filename;
        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Disposition': `attachment; filename="${downloadFilename}"`,
            'Content-Length': fileBuffer.length.toString(),
          },
        });
      }
    }

    // If file not found locally, try to fetch from LiveKit server via SSH
    if (recording.room.hostLink && recording.filename) {
      console.log(`[Download Recording] 🔄 File not found locally, attempting to fetch from LiveKit server...`);
      
      try {
        // Determine which LiveKit server has this room
        const livekitRouting = getLiveKitServerForRoom(recording.room.hostLink);
        const serverUrl = livekitRouting.serverUrl;
        
        // Extract server IP from URL
        const serverMatch = serverUrl.match(/http:\/\/([\d.]+):/);
        if (!serverMatch) {
          throw new Error('Could not determine LiveKit server IP');
        }
        const serverIp = serverMatch[1];
        
        // Determine which server (1 or 2) based on IP
        const isServer1 = serverIp === '178.128.78.195';
        const containerName = isServer1 ? 'livekit-egress-server1' : 'livekit-egress-server2';
        
        // Try to find the file on the LiveKit server
        // First, try to match by filename, then by room name
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        
        // Find the file on the egress server
        const findFileCmd = `ssh -o StrictHostKeyChecking=no root@${serverIp} "docker exec ${containerName} find /recordings -name '*.mp4' | grep -E '(${recording.filename.replace(/[^a-zA-Z0-9]/g, '.*')}|${recording.room.hostLink})' | head -1"`;
        
        console.log(`[Download Recording] Searching for file on ${serverIp}...`);
        const { stdout: filePath } = await execAsync(findFileCmd);
        const remoteFilePath = filePath.trim();
        
        if (remoteFilePath) {
          console.log(`[Download Recording] ✅ Found file on server: ${remoteFilePath}`);
          
          // Copy file from LiveKit server to backend server
          const recordingsDir = join(process.cwd(), 'recordings');
          const { mkdir } = await import('fs/promises');
          await mkdir(recordingsDir, { recursive: true });
          
          const localTempPath = join(recordingsDir, recording.filename);
          const copyCmd = `ssh -o StrictHostKeyChecking=no root@${serverIp} "docker cp ${containerName}:${remoteFilePath} -" > "${localTempPath}"`;
          
          console.log(`[Download Recording] Copying file from server...`);
          await execAsync(copyCmd);
          
          if (existsSync(localTempPath)) {
            const fileBuffer = await getRecordingFile('LOCAL', localTempPath, localTempPath);
            const downloadFilename = recording.originalName || recording.filename;
            
            console.log(`[Download Recording] ✅ Successfully fetched file (${fileBuffer.length} bytes)`);
            
            return new NextResponse(fileBuffer, {
              headers: {
                'Content-Type': 'video/mp4',
                'Content-Disposition': `attachment; filename="${downloadFilename}"`,
                'Content-Length': fileBuffer.length.toString(),
              },
            });
          }
        } else {
          console.warn(`[Download Recording] File not found on LiveKit server: ${serverIp}`);
        }
      } catch (serverError) {
        console.error(`[Download Recording] Error fetching from LiveKit server:`, serverError);
        // Fall through to return 404
      }
    }

    return new NextResponse('Recording file not found', { status: 404 });
  } catch (error) {
    console.error('Download recording error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

