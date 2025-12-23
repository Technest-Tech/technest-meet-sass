import { NextRequest, NextResponse } from 'next/server';
import { requireClient } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { getRecordingFile } from '@/lib/services/recordingStorage';
import { join } from 'path';
import { stat } from 'fs/promises';
import { existsSync } from 'fs';

/**
 * GET /api/client/recordings/[id]/stream
 * Stream recording video for playback (supports range requests for seeking)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireClient();

    if (!session.clientId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { id } = await params;
    
    // Get filename from query params for verification
    const searchParams = request.nextUrl.searchParams;
    const expectedFilename = searchParams.get('filename');

    const recording = await prisma.recording.findFirst({
      where: {
        id,
        room: {
          clientId: session.clientId,
        },
      },
    });

    if (!recording) {
      return new NextResponse('Recording not found', { status: 404 });
    }

    // Verify filename matches if provided in query params
    if (expectedFilename && recording.filename !== expectedFilename) {
      console.warn(`[Stream Recording] Filename mismatch for recording ${recording.id}: expected ${expectedFilename}, got ${recording.filename}`);
    }

    console.log(`[Stream Recording] 🎬 Serving recording ${recording.id}`);
    console.log(`  - egressId: ${recording.egressId}`);
    console.log(`  - filename: ${recording.filename}`);
    console.log(`  - storageType: ${recording.storageType}`);
    console.log(`  - storagePath: ${recording.storagePath}`);
    console.log(`  - startedAt: ${recording.startedAt}`);

    // Get file path - use storagePath if available, otherwise construct from filename
    let localFilePath: string;
    if (recording.storageType === 'LOCAL' && recording.storagePath && existsSync(recording.storagePath)) {
      localFilePath = recording.storagePath;
      console.log(`[Stream Recording] ✅ Using storagePath: ${localFilePath}`);
    } else {
      localFilePath = join(process.cwd(), 'recordings', recording.filename);
      console.log(`[Stream Recording] 📁 Constructed file path: ${localFilePath}`);
    }
    
    // Verify file exists
    if (!existsSync(localFilePath)) {
      console.error(`[Stream Recording] ❌ File not found at: ${localFilePath}`);
      console.error(`[Stream Recording] Filename in DB: ${recording.filename}`);
      console.error(`[Stream Recording] EgressId: ${recording.egressId}`);
      
      // Try to find file by egressId if filename doesn't match
      if (recording.egressId && recording.filename === 'recording.mp4') {
        console.log(`[Stream Recording] 🔍 Filename is generic 'recording.mp4', searching by egressId: ${recording.egressId}`);
        try {
          const { readdir } = await import('fs/promises');
          const recordingsDir = join(process.cwd(), 'recordings');
          const files = await readdir(recordingsDir);
          const matchingFile = files.find(f => 
            f.endsWith('.mp4') && 
            (f.includes(recording.egressId) || f.includes(recording.egressId.replace('EG_', '')))
          );
          
          if (matchingFile) {
            localFilePath = join(recordingsDir, matchingFile);
            console.log(`[Stream Recording] ✅ Found file by egressId: ${matchingFile}`);
          } else {
            console.error(`[Stream Recording] ❌ No file found matching egressId: ${recording.egressId}`);
          }
        } catch (e) {
          console.error(`[Stream Recording] Error searching for file: ${e}`);
        }
      }
      
      // If still not found, list available files
      if (!existsSync(localFilePath)) {
        console.error(`[Stream Recording] Available files in recordings directory:`);
        try {
          const { readdir } = await import('fs/promises');
          const recordingsDir = join(process.cwd(), 'recordings');
          const files = await readdir(recordingsDir);
          const mp4Files = files.filter(f => f.endsWith('.mp4'));
          console.error(`  Total MP4 files: ${mp4Files.length}`);
          console.error(`  Files: ${mp4Files.slice(0, 10).join(', ')}${mp4Files.length > 10 ? '...' : ''}`);
        } catch (e) {
          console.error(`  Could not list files: ${e}`);
        }
        return new NextResponse('Recording file not found', { status: 404 });
      }
    }
    
    const fileStat = await stat(localFilePath);
    console.log(`[Stream Recording] ✅ File exists, size: ${fileStat.size} bytes, modified: ${fileStat.mtime.toISOString()}`);

    // Get file buffer from storage (R2 or local)
    const fileBuffer = await getRecordingFile(
      recording.storageType,
      recording.storagePath,
      localFilePath
    );

    if (!fileBuffer) {
      return new NextResponse('Recording file not found', { status: 404 });
    }

    // Handle range requests for video seeking
    const range = request.headers.get('range');
    const fileSize = fileBuffer.length;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      const chunk = fileBuffer.slice(start, end + 1);

      return new NextResponse(chunk, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize.toString(),
          'Content-Type': 'video/mp4',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Full file response
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': fileSize.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Stream recording error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

