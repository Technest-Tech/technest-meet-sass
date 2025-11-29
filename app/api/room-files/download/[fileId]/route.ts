import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import { getRoomFilePath, isR2Key } from '@/lib/utils/storage';
import { downloadFile as downloadFromR2 } from '@/lib/services/r2Storage';

const prisma = new PrismaClient();

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
    
    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': roomFile.fileType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
        'Content-Length': roomFile.size.toString(),
      },
    });
  } catch (error) {
    console.error('File download error:', error);
    return NextResponse.json(
      {
        error: 'Failed to download file',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

