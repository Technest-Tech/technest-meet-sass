import { EgressClient } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const roomName = req.nextUrl.searchParams.get('roomName');
    const egressId = req.nextUrl.searchParams.get('egressId');

    if (!roomName) {
      return new NextResponse('Missing roomName parameter', { status: 400 });
    }

    const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL } = process.env;

    const hostURL = new URL(LIVEKIT_URL!);
    // Keep the original protocol for local development
    if (!hostURL.hostname.includes('localhost') && !hostURL.hostname.includes('127.0.0.1')) {
      hostURL.protocol = 'https:';
    }

    const egressClient = new EgressClient(hostURL.origin, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

    // Get all egresses for the room
    const egresses = await egressClient.listEgress({ roomName });
    
    // Filter completed recordings
    const completedRecordings = egresses.filter(
      (egress) => egress.status === 2 // Status 2 = completed
    );

    if (completedRecordings.length === 0) {
      return new NextResponse('No completed recordings found', { status: 404 });
    }

    // If specific egressId requested, find that recording
    if (egressId) {
      const specificRecording = completedRecordings.find(e => e.egressId === egressId);
      if (!specificRecording) {
        return new NextResponse('Recording not found', { status: 404 });
      }
      
      // For local development, we can't directly serve files from LiveKit server
      // Instead, return the recording info and let the client handle download
      return new NextResponse(JSON.stringify({
        egressId: specificRecording.egressId,
        filename: `${roomName}-${specificRecording.egressId}.mp4`,
        status: specificRecording.status,
        downloadUrl: `/api/record/file?egressId=${specificRecording.egressId}`,
        message: 'Recording ready for download'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Return list of all completed recordings
    return new NextResponse(JSON.stringify({
      recordings: completedRecordings.map(egress => ({
        egressId: egress.egressId,
        filename: `${roomName}-${egress.egressId}.mp4`,
        status: egress.status,
        downloadUrl: `/api/record/file?egressId=${egress.egressId}`
      })),
      message: 'Completed recordings retrieved successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Download endpoint error:', error);
    if (error instanceof Error) {
      return new NextResponse(JSON.stringify({ 
        error: error.message,
        details: 'Failed to retrieve recording information'
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new NextResponse('Unknown error occurred', { status: 500 });
  }
}
