import { NextRequest, NextResponse } from 'next/server';

// Simple recording stop implementation
export async function GET(req: NextRequest) {
  try {
    const roomName = req.nextUrl.searchParams.get('roomName');
    const recordingId = req.nextUrl.searchParams.get('recordingId');

    if (!roomName) {
      return new NextResponse('Missing roomName parameter', { status: 400 });
    }

    // Simulate recording stop
    console.log(`Stopping recording for room: ${roomName}, ID: ${recordingId || 'unknown'}`);

    const filename = `${new Date().toISOString().replace(/[:.]/g, '-')}-${roomName}.webm`;

    return new NextResponse(JSON.stringify({
      recordingId: recordingId || `rec_${Date.now()}_${roomName}`,
      filename: filename,
      status: 'stopped',
      message: 'Recording stopped successfully (simulation mode)',
      downloadUrl: `/api/record/simple-download?filename=${encodeURIComponent(filename)}`,
      note: 'This is a simplified recording implementation. For full functionality, configure LiveKit egress properly.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Simple recording stop error:', error);
    return new NextResponse(JSON.stringify({
      error: 'Failed to stop recording',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
