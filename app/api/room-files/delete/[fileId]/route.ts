import { NextRequest, NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import { getRoomFilePath, isR2Key } from '@/lib/utils/storage';
import { deleteFile as deleteFromR2 } from '@/lib/services/r2Storage';
import { sanitizeString, sanitizeStringLenient } from '@/lib/utils/sanitize';

const prisma = new PrismaClient();

// UUID v4 pattern for validation
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId: fileIdParam } = await params;
    const { searchParams } = new URL(req.url);
    const requestedByParam = searchParams.get('requestedBy');

    if (!fileIdParam) {
      return NextResponse.json(
        { error: 'Missing fileId parameter' },
        { status: 400 }
      );
    }

    // Sanitize and validate fileId format (should be UUID)
    const fileId = sanitizeString(fileIdParam);
    if (!fileId || !UUID_PATTERN.test(fileId)) {
      return NextResponse.json(
        { error: 'Invalid fileId format' },
        { status: 400 }
      );
    }

    if (!requestedByParam) {
      return NextResponse.json(
        { error: 'Missing requestedBy parameter' },
        { status: 400 }
      );
    }

    // Sanitize requestedBy
    const requestedBy = sanitizeStringLenient(requestedByParam);

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

    // Verify that the requester is the host
    // Check if requestedBy contains "_host_" which indicates host role
    // LiveKit identity format: "Name_host_X" or "Name_guest_X"
    const isHost = requestedBy.includes('_host_');
    
    if (!isHost) {
      return NextResponse.json(
        { error: 'Only hosts can delete files' },
        { status: 403 }
      );
    }

    // Try deleting from R2 first if it's an R2 key
    if (isR2Key(roomFile.filename)) {
      const deleted = await deleteFromR2(roomFile.filename);
      if (!deleted) {
        console.warn(
          `[RoomFiles] Delete requested for ${roomFile.id} from R2, but file not found or delete failed with key ${roomFile.filename}`,
        );
      }
    } else {
      // Fallback to local filesystem
      const filePath = getRoomFilePath(roomFile.roomId, roomFile.filename);

      // Delete file from disk if it exists
      if (existsSync(filePath)) {
        await unlink(filePath);
      } else {
        console.warn(
          `[RoomFiles] Delete requested for ${roomFile.id}, but file missing at ${filePath}. Verify ROOM_UPLOAD_ROOT and migrate legacy folders.`,
        );
      }
    }

    // Delete file metadata from database
    await prisma.roomFile.delete({
      where: { id: fileId },
    });

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    console.error('File delete error:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete file',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

