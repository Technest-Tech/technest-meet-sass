import { mkdir, writeFile, readFile, unlink, rm, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { sanitizeRoomIdentifier, sanitizeFilename } from '@/lib/utils/sanitize';

export interface TempFileMetadata {
  id: string;
  filename: string;
  originalName: string;
  fileType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: number;
  filePath: string; // Temporary filesystem path
}

// In-memory storage for file metadata per room
const roomFiles = new Map<string, TempFileMetadata[]>();

// Base directory for temporary chat files
const getTempBaseDir = (): string => {
  return path.join(tmpdir(), 'chat-files');
};

// Get room-specific temp directory
const getRoomTempDir = (roomName: string): string => {
  const sanitizedRoom = sanitizeRoomIdentifier(roomName);
  if (!sanitizedRoom || sanitizedRoom !== roomName) {
    throw new Error('Invalid room name format');
  }
  return path.join(getTempBaseDir(), sanitizedRoom);
};

// Ensure room temp directory exists
const ensureRoomTempDir = async (roomName: string): Promise<string> => {
  const roomDir = getRoomTempDir(roomName);
  if (!existsSync(roomDir)) {
    await mkdir(roomDir, { recursive: true });
  }
  return roomDir;
};

/**
 * Store a file temporarily for a room
 */
export async function storeFile(
  roomName: string,
  fileBuffer: Buffer,
  originalName: string,
  fileType: string,
  uploadedBy: string
): Promise<TempFileMetadata> {
  // Validate inputs
  if (!roomName || !fileBuffer || !originalName || !fileType || !uploadedBy) {
    throw new Error('Missing required parameters');
  }

  // Sanitize inputs
  const sanitizedRoom = sanitizeRoomIdentifier(roomName);
  const sanitizedUploader = uploadedBy.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 100);
  
  if (!sanitizedRoom || sanitizedRoom !== roomName) {
    throw new Error('Invalid room name format');
  }

  // Ensure room directory exists
  const roomDir = await ensureRoomTempDir(roomName);

  // Generate unique file ID and safe filename
  const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  const sanitizedOriginalName = sanitizeFilename(originalName);
  const extension = path.extname(sanitizedOriginalName) || '';
  const safeFilename = `${fileId}${extension}`;
  const filePath = path.join(roomDir, safeFilename);

  // Ensure file path is within room directory (prevent path traversal)
  const resolvedPath = path.resolve(filePath);
  const resolvedRoomDir = path.resolve(roomDir);
  if (!resolvedPath.startsWith(resolvedRoomDir)) {
    throw new Error('Path traversal detected');
  }

  // Write file to disk
  await writeFile(filePath, fileBuffer);

  // Create metadata
  const metadata: TempFileMetadata = {
    id: fileId,
    filename: safeFilename,
    originalName: sanitizedOriginalName,
    fileType,
    size: fileBuffer.length,
    uploadedBy: sanitizedUploader,
    uploadedAt: Date.now(),
    filePath: resolvedPath,
  };

  // Store metadata in memory
  if (!roomFiles.has(roomName)) {
    roomFiles.set(roomName, []);
  }
  roomFiles.get(roomName)!.push(metadata);

  console.log('File stored successfully:', { 
    roomName, 
    fileId: metadata.id, 
    fileName: metadata.originalName,
    totalFilesInRoom: roomFiles.get(roomName)!.length 
  });

  return metadata;
}

/**
 * Get file metadata and path
 */
export function getFile(roomName: string, fileId: string): TempFileMetadata | null {
  const files = roomFiles.get(roomName);
  if (!files) {
    console.error('getFile: No files found for room:', roomName);
    console.error('getFile: Available rooms:', Array.from(roomFiles.keys()));
    return null;
  }

  const file = files.find(f => f.id === fileId);
  if (!file) {
    console.error('getFile: File not found. Looking for:', { fileId, fileIdLength: fileId?.length, fileIdType: typeof fileId });
    console.error('getFile: Available fileIds in room:', files.map(f => ({ id: f.id, idLength: f.id.length, name: f.originalName })));
    console.error('getFile: Exact match check:', files.map(f => ({ id: f.id, matches: f.id === fileId })));
  }
  return file || null;
}

/**
 * Read file from disk
 * If file is not in memory (e.g., after server restart), try to find it on disk by fileId
 */
export async function readFileFromDisk(roomName: string, fileId: string): Promise<Buffer | null> {
  let file = getFile(roomName, fileId);
  
  // If file not in memory, try to find it on disk
  if (!file) {
    console.log('File not in memory, searching on disk:', { roomName, fileId });
    const roomDir = getRoomTempDir(roomName);
    
    if (existsSync(roomDir)) {
      try {
        const files = await readdir(roomDir);
        
        // Look for file with matching fileId in filename
        const matchingFile = files.find(f => f.startsWith(fileId));
        if (matchingFile) {
          const filePath = path.join(roomDir, matchingFile);
          if (existsSync(filePath)) {
            // Get file stats
            const stats = await stat(filePath);
            
            // Extract original name from filename if possible, or use a default
            const extension = path.extname(matchingFile);
            // The filename format is: fileId.extension, so we need to get the extension
            // For original name, we'll use a generic name since we don't store it in the filename
            const originalName = `file${extension}`;
            
            // Try to determine file type from extension
            const extensionToMimeType: Record<string, string> = {
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.png': 'image/png',
              '.gif': 'image/gif',
              '.webp': 'image/webp',
              '.pdf': 'application/pdf',
              '.doc': 'application/msword',
              '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              '.ppt': 'application/vnd.ms-powerpoint',
              '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              '.txt': 'text/plain',
              '.zip': 'application/zip',
            };
            const fileType = extensionToMimeType[extension.toLowerCase()] || 'application/octet-stream';
            
            // Reconstruct file metadata and add to memory
            const metadata: TempFileMetadata = {
              id: fileId,
              filename: matchingFile,
              originalName: originalName,
              fileType: fileType,
              size: stats.size,
              uploadedBy: 'unknown',
              uploadedAt: stats.mtimeMs,
              filePath: path.resolve(filePath),
            };
            
            // Add back to memory
            if (!roomFiles.has(roomName)) {
              roomFiles.set(roomName, []);
            }
            // Check if already exists to avoid duplicates
            const existingIndex = roomFiles.get(roomName)!.findIndex(f => f.id === fileId);
            if (existingIndex === -1) {
              roomFiles.get(roomName)!.push(metadata);
            } else {
              // Update existing entry
              roomFiles.get(roomName)![existingIndex] = metadata;
            }
            file = metadata;
            
            console.log('File found on disk and restored to memory:', { fileId, fileName: matchingFile, fileType });
          }
        }
      } catch (error) {
        console.error('Error searching for file on disk:', error);
      }
    }
  }
  
  if (!file || !existsSync(file.filePath)) {
    console.error('File not found:', { roomName, fileId, hasFile: !!file, hasPath: file ? existsSync(file.filePath) : false });
    return null;
  }

  try {
    return await readFile(file.filePath);
  } catch (error) {
    console.error('Error reading file from disk:', error);
    return null;
  }
}

/**
 * Delete a specific file
 */
export async function deleteFile(roomName: string, fileId: string): Promise<boolean> {
  const file = getFile(roomName, fileId);
  if (!file) {
    return false;
  }

  try {
    // Delete from disk
    if (existsSync(file.filePath)) {
      await unlink(file.filePath);
    }

    // Remove from memory
    const files = roomFiles.get(roomName);
    if (files) {
      const index = files.findIndex(f => f.id === fileId);
      if (index !== -1) {
        files.splice(index, 1);
        if (files.length === 0) {
          roomFiles.delete(roomName);
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
}

/**
 * Get all files for a room (metadata only, without filePath)
 */
export function getRoomFiles(roomName: string): Omit<TempFileMetadata, 'filePath'>[] {
  const files = roomFiles.get(roomName);
  if (!files) {
    return [];
  }

  // Return metadata without filePath for security
  return files.map(({ filePath, ...rest }) => rest);
}

/**
 * Cleanup all files for a room
 */
export async function cleanupRoomFiles(roomName: string): Promise<number> {
  const files = roomFiles.get(roomName);
  if (!files || files.length === 0) {
    return 0;
  }

  let deletedCount = 0;
  const roomDir = getRoomTempDir(roomName);

  try {
    // Delete all files from disk
    for (const file of files) {
      try {
        if (existsSync(file.filePath)) {
          await unlink(file.filePath);
          deletedCount++;
        }
      } catch (error) {
        console.error(`Error deleting file ${file.id}:`, error);
      }
    }

    // Remove room directory if it exists
    if (existsSync(roomDir)) {
      try {
        await rm(roomDir, { recursive: true, force: true });
      } catch (error) {
        console.error(`Error removing room directory ${roomName}:`, error);
      }
    }

    // Clear from memory
    roomFiles.delete(roomName);

    return deletedCount;
  } catch (error) {
    console.error(`Error cleaning up room files for ${roomName}:`, error);
    // Still clear from memory even if disk cleanup fails
    roomFiles.delete(roomName);
    return deletedCount;
  }
}

/**
 * Cleanup old files (older than specified hours)
 * This can be called periodically to clean up stale files
 */
export async function cleanupOldFiles(maxAgeHours: number = 24): Promise<number> {
  const now = Date.now();
  const maxAge = maxAgeHours * 60 * 60 * 1000;
  let totalDeleted = 0;

  const roomsToClean: string[] = [];

  // Find old files
  for (const [roomName, files] of roomFiles.entries()) {
    const oldFiles = files.filter(file => now - file.uploadedAt > maxAge);
    if (oldFiles.length > 0) {
      for (const file of oldFiles) {
        await deleteFile(roomName, file.id);
        totalDeleted++;
      }
      
      // If all files are old, mark room for cleanup
      if (files.length === oldFiles.length) {
        roomsToClean.push(roomName);
      }
    }
  }

  // Cleanup empty room directories
  for (const roomName of roomsToClean) {
    const roomDir = getRoomTempDir(roomName);
    if (existsSync(roomDir)) {
      try {
        await rm(roomDir, { recursive: true, force: true });
      } catch (error) {
        console.error(`Error removing old room directory ${roomName}:`, error);
      }
    }
  }

  return totalDeleted;
}

