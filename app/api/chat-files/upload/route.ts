import { NextRequest, NextResponse } from 'next/server';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import Busboy from 'busboy';
import { storeFile } from '@/lib/services/tempFileStorage';
import { sanitizeRoomIdentifier, sanitizeStringLenient, validateLength } from '@/lib/utils/sanitize';

export const runtime = 'nodejs';

// Allowed file types for chat
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

type ParsedUpload = {
  roomName?: string;
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
    tmpDir = await mkdtemp(path.join(tmpdir(), 'chat-file-upload-'));
    const parsed = await parseMultipartRequest(req, tmpDir);

    const file = parsed.file;
    let roomName = parsed.roomName;
    let uploadedBy = parsed.uploadedBy;

    if (!file || !roomName || !uploadedBy) {
      if (file?.tmpPath) {
        await rm(file.tmpPath, { force: true });
      }
      return NextResponse.json(
        { error: 'Missing required fields: file, roomName, or uploadedBy' },
        { status: 400 }
      );
    }

    // Sanitize inputs
    roomName = sanitizeRoomIdentifier(roomName);
    uploadedBy = sanitizeStringLenient(uploadedBy);

    // Validate input lengths
    if (!validateLength(roomName, 100, 1)) {
      if (file?.tmpPath) {
        await rm(file.tmpPath, { force: true });
      }
      return NextResponse.json(
        { error: 'Invalid room name format' },
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

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.mimeType)) {
      await rm(file.tmpPath, { force: true });
      return NextResponse.json(
        { error: `File type not allowed. Allowed types: Images, PDF, Word, PowerPoint, Text, ZIP` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      await rm(file.tmpPath, { force: true });
      return NextResponse.json(
        { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Read file buffer
    const fileBuffer = await readFile(file.tmpPath);

    // Store file using temp storage service
    const fileMetadata = await storeFile(
      roomName,
      fileBuffer,
      file.originalName,
      file.mimeType,
      uploadedBy
    );

    // Clean up temp file
    await rm(file.tmpPath, { force: true });

    // Return metadata without filePath for security
    const { filePath, ...safeMetadata } = fileMetadata;

    return NextResponse.json({
      success: true,
      file: safeMetadata,
    });
  } catch (error) {
    console.error('Chat file upload error:', error);
    
    // Cleanup temp directory on error
    if (tmpDir) {
      try {
        await rm(tmpDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Error cleaning up temp directory:', cleanupError);
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to upload file',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

async function parseMultipartRequest(req: NextRequest, tmpDir: string): Promise<ParsedUpload> {
  if (!req.body) {
    throw new Error('Missing request body');
  }

  const headers = Object.fromEntries(req.headers);
  const result: ParsedUpload = {};
  const filePromises: Promise<void>[] = [];

  const busboy = Busboy({ headers, limits: { files: 1, fileSize: MAX_FILE_SIZE } });
  const requestStream = Readable.fromWeb(req.body as unknown as ReadableStream);

  const parsePromise = new Promise<ParsedUpload>((resolve, reject) => {
    busboy.on('field', (name, value) => {
      if (name === 'roomName') {
        result.roomName = value;
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
      const sanitizedName = path.basename(originalName);
      const safeTempName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${sanitizedName}`;
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
            mimeType: info.mimeType || 'application/octet-stream',
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

