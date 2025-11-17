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

