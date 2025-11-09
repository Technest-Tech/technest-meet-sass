import { NextRequest, NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;
    const { searchParams } = new URL(req.url);
    const requestedBy = searchParams.get('requestedBy');

    if (!fileId) {
      return NextResponse.json(
        { error: 'Missing fileId parameter' },
        { status: 400 }
      );
    }

    if (!requestedBy) {
      return NextResponse.json(
        { error: 'Missing requestedBy parameter' },
        { status: 400 }
      );
    }

    // Get file metadata from database
    const roomFile = await prisma.roomFile.findUnique({
      where: { id: fileId },
      include: { room: true },
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

    // Construct file path
    const filePath = path.join(
      process.cwd(),
      'public',
      'uploads',
      roomFile.room.name,
      roomFile.filename
    );

    // Delete file from disk if it exists
    if (existsSync(filePath)) {
      await unlink(filePath);
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

