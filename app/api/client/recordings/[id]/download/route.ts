import { NextRequest, NextResponse } from 'next/server';
import { requireClient } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { getRecordingFile } from '@/lib/services/recordingStorage';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * GET /api/client/recordings/[id]/download
 * Download recording file
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

    // Get file path - use storagePath if available, otherwise construct from filename
    let localFilePath: string;
    if (recording.storageType === 'LOCAL' && recording.storagePath && existsSync(recording.storagePath)) {
      localFilePath = recording.storagePath;
      console.log(`[Download Recording] ✅ Using storagePath: ${localFilePath}`);
    } else {
      localFilePath = join(process.cwd(), 'recordings', recording.filename);
      console.log(`[Download Recording] 📁 Constructed file path: ${localFilePath}`);
    }
    
    // If file doesn't exist, try to find it by egressId (fallback)
    if (!existsSync(localFilePath) && recording.egressId) {
      console.log(`[Download Recording] 🔍 File not found at ${localFilePath}, searching by egressId: ${recording.egressId}`);
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
          console.log(`[Download Recording] ✅ Found file by egressId: ${matchingFile}`);
        }
      } catch (e) {
        console.error(`[Download Recording] Error searching for file: ${e}`);
      }
    }

    // Get file buffer from storage (R2 or local)
    const fileBuffer = await getRecordingFile(
      recording.storageType,
      recording.storagePath,
      localFilePath
    );

    if (!fileBuffer) {
      return new NextResponse('Recording file not found', { status: 404 });
    }

    // Generate download filename
    const downloadFilename = recording.originalName || recording.filename;

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${downloadFilename}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Download recording error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

