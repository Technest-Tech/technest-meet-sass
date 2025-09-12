import { NextRequest, NextResponse } from 'next/server';

// Simple download implementation
export async function GET(req: NextRequest) {
  try {
    const filename = req.nextUrl.searchParams.get('filename');

    if (!filename) {
      return new NextResponse('Missing filename parameter', { status: 400 });
    }

    // For simulation mode, we'll create a simple placeholder file
    // In a real implementation, you would serve the actual recording file
    
    const placeholderContent = `This is a placeholder for the recording file: ${filename}

In a real implementation, this would be the actual video recording.

To implement real recording:
1. Use browser MediaRecorder API on the client side
2. Stream the recording data to a server endpoint
3. Save the file to local storage or cloud storage
4. Serve the file through this endpoint

Recording started: ${new Date().toISOString()}
Room: ${filename.split('-').pop()?.replace('.webm', '') || 'unknown'}
Duration: Simulated`;

    return new NextResponse(placeholderContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': placeholderContent.length.toString()
      }
    });

  } catch (error) {
    console.error('Simple download error:', error);
    return new NextResponse(JSON.stringify({
      error: 'Failed to download recording',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
