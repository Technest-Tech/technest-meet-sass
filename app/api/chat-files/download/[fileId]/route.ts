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

    console.log('Download request received:', { 
      fileId, 
      roomName, 
      fileIdType: typeof fileId,
      fileIdLength: fileId?.length,
      url: req.url 
    });

    if (!roomName) {
      return NextResponse.json(
        { error: 'roomName query parameter is required' },
        { status: 400 }
      );
    }

    // Sanitize room name
    const sanitizedRoomName = sanitizeRoomIdentifier(roomName);
    if (!sanitizedRoomName || sanitizedRoomName !== roomName) {
      console.error('Invalid room name:', { roomName, sanitizedRoomName });
      return NextResponse.json(
        { error: 'Invalid room name format' },
        { status: 400 }
      );
    }

    // Decode and trim fileId in case it was URL encoded or has whitespace
    let decodedFileId = fileId;
    try {
      decodedFileId = decodeURIComponent(fileId).trim();
    } catch (e) {
      // If decode fails, just trim
      decodedFileId = fileId.trim();
    }
    console.log('FileId processing:', { original: fileId, decoded: decodedFileId, lengths: { original: fileId.length, decoded: decodedFileId.length } });

    // Get file metadata (this may be null if not in memory)
    let file = getFile(sanitizedRoomName, decodedFileId);
    
    // Try to read from disk - this will also restore to memory if found on disk
    const fileBuffer = await readFileFromDisk(sanitizedRoomName, decodedFileId);
    
    // If fileBuffer was found but file wasn't in memory, get it again (it may have been restored)
    if (fileBuffer && !file) {
      file = getFile(sanitizedRoomName, decodedFileId);
    }
    
    if (!file || !fileBuffer) {
      console.error(`File not found: roomName=${sanitizedRoomName}, fileId=${decodedFileId}`);
      // Import getRoomFiles to debug
      const { getRoomFiles } = await import('@/lib/services/tempFileStorage');
      const allFiles = getRoomFiles(sanitizedRoomName);
      console.error(`Available files for room ${sanitizedRoomName}:`, allFiles.map(f => ({ id: f.id, name: f.originalName })));
      console.error(`Looking for fileId: "${decodedFileId}" (length: ${decodedFileId.length})`);
      if (allFiles.length > 0) {
        console.error(`First fileId in room: "${allFiles[0].id}" (length: ${allFiles[0].id.length})`);
        console.error(`FileId match check:`, { 
          exact: allFiles[0].id === decodedFileId,
          includes: allFiles.some(f => f.id === decodedFileId),
          allIds: allFiles.map(f => f.id)
        });
      }
      return NextResponse.json(
        { error: 'File not found. The file may have been deleted or the meeting may have ended.' },
        { status: 404 }
      );
    }

    // Encode filename for Content-Disposition header
    const encodedFilename = encodeURIComponent(file.originalName);

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': file.fileType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
        'Content-Length': file.size.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Chat file download error:', error);
    return NextResponse.json(
      {
        error: 'Failed to download file',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

