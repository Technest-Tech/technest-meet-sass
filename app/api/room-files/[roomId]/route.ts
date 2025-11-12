import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const roomLink = roomId; // URL param is actually roomLink (hostLink, guestLink, or observerLink)

    if (!roomLink) {
      return NextResponse.json(
        { error: 'Missing roomLink parameter' },
        { status: 400 }
      );
    }

    // Verify room exists by link (hostLink, guestLink, or observerLink)
    const room = await prisma.room.findFirst({
      where: {
        OR: [
          { hostLink: roomLink },
          { guestLink: roomLink },
          { observerLink: roomLink },
        ],
      },
    });

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // Get all files for the room
    const files = await prisma.roomFile.findMany({
      where: { roomId: room.id },
      orderBy: { uploadedAt: 'desc' },
    });

    // Format the response
    const formattedFiles = files.map((file) => ({
      id: file.id,
      roomId: file.roomId,
      filename: file.filename,
      originalName: file.originalName,
      fileType: file.fileType,
      size: file.size,
      uploadedBy: file.uploadedBy,
      uploadedAt: file.uploadedAt.getTime(),
    }));

    return NextResponse.json({
      success: true,
      files: formattedFiles,
    });
  } catch (error) {
    console.error('File list error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch files',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

