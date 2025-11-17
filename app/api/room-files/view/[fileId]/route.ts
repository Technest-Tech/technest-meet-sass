import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { prisma } from '@/lib/database';
import { getRoomFilePath } from '@/lib/utils/storage';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;

    if (!fileId) {
      return NextResponse.json(
        { error: 'Missing fileId parameter' },
        { status: 400 }
      );
    }

    // Get file metadata from database
    const roomFile = await prisma.roomFile.findUnique({
      where: { id: fileId },
    });

    if (!roomFile) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Construct file path using stable room identifier
    const filePath = getRoomFilePath(roomFile.roomId, roomFile.filename);

    // Check if file exists on disk
    if (!existsSync(filePath)) {
      console.warn(
        `[RoomFiles] File ${roomFile.id} missing on disk at ${filePath}. Verify ROOM_UPLOAD_ROOT and run scripts/migrate-room-file-folders.ts if upgrading.`,
      );
      return NextResponse.json(
        { error: 'File not found on disk' },
        { status: 404 }
      );
    }

    // Read file
    const fileBuffer = await readFile(filePath);

    // Encode filename for Content-Disposition header to handle special characters
    const encodedFilename = encodeURIComponent(roomFile.originalName);

    // Return file with appropriate headers for inline viewing
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': roomFile.fileType,
        'Content-Disposition': `inline; filename*=UTF-8''${encodedFilename}`,
        'Content-Length': roomFile.size.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('File view error:', error);
    return NextResponse.json(
      {
        error: 'Failed to view file',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

