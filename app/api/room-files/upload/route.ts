import { NextRequest, NextResponse } from 'next/server';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rename, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import Busboy from 'busboy';
import { PrismaClient } from '@prisma/client';
import { ensureRoomUploadPath, getRoomFilePath, getR2Key } from '@/lib/utils/storage';
import { uploadFile as uploadToR2, isR2Enabled } from '@/lib/services/r2Storage';

export const runtime = 'nodejs';

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

type ParsedUpload = {
  roomLink?: string;
  uploadedBy?: string;
  file?: {
    tmpPath: string;
    originalName: string;
    mimeType: string;
    size: number;
  };
};

export async function POST(req: NextRequest) {
  let tmpDir: string | null = null;

  try {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'room-file-upload-'));
    const parsed = await parseMultipartRequest(req, tmpDir);

    const file = parsed.file;
    const roomLink = parsed.roomLink;
    const uploadedBy = parsed.uploadedBy;

    if (!file || !roomLink || !uploadedBy) {
      if (file?.tmpPath) {
        await rm(file.tmpPath, { force: true });
      }
      return NextResponse.json(
        { error: 'Missing required fields: file, roomName, or uploadedBy' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.mimeType)) {
      await rm(file.tmpPath, { force: true });
      return NextResponse.json(
        { error: `File type not allowed. Allowed types: PDF, images, Word, PowerPoint, text` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      await rm(file.tmpPath, { force: true });
      return NextResponse.json(
        { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

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
      await rm(file.tmpPath, { force: true });
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    const roomStorageId = room.id;
    const timestamp = Date.now();
    const sanitizedOriginalName = file.originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}-${sanitizedOriginalName}`;

    let storedFilename = filename;
    let uploadedToR2 = false;

    // Try uploading to R2 first if enabled
    if (isR2Enabled()) {
      console.log(`[R2] Attempting to upload ${filename} to R2...`);
      try {
        const fileBuffer = await readFile(file.tmpPath);
        const r2Key = getR2Key(roomStorageId, filename);
        console.log(`[R2] Uploading to R2 key: ${r2Key}`);
        const success = await uploadToR2(r2Key, fileBuffer, file.mimeType);

        if (success) {
          // Store R2 key in filename field
          storedFilename = r2Key;
          uploadedToR2 = true;
          console.log(`[R2] Successfully uploaded ${filename} to R2, stored as ${r2Key}`);
          // Clean up temp file since we uploaded to R2
          await rm(file.tmpPath, { force: true });
        } else {
          console.warn(`[R2] Upload failed for ${filename}, falling back to local storage`);
        }
      } catch (error) {
        console.error(`[R2] Error uploading to R2, falling back to local storage:`, error);
      }
    } else {
      console.log(`[R2] R2 is not enabled or not properly configured, using local storage for ${filename}`);
    }

    // Fallback to local filesystem if R2 upload failed or R2 is disabled
    if (!uploadedToR2) {
      await ensureRoomUploadPath(roomStorageId);
      const filePath = getRoomFilePath(roomStorageId, filename);
      await rename(file.tmpPath, filePath);
    }

    const roomFile = await prisma.roomFile.create({
      data: {
        roomId: room.id,
        filename: storedFilename, // This will be either R2 key or local filename
        originalName: file.originalName,
        fileType: file.mimeType,
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
  } finally {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

async function parseMultipartRequest(req: NextRequest, tmpDir: string): Promise<ParsedUpload> {
  if (!req.body) {
    throw new Error('Missing request body');
  }

  const headers = Object.fromEntries(req.headers);
  const result: ParsedUpload = {};
  const filePromises: Promise<void>[] = [];

  const busboy = Busboy({ headers, limits: { files: 1 } });
  const requestStream = Readable.fromWeb(req.body as unknown as ReadableStream);

  const parsePromise = new Promise<ParsedUpload>((resolve, reject) => {
    busboy.on('field', (name, value) => {
      if (name === 'roomName') {
        result.roomLink = value;
      } else if (name === 'uploadedBy') {
        result.uploadedBy = value;
      }
    });

    busboy.on('file', (fieldname, fileStream, info) => {
      if (fieldname !== 'file') {
        fileStream.resume();
        return;
      }

      if (result.file) {
        fileStream.resume();
        reject(new Error('Only one file is allowed'));
        return;
      }

      const originalNameRaw = info.filename || 'upload';
      const originalName = Buffer.from(originalNameRaw, 'binary').toString('utf8');
      const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const tmpFilePath = path.join(tmpDir, `${Date.now()}-${Math.random().toString(36).slice(2)}-${sanitizedName}`);
      const writeStream = createWriteStream(tmpFilePath);

      const filePromise = new Promise<void>((resolveFile, rejectFile) => {
        let totalBytes = 0;

        fileStream.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes > MAX_FILE_SIZE) {
            fileStream.unpipe(writeStream);
            fileStream.resume();
            writeStream.destroy();
            rejectFile(new Error(`File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`));
          }
        });

        fileStream.on('error', (err) => {
          writeStream.destroy();
          rejectFile(err);
        });

        writeStream.on('error', rejectFile);

        writeStream.on('finish', () => {
          result.file = {
            tmpPath: tmpFilePath,
            originalName,
            mimeType: info.mimeType,
            size: totalBytes,
          };
          resolveFile();
        });
      });

      fileStream.pipe(writeStream);
      filePromises.push(filePromise);
    });

    busboy.on('error', reject);

    busboy.on('finish', () => {
      Promise.all(filePromises)
        .then(() => resolve(result))
        .catch(reject);
    });

    requestStream.on('error', reject);
    requestStream.pipe(busboy);
  });

  return parsePromise;
}

