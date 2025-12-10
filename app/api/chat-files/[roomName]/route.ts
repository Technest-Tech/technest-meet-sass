import { NextRequest, NextResponse } from 'next/server';
import { getRoomFiles, cleanupRoomFiles } from '@/lib/services/tempFileStorage';
import { sanitizeRoomIdentifier } from '@/lib/utils/sanitize';

export const runtime = 'nodejs';

/**
 * GET - List all files for a room
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  try {
    const { roomName } = await params;

    // Sanitize room name
    const sanitizedRoomName = sanitizeRoomIdentifier(roomName);
    if (!sanitizedRoomName || sanitizedRoomName !== roomName) {
      return NextResponse.json(
        { error: 'Invalid room name format' },
        { status: 400 }
      );
    }

    // Get files for room (metadata only, without filePath)
    const files = getRoomFiles(sanitizedRoomName);

    return NextResponse.json({
      success: true,
      files,
    });
  } catch (error) {
    console.error('Error listing chat files:', error);
    return NextResponse.json(
      {
        error: 'Failed to list files',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Cleanup all files for a room
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  try {
    const { roomName } = await params;

    // Sanitize room name
    const sanitizedRoomName = sanitizeRoomIdentifier(roomName);
    if (!sanitizedRoomName || sanitizedRoomName !== roomName) {
      return NextResponse.json(
        { error: 'Invalid room name format' },
        { status: 400 }
      );
    }

    // Cleanup all files for room
    const deletedCount = await cleanupRoomFiles(sanitizedRoomName);

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${deletedCount} file(s) for room ${sanitizedRoomName}`,
      deletedCount,
    });
  } catch (error) {
    console.error('Error cleaning up chat files:', error);
    return NextResponse.json(
      {
        error: 'Failed to cleanup files',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

