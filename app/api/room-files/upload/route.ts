import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { PrismaClient } from '@prisma/client';
import { ensureRoomUploadPath, getRoomFilePath } from '@/lib/utils/storage';

const prisma = new PrismaClient();

// Allowed file types
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const roomLink = formData.get('roomName') as string; // Actually roomLink (hostLink, guestLink, or observerLink)
    const uploadedBy = formData.get('uploadedBy') as string;

    if (!file || !roomLink || !uploadedBy) {
      return NextResponse.json(
        { error: 'Missing required fields: file, roomName, or uploadedBy' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type not allowed. Allowed types: PDF, images, Word, PowerPoint, text` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
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

    // Create upload directory if it doesn't exist
    const roomStorageId = room.id;
    const uploadDir = await ensureRoomUploadPath(roomStorageId);

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedOriginalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}-${sanitizedOriginalName}`;
    const filePath = getRoomFilePath(roomStorageId, filename);

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Save metadata to database
    const roomFile = await prisma.roomFile.create({
      data: {
        roomId: room.id,
        filename,
        originalName: file.name,
        fileType: file.type,
        size: file.size,
        uploadedBy,
      },
    });

    return NextResponse.json({
      success: true,
      file: {
        id: roomFile.id,
        roomId: roomFile.roomId,
        filename: roomFile.filename,
        originalName: roomFile.originalName,
        fileType: roomFile.fileType,
        size: roomFile.size,
        uploadedBy: roomFile.uploadedBy,
        uploadedAt: roomFile.uploadedAt.getTime(),
      },
    });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload file',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

