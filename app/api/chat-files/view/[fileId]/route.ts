import { NextRequest, NextResponse } from 'next/server';
import { readFileFromDisk, getFile } from '@/lib/services/tempFileStorage';
import { sanitizeRoomIdentifier } from '@/lib/utils/sanitize';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;
    const { searchParams } = new URL(req.url);
    const roomName = searchParams.get('roomName');

    if (!roomName) {
      return NextResponse.json(
        { error: 'roomName query parameter is required' },
        { status: 400 }
      );
    }

    // Sanitize room name
    const sanitizedRoomName = sanitizeRoomIdentifier(roomName);
    if (!sanitizedRoomName || sanitizedRoomName !== roomName) {
      return NextResponse.json(
        { error: 'Invalid room name format' },
        { status: 400 }
      );
    }

    // Get file metadata
    const file = getFile(sanitizedRoomName, fileId);
    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Only allow images to be viewed (not downloaded)
    if (!file.fileType.startsWith('image/')) {
      return NextResponse.json(
        { error: 'View endpoint only supports images' },
        { status: 400 }
      );
    }

    // Read file from disk
    const fileBuffer = await readFileFromDisk(sanitizedRoomName, fileId);
    if (!fileBuffer) {
      return NextResponse.json(
        { error: 'File not found on disk' },
        { status: 404 }
      );
    }

    // Return file with appropriate headers (no Content-Disposition for viewing)
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': file.fileType,
        'Content-Length': file.size.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Chat file view error:', error);
    return NextResponse.json(
      {
        error: 'Failed to view file',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

