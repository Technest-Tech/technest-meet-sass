import { NextRequest, NextResponse } from 'next/server';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rename, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import Busboy from 'busboy';
import { PrismaClient } from '@prisma/client';
import { ensureRoomUploadPath, getRoomFilePath, getR2Key } from '@/lib/utils/storage';
import { uploadFile as uploadToR2, isR2Enabled } from '@/lib/services/r2Storage';
import { sanitizeFilename, sanitizeRoomIdentifier, sanitizeStringLenient, validateLength } from '@/lib/utils/sanitize';

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
    let roomLink = parsed.roomLink;
    let uploadedBy = parsed.uploadedBy;

    if (!file || !roomLink || !uploadedBy) {
      if (file?.tmpPath) {
        await rm(file.tmpPath, { force: true });
      }
      return NextResponse.json(
        { error: 'Missing required fields: file, roomName, or uploadedBy' },
        { status: 400 }
      );
    }

    // Sanitize inputs to prevent command injection
    roomLink = sanitizeRoomIdentifier(roomLink);
    uploadedBy = sanitizeStringLenient(uploadedBy);

    // Validate input lengths
    if (!validateLength(roomLink, 100, 1)) {
      if (file?.tmpPath) {
        await rm(file.tmpPath, { force: true });
      }
      return NextResponse.json(
        { error: 'Invalid room link format' },
        { status: 400 }
      );
    }

    if (!validateLength(uploadedBy, 200, 1)) {
      if (file?.tmpPath) {
        await rm(file.tmpPath, { force: true });
      }
      return NextResponse.json(
        { error: 'Invalid uploadedBy field' },
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
    // Enhanced filename sanitization to prevent path traversal and command injection
    const sanitizedOriginalName = sanitizeFilename(file.originalName);
    const filename = `${timestamp}-${sanitizedOriginalName}`;
    
    // Additional validation: ensure filename doesn't contain path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      await rm(file.tmpPath, { force: true });
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      );
    }

    let storedFilename = filename;
    let uploadedToR2 = false;
    let uploadedToLocal = false;
    let fileBuffer: Buffer | null = null;

    // Read file buffer once for both storage locations
    try {
      fileBuffer = await readFile(file.tmpPath);
    } catch (error) {
      console.error(`[RoomFiles] Failed to read temp file:`, error);
      await rm(file.tmpPath, { force: true });
      return NextResponse.json(
        { error: 'Failed to read uploaded file' },
        { status: 500 }
      );
    }

    // CRITICAL: Always store locally for redundancy (even if R2 succeeds)
    try {
      await ensureRoomUploadPath(roomStorageId);
      const filePath = getRoomFilePath(roomStorageId, filename);
      await writeFile(filePath, fileBuffer);
      uploadedToLocal = true;
      console.log(`[RoomFiles] File stored locally at ${filePath}`);
    } catch (localError) {
      console.error(`[RoomFiles] Failed to store file locally:`, localError);
      // Continue anyway - R2 might still work
    }

    // Try uploading to R2 if enabled (for redundancy and cloud access)
    if (isR2Enabled()) {
      console.log(`[R2] Attempting to upload ${filename} to R2...`);
      try {
        const r2Key = getR2Key(roomStorageId, filename);
        console.log(`[R2] Uploading to R2 key: ${r2Key}`);
        const success = await uploadToR2(r2Key, fileBuffer, file.mimeType);

        if (success) {
          uploadedToR2 = true;
          storedFilename = r2Key; // Prefer R2 key in database for cloud access
          console.log(`[R2] Successfully uploaded ${filename} to R2, stored as ${r2Key}`);
        } else {
          console.warn(`[R2] Upload failed for ${filename}, will use local storage`);
        }
      } catch (error) {
        console.error(`[R2] Error uploading to R2:`, error);
        // Continue - local storage should be available
      }
    } else {
      console.log(`[R2] R2 is not enabled, using local storage only for ${filename}`);
    }

    // Ensure at least one storage succeeded
    if (!uploadedToLocal && !uploadedToR2) {
      await rm(file.tmpPath, { force: true });
      return NextResponse.json(
        { error: 'Failed to store file in any storage location' },
        { status: 500 }
      );
    }

    // Clean up temp file
    try {
      await rm(file.tmpPath, { force: true });
    } catch (cleanupError) {
      console.warn(`[RoomFiles] Failed to clean up temp file:`, cleanupError);
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
      // Enhanced sanitization using sanitizeFilename utility
      const sanitizedName = sanitizeFilename(originalName);
      // Use a safe random filename for temp file to prevent any path issues
      const safeTempName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${sanitizedName}`;
      // Ensure no path traversal in temp file path
      const tmpFilePath = path.join(tmpDir, path.basename(safeTempName));
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

