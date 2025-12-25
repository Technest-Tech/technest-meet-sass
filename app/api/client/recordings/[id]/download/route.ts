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

    // Try to get file from storage (R2 first if available, then local)
    // This properly handles R2 storage
    const fileBuffer = await getRecordingFile(
      recording.storageType,
      recording.storagePath,
      recording.storageType === 'LOCAL' && recording.storagePath && existsSync(recording.storagePath)
        ? recording.storagePath
        : recording.filename && recording.filename !== 'N/A'
          ? join(process.cwd(), 'recordings', recording.filename)
          : ''
    );

    if (fileBuffer) {
      const downloadFilename = recording.originalName || recording.filename || 'recording.mp4';
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Disposition': `attachment; filename="${downloadFilename}"`,
          'Content-Length': fileBuffer.length.toString(),
        },
      });
    }

    // If R2/local not available, try local file path construction
    let localFilePath: string | null = null;
    if (recording.storageType === 'LOCAL' && recording.storagePath && existsSync(recording.storagePath)) {
      localFilePath = recording.storagePath;
      console.log(`[Download Recording] ✅ Using storagePath: ${localFilePath}`);
    } else if (recording.filename && recording.filename !== 'N/A' && recording.filename !== 'recording.mp4') {
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

    // Try to get file from storage (R2 first if available, then local)
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

    // If file not found locally and not in R2, try to fetch from LiveKit server using EgressClient
    if (recording.room.hostLink && recording.egressId) {
      console.log(`[Download Recording] 🔄 File not found locally, attempting to fetch from LiveKit server via EgressClient...`);
      
      try {
        const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
        
        if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
          throw new Error('LiveKit credentials not configured');
        }
        
        // Determine which LiveKit server has this room
        const livekitRouting = getLiveKitServerForRoom(recording.room.hostLink);
        const serverUrl = livekitRouting.serverUrl;
        const hostURL = new URL(serverUrl);
        
        // Use EgressClient to get egress info and file path
        const { EgressClient } = await import('livekit-server-sdk');
        const egressClient = new EgressClient(hostURL.origin, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
        
        // Get egress info to find the file
        const egresses = await egressClient.listEgress({ roomName: recording.room.hostLink });
        const egressInfo = egresses.find(e => e.egressId === recording.egressId);
        
        if (egressInfo && egressInfo.file?.filepath) {
          const remoteFilePath = egressInfo.file.filepath;
          const baseFilename = remoteFilePath.split('/').pop() || `${recording.egressId}.mp4`;
          
          console.log(`[Download Recording] ✅ Found file path from egress info: ${remoteFilePath}`);
          
          // Try to fetch file via HTTP from LiveKit server
          // The file is on the LiveKit server, we need to access it
          // Since we can't SSH from container, we'll need to use a different method
          // For now, return error with instructions to sync the file
          console.warn(`[Download Recording] File exists on LiveKit server but cannot be accessed directly. File path: ${remoteFilePath}`);
          console.warn(`[Download Recording] Please sync the file from LiveKit server to backend server or upload to R2.`);
          
          // Try to use the egress download endpoint (might not work, but worth trying)
          try {
            const fileUrl = `${hostURL.origin}/egress/${recording.egressId}/download`;
            const fileResponse = await fetch(fileUrl, {
              headers: {
                'Authorization': `Basic ${Buffer.from(`${LIVEKIT_API_KEY}:${LIVEKIT_API_SECRET}`).toString('base64')}`,
              },
            });
            
            if (fileResponse.ok) {
              const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());
              const downloadFilename = recording.originalName || baseFilename;
              
              console.log(`[Download Recording] ✅ Successfully fetched file via egress API (${fileBuffer.length} bytes)`);
              
              return new NextResponse(fileBuffer, {
                headers: {
                  'Content-Type': 'video/mp4',
                  'Content-Disposition': `attachment; filename="${downloadFilename}"`,
                  'Content-Length': fileBuffer.length.toString(),
                },
              });
            } else {
              console.warn(`[Download Recording] Egress download endpoint returned ${fileResponse.status}`);
            }
          } catch (fetchError) {
            console.error(`[Download Recording] Error fetching via egress API:`, fetchError);
          }
        } else {
          console.warn(`[Download Recording] Egress info not found for ${recording.egressId}`);
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

