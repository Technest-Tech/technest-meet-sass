import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { prisma } from '@/lib/database';
import { getRoomFilePath, isR2Key } from '@/lib/utils/storage';
import { downloadFile as downloadFromR2 } from '@/lib/services/r2Storage';
import { sanitizeString } from '@/lib/utils/sanitize';

// CUID pattern for validation (Prisma uses CUIDs, not UUIDs)
// CUIDs are 25 characters, start with 'c', and contain lowercase letters and numbers
const CUID_PATTERN = /^c[a-z0-9]{24}$/;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId: fileIdParam } = await params;

    if (!fileIdParam) {
      return NextResponse.json(
        { error: 'Missing fileId parameter' },
        { status: 400 }
      );
    }

    // Sanitize and validate fileId format (should be CUID)
    const fileId = sanitizeString(fileIdParam);
    if (!fileId || !CUID_PATTERN.test(fileId)) {
      return NextResponse.json(
        { error: 'Invalid fileId format' },
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

    let fileBuffer: Buffer | null = null;

    // Check if file is stored in R2 (filename starts with "room-files/")
    if (isR2Key(roomFile.filename)) {
      // Try to download from R2
      fileBuffer = await downloadFromR2(roomFile.filename);
      if (!fileBuffer) {
        console.warn(
          `[RoomFiles] File ${roomFile.id} not found in R2 with key ${roomFile.filename}`,
        );
        return NextResponse.json(
          { error: 'File not found in R2' },
          { status: 404 }
        );
      }
    } else {
      // Fallback to local filesystem
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

      // Read file from local filesystem
      fileBuffer = await readFile(filePath);
    }

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

