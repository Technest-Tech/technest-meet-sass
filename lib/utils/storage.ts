import path from 'path';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';

const DEFAULT_UPLOAD_ROOT = path.join(process.cwd(), 'public', 'uploads');

function normalizeRoot(root: string) {
  if (path.isAbsolute(root)) {
    return root;
  }
  return path.join(process.cwd(), root);
}

export function getUploadRoot(): string {
  const customRoot = process.env.ROOM_UPLOAD_ROOT?.trim();
  if (customRoot) {
    return normalizeRoot(customRoot);
  }
  return DEFAULT_UPLOAD_ROOT;
}

export function getRoomUploadPath(roomIdentifier: string): string {
  if (!roomIdentifier) {
    throw new Error('roomIdentifier is required to resolve upload path');
  }
  return path.join(getUploadRoot(), roomIdentifier);
}

export async function ensureRoomUploadPath(roomIdentifier: string): Promise<string> {
  const dir = getRoomUploadPath(roomIdentifier);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

export function getRoomFilePath(roomIdentifier: string, filename: string): string {
  if (!filename) {
    throw new Error('filename is required to resolve file path');
  }
  return path.join(getRoomUploadPath(roomIdentifier), filename);
}

/**
 * Generate R2 key for a room file
 * Format: room-files/{roomId}/{filename}
 */
export function getR2Key(roomIdentifier: string, filename: string): string {
  if (!roomIdentifier) {
    throw new Error('roomIdentifier is required to generate R2 key');
  }
  if (!filename) {
    throw new Error('filename is required to generate R2 key');
  }
  return `room-files/${roomIdentifier}/${filename}`;
}

/**
 * Check if a filename is an R2 key (stored in R2)
 * R2 keys start with "room-files/"
 */
export function isR2Key(filename: string): boolean {
  return filename.startsWith('room-files/');
}

/**
 * Extract the actual filename from an R2 key
 * If it's not an R2 key, returns the original filename
 */
export function extractFilenameFromR2Key(keyOrFilename: string): string {
  if (isR2Key(keyOrFilename)) {
    // Extract filename from "room-files/{roomId}/{filename}"
    const parts = keyOrFilename.split('/');
    return parts[parts.length - 1];
  }
  return keyOrFilename;
}

