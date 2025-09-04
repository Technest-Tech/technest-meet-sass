import { EgressClient } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const egressId = req.nextUrl.searchParams.get('egressId');

    if (!egressId) {
      return new NextResponse('Missing egressId parameter', { status: 400 });
    }

    const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL } = process.env;

    const hostURL = new URL(LIVEKIT_URL!);
    // Keep the original protocol for local development
    if (!hostURL.hostname.includes('localhost') && !hostURL.hostname.includes('127.0.0.1')) {
      hostURL.protocol = 'https:';
    }

    const egressClient = new EgressClient(hostURL.origin, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

    // Get the specific egress info
    const egressInfo = await egressClient.getEgress(egressId);

    if (!egressInfo || egressInfo.status !== 2) {
      return new NextResponse('Recording not found or not completed', { status: 404 });
    }

    const filename = egressInfo.file?.filepath || 'recording.mp4';

    // For local development, we need to get the file from the LiveKit server
    // This is a simplified approach - in production you'd want to use S3 or similar
    try {
      // Try to fetch the file from LiveKit server
      const fileUrl = `${hostURL.origin}/egress/${egressId}/download`;
      
      // For now, return a redirect to the LiveKit server's download endpoint
      // In a real implementation, you'd proxy the file or use S3
      return new NextResponse(null, {
        status: 302,
        headers: {
          'Location': fileUrl,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Type': 'video/mp4'
        }
      });

    } catch (fileError) {
      console.error('File access error:', fileError);
      
      // Fallback: return recording info with instructions
      return new NextResponse(JSON.stringify({
        error: 'File access not available in local development',
        message: 'Recording completed but file access requires S3 configuration',
        recording: {
          egressId: egressInfo.egressId,
          filename: filename,
          status: egressInfo.status,
          createdAt: egressInfo.createdAt,
          endedAt: egressInfo.endedAt
        },
        instructions: 'For local development, recordings are stored on the LiveKit server. Configure S3 for direct download access.'
      }), {
        status: 200,
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
