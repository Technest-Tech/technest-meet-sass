import path from 'path';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { sanitizeRoomIdentifier, sanitizeFilename } from './sanitize';

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
  
  // Sanitize room identifier to prevent path traversal
  const sanitized = sanitizeRoomIdentifier(roomIdentifier);
  if (!sanitized || sanitized !== roomIdentifier) {
    throw new Error('Invalid room identifier format');
  }
  
  // Use path.resolve to ensure we stay within the upload root
  const uploadRoot = getUploadRoot();
  const resolvedPath = path.resolve(uploadRoot, sanitized);
  
  // Ensure the resolved path is within the upload root (prevent path traversal)
  if (!resolvedPath.startsWith(path.resolve(uploadRoot))) {
    throw new Error('Path traversal detected in room identifier');
  }
  
  return resolvedPath;
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
  
  // Sanitize filename to prevent path traversal
  const sanitized = sanitizeFilename(filename);
  if (!sanitized || sanitized !== filename) {
    throw new Error('Invalid filename format');
  }
  
  // Get the room upload path (already validated)
  const roomPath = getRoomUploadPath(roomIdentifier);
  
  // Use path.resolve and ensure we stay within the room path
  const resolvedPath = path.resolve(roomPath, sanitized);
  
  // Ensure the resolved path is within the room path (prevent path traversal)
  if (!resolvedPath.startsWith(path.resolve(roomPath))) {
    throw new Error('Path traversal detected in filename');
  }
  
  return resolvedPath;
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
  
  // Sanitize inputs for R2 key generation
  const sanitizedRoomId = sanitizeRoomIdentifier(roomIdentifier);
  const sanitizedFilename = sanitizeFilename(filename);
  
  if (!sanitizedRoomId || sanitizedRoomId !== roomIdentifier) {
    throw new Error('Invalid room identifier format for R2 key');
  }
  
  if (!sanitizedFilename || sanitizedFilename !== filename) {
    throw new Error('Invalid filename format for R2 key');
  }
  
  return `room-files/${sanitizedRoomId}/${sanitizedFilename}`;
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

