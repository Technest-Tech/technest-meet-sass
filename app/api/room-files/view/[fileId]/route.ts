import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { prisma } from '@/lib/database';
import { getRoomFilePath, isR2Key, extractFilenameFromR2Key, getR2Key } from '@/lib/utils/storage';
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
    const localFilename = extractFilenameFromR2Key(roomFile.filename);
    const r2Key = isR2Key(roomFile.filename) 
      ? roomFile.filename 
      : getR2Key(roomFile.roomId, roomFile.filename);
    const localFilePath = getRoomFilePath(roomFile.roomId, localFilename);

    // CRITICAL: Try both storage locations for maximum reliability
    // Strategy: Try primary location first, then fallback to alternative
    
    // If filename indicates R2 storage, try R2 first
    if (isR2Key(roomFile.filename)) {
      // Try R2 first (primary)
      try {
        fileBuffer = await downloadFromR2(roomFile.filename);
        if (fileBuffer) {
          console.log(`[RoomFiles] Successfully loaded file ${roomFile.id} from R2`);
        }
      } catch (r2Error) {
        console.warn(`[RoomFiles] R2 download failed for ${roomFile.id}:`, r2Error);
      }

      // Fallback to local storage if R2 failed
      if (!fileBuffer && existsSync(localFilePath)) {
        try {
          fileBuffer = await readFile(localFilePath);
          console.log(`[RoomFiles] Fallback: Loaded file ${roomFile.id} from local storage`);
        } catch (localError) {
          console.error(`[RoomFiles] Local fallback failed for ${roomFile.id}:`, localError);
        }
      }
    } else {
      // Filename indicates local storage, try local first
      if (existsSync(localFilePath)) {
        try {
          fileBuffer = await readFile(localFilePath);
          if (fileBuffer) {
            console.log(`[RoomFiles] Successfully loaded file ${roomFile.id} from local storage`);
          }
        } catch (localError) {
          console.error(`[RoomFiles] Local read failed for ${roomFile.id}:`, localError);
        }
      }

      // Fallback to R2 if local failed (file might have been migrated to R2)
      if (!fileBuffer) {
        try {
          fileBuffer = await downloadFromR2(r2Key);
          if (fileBuffer) {
            console.log(`[RoomFiles] Fallback: Loaded file ${roomFile.id} from R2`);
          }
        } catch (r2Error) {
          console.warn(`[RoomFiles] R2 fallback failed for ${roomFile.id}:`, r2Error);
        }
      }
    }

    // If still no file found, return detailed error
    if (!fileBuffer) {
      const errors: string[] = [];
      
      if (isR2Key(roomFile.filename)) {
        errors.push(`R2 download failed for key: ${roomFile.filename}`);
        if (!existsSync(localFilePath)) {
          errors.push(`Local file not found at: ${localFilePath}`);
        } else {
          errors.push(`Local file exists but read failed`);
        }
      } else {
        if (!existsSync(localFilePath)) {
          errors.push(`Local file not found at: ${localFilePath}`);
        } else {
          errors.push(`Local file read failed`);
        }
        errors.push(`R2 fallback failed for key: ${r2Key}`);
      }

      console.error(`[RoomFiles] File ${roomFile.id} not accessible from any storage:`, errors);
      
      return NextResponse.json(
        {
          error: 'File not accessible',
          details: errors,
          fileId: roomFile.id,
          filename: roomFile.filename,
          troubleshooting: [
            'File may have been deleted or moved',
            'Check R2 configuration if file should be in cloud storage',
            'Verify ROOM_UPLOAD_ROOT environment variable',
            'Check file system permissions',
          ],
        },
        { status: 404 }
      );
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

