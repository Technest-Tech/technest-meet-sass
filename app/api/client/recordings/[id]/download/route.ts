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
      include: {
        room: {
          select: {
            hostLink: true,
          },
        },
      },
    });

    if (!recording) {
      return new NextResponse('Recording not found', { status: 404 });
    }

    // Build local file path
    let localFilePath = '';
    if (recording.storageType === 'LOCAL' && recording.storagePath && existsSync(recording.storagePath)) {
      localFilePath = recording.storagePath;
    } else if (recording.filename && recording.filename !== 'N/A' && recording.filename !== 'recording.mp4') {
      localFilePath = join(process.cwd(), 'recordings', recording.filename);
    }

    // getRecordingFile handles R2 first (if storageType is R2), then falls back to local
    console.log(`[Download Recording] Looking for file - storageType: ${recording.storageType || 'LOCAL'}, storagePath: ${recording.storagePath || 'N/A'}, filename: ${recording.filename || 'N/A'}, localFilePath: ${localFilePath || 'N/A'}`);
    
    const fileBuffer = await getRecordingFile(
      recording.storageType || 'LOCAL',
      recording.storagePath,
      localFilePath
    );

    if (fileBuffer) {
      const downloadFilename = recording.originalName || recording.filename || 'recording.mp4';
      console.log(`[Download Recording] ✅ Serving file (${fileBuffer.length} bytes) from ${recording.storageType || 'LOCAL'}`);
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Disposition': `attachment; filename="${downloadFilename}"`,
          'Content-Length': fileBuffer.length.toString(),
        },
      });
    }

    // File not found - log details for debugging
    console.error(`[Download Recording] ❌ File not found - recordingId: ${recording.id}, storageType: ${recording.storageType || 'LOCAL'}, storagePath: ${recording.storagePath || 'N/A'}, filename: ${recording.filename || 'N/A'}, egressId: ${recording.egressId || 'N/A'}`);
    
    return new NextResponse('Recording file not found', { status: 404 });
  } catch (error) {
    console.error('Download recording error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

