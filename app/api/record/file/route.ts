import { EgressClient } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { prisma } from '@/lib/database';

// Consistent hashing for LiveKit server routing - same as other endpoints
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
    const egressId = req.nextUrl.searchParams.get('egressId');
    const roomNameParam = req.nextUrl.searchParams.get('roomName');

    if (!egressId) {
      return new NextResponse('Missing egressId parameter', { status: 400 });
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

    // Try to get room name from database if not provided
    let roomName = roomNameParam;
    if (!roomName) {
      // Try to find room by egressId - this is a fallback, ideally roomName should be provided
      // For now, we'll try both servers
    }

    // Determine which server to use
    // If we have roomName, use consistent hashing; otherwise try both servers
    let egressClient: EgressClient;
    let hostURL: URL;
    let egressInfo: any;

    if (roomName) {
      const livekitRouting = getLiveKitServerForRoom(roomName);
      const serverUrl = livekitRouting.serverUrl;
      hostURL = new URL(serverUrl);
      
      // Keep the original protocol - don't force HTTPS for IP addresses
      if (hostURL.protocol === 'http:' && 
          !hostURL.hostname.match(/^\d+\.\d+\.\d+\.\d+$/) && 
          !hostURL.hostname.includes('localhost') && 
          !hostURL.hostname.includes('127.0.0.1')) {
        hostURL.protocol = 'https:';
      }
      
      egressClient = new EgressClient(hostURL.origin, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
      const allEgresses = await egressClient.listEgress();
      egressInfo = allEgresses.find((e: any) => e.egressId === egressId);
    } else {
      // Try both servers if roomName not provided
      const servers = [
        { url: process.env.LIVEKIT_1_SERVER_URL || process.env.LIVEKIT_URL || 'http://178.128.78.195:7880' },
        { url: process.env.LIVEKIT_2_SERVER_URL }
      ].filter(s => s.url);

      for (const server of servers) {
        try {
          const serverURL = new URL(server.url);
          if (serverURL.protocol === 'http:' && 
              !serverURL.hostname.match(/^\d+\.\d+\.\d+\.\d+$/) && 
              !serverURL.hostname.includes('localhost') && 
              !serverURL.hostname.includes('127.0.0.1')) {
            serverURL.protocol = 'https:';
          }
          
          const client = new EgressClient(serverURL.origin, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
          const allEgresses = await client.listEgress();
          const found = allEgresses.find((e: any) => e.egressId === egressId);
          
          if (found) {
            egressInfo = found;
            egressClient = client;
            hostURL = serverURL;
            break;
          }
        } catch (err) {
          console.warn(`Error checking server ${server.url}:`, err);
        }
      }
    }

    if (!egressInfo) {
      return new NextResponse(JSON.stringify({ 
        error: 'Recording not found',
        details: `No recording found with ID: ${egressId}`
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Allow download if status is 2 (completed) or 5 with a file (aborted but has partial recording)
    if (egressInfo.status !== 2 && !(egressInfo.status === 5 && egressInfo.file?.filepath)) {
      return new NextResponse(JSON.stringify({ 
        error: 'Recording not ready',
        details: `Recording status: ${egressInfo.status}. Only completed recordings can be downloaded.`
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const filename = egressInfo.file?.filepath || 'recording.mp4';
    // Extract just the filename from the path (e.g., "2025-12-22T15-03-36-789Z-9h3t0u5.mp4" from "/recordings/2025-12-22T15-03-36-789Z-9h3t0u5.mp4")
    const baseFilename = filename.split('/').pop() || filename;

    // Try to serve from local recordings directory first (if running locally with Docker)
    const recordingsDir = join(process.cwd(), 'recordings');
    const localFilePath = join(recordingsDir, baseFilename);
    
    if (existsSync(localFilePath)) {
      try {
        const fileBuffer = await readFile(localFilePath);
        console.log(`[File Route] Serving local file: ${baseFilename} (${fileBuffer.length} bytes)`);
        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Disposition': `attachment; filename="${baseFilename}"`,
            'Content-Length': fileBuffer.length.toString(),
            'Cache-Control': 'no-cache',
          },
        });
      } catch (localError) {
        console.error('Error reading local file:', localError);
        // Check if it's a permission error
        if (localError instanceof Error && localError.message.includes('permission')) {
          return new NextResponse(JSON.stringify({
            error: 'Permission denied',
            message: 'Unable to read recording file. Please check file permissions.',
            details: localError.message,
          }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        // Fall through to try LiveKit server
      }
    }

    // If not found locally, try to fetch from LiveKit server and proxy it
    try {
      // Try to fetch the file from LiveKit server's egress endpoint
      const fileUrl = `${hostURL.origin}/egress/${egressId}/download`;
      
      // Fetch the file from LiveKit server and proxy it
      const fileResponse = await fetch(fileUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${LIVEKIT_API_KEY}:${LIVEKIT_API_SECRET}`).toString('base64')}`,
        },
      });
      
      if (!fileResponse.ok) {
        throw new Error(`LiveKit server returned ${fileResponse.status}: ${fileResponse.statusText}`);
      }
      
      // Get the file as a buffer/stream
      const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());
      
      // Return the file with proper headers
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Disposition': `attachment; filename="${baseFilename}"`,
          'Content-Length': fileBuffer.length.toString(),
        },
      });

    } catch (fileError) {
      console.error('File access error:', fileError);
      
      // Provide better error messages based on error type
      let errorMessage = 'Could not access recording file';
      let errorDetails = 'Unknown error';
      
      if (fileError instanceof Error) {
        errorDetails = fileError.message;
        if (fileError.message.includes('permission') || fileError.message.includes('EACCES')) {
          errorMessage = 'Permission denied when accessing recording file';
        } else if (fileError.message.includes('ENOENT') || fileError.message.includes('not found')) {
          errorMessage = 'Recording file not found';
        } else if (fileError.message.includes('timeout') || fileError.message.includes('ECONNREFUSED')) {
          errorMessage = 'Unable to connect to LiveKit server';
        }
      }
      
      // Fallback: return recording info with instructions
      return new NextResponse(JSON.stringify({
        error: errorMessage,
        message: 'Could not access recording file from local storage or LiveKit server',
        details: errorDetails,
        recording: {
          egressId: egressInfo.egressId,
          filename: baseFilename,
          status: egressInfo.status,
          filepath: filename,
        },
        instructions: 'The recording file may be stored on the production LiveKit server. Check the server logs or configure S3 for direct download access.'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('File endpoint error:', error);
    if (error instanceof Error) {
      return new NextResponse(JSON.stringify({ 
        error: error.message,
        details: 'Failed to access recording file'
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new NextResponse('Unknown error occurred', { status: 500 });
  }
}
