import { NextRequest, NextResponse } from 'next/server';
import { requireClient } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { deleteFile as deleteFromR2 } from '@/lib/services/r2Storage';
import { unlink } from 'fs/promises';
import { join } from 'path';

/**
 * GET /api/client/recordings/[id]
 * Get recording details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireClient();

    if (!session.clientId) {
      return NextResponse.json(
        { error: 'معرف العميل غير موجود' },
        { status: 400 }
      );
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
            id: true,
            name: true,
            hostLink: true,
          },
        },
      },
    });

    if (!recording) {
      return NextResponse.json(
        { error: 'التسجيل غير موجود' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: recording.id,
      roomId: recording.roomId,
      roomName: recording.room.name,
      egressId: recording.egressId,
      filename: recording.filename,
      originalName: recording.originalName,
      fileSize: recording.fileSize,
      duration: recording.duration,
      status: recording.status,
      storageType: recording.storageType,
      storagePath: recording.storagePath,
      startedAt: recording.startedAt.toISOString(),
      endedAt: recording.endedAt?.toISOString() || null,
      createdAt: recording.createdAt.toISOString(),
      streamUrl: `/api/client/recordings/${recording.id}/stream`,
      downloadUrl: `/api/client/recordings/${recording.id}/download`,
    });
  } catch (error) {
    console.error('Get recording error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب التسجيل' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/client/recordings/[id]
 * Delete recording from database and storage (R2 and local)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireClient();

    if (!session.clientId) {
      return NextResponse.json(
        { error: 'معرف العميل غير موجود' },
        { status: 400 }
      );
    }

    const { id } = await params;

    // Get recording and verify ownership
    const recording = await prisma.recording.findFirst({
      where: {
        id,
        room: {
          clientId: session.clientId,
        },
      },
    });

    if (!recording) {
      return NextResponse.json(
        { error: 'التسجيل غير موجود' },
        { status: 404 }
      );
    }

    // Delete from R2 if stored there
    if (recording.storageType === 'R2' && recording.storagePath) {
      try {
        const deleted = await deleteFromR2(recording.storagePath);
        if (deleted) {
          console.log(`[Recording Delete] Deleted from R2: ${recording.storagePath}`);
        } else {
          console.warn(`[Recording Delete] Failed to delete from R2: ${recording.storagePath}`);
        }
      } catch (error) {
        console.error(`[Recording Delete] Error deleting from R2:`, error);
        // Continue with database deletion even if R2 deletion fails
      }
    }

    // Delete local file if it exists
    const localFilePath = join(process.cwd(), 'recordings', recording.filename);
    try {
      await unlink(localFilePath);
      console.log(`[Recording Delete] Deleted local file: ${localFilePath}`);
    } catch (error: any) {
      // File might not exist or already deleted - that's okay
      if (error.code !== 'ENOENT') {
        console.warn(`[Recording Delete] Error deleting local file:`, error);
      }
    }

    // Delete from database
    await prisma.recording.delete({
      where: { id },
    });

    console.log(`[Recording Delete] Deleted recording ${id} from database`);

    return NextResponse.json({
      message: 'تم حذف التسجيل بنجاح',
    });
  } catch (error) {
    console.error('Delete recording error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء حذف التسجيل' },
      { status: 500 }
    );
  }
}

