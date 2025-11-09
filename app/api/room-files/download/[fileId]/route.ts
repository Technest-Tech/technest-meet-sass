import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

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
      include: { room: true },
    });

    if (!roomFile) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
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

    // Check if file exists on disk
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File not found on disk' },
        { status: 404 }
      );
    }

    // Read file
    const fileBuffer = await readFile(filePath);

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

