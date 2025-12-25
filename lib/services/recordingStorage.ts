import { readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { uploadFile as uploadToR2 } from './r2Storage';
import { prisma } from '@/lib/database';

// Check if R2 is enabled
function isR2Enabled(): boolean {
  const enabled = process.env.R2_ENABLED !== 'false';
  const hasConfig = !!(
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_ENDPOINT &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_BUCKET_NAME !== 'your-bucket-name'
  );
  return enabled && hasConfig;
}

/**
 * Generate R2 key for a recording
 * Format: recordings/{clientId}/{roomId}/{filename}
 */
export function getRecordingR2Key(clientId: string, roomId: string, filename: string): string {
  // Extract just the filename (remove /recordings/ prefix if present)
  const baseFilename = filename.split('/').pop() || filename;
  
  // Sanitize to ensure safe R2 key
  const sanitizedFilename = baseFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
  
  return `recordings/${clientId}/${roomId}/${sanitizedFilename}`;
}

/**
 * Upload recording to R2 in background (non-blocking)
 * This is called asynchronously after recording is saved to database
 */
export async function uploadRecordingToR2(
  recordingId: string,
  localFilePath: string,
  clientId: string,
  roomId: string,
  filename: string
): Promise<boolean> {
  try {
    // Check if R2 is enabled
    if (!isR2Enabled()) {
      console.log(`[Recording Storage] R2 is disabled, keeping local storage for recording ${recordingId}`);
      return false;
    }

    console.log(`[Recording Storage] Starting R2 upload for recording ${recordingId}...`);
    
    // Read file from local storage
    const fileBuffer = await readFile(localFilePath);
    
    // Generate R2 key
    const r2Key = getRecordingR2Key(clientId, roomId, filename);
    
    console.log(`[Recording Storage] Uploading to R2 key: ${r2Key} (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
    
    // Upload to R2
    const success = await uploadToR2(r2Key, fileBuffer, 'video/mp4');
    
    if (success) {
      // Update database: now available in R2
      await prisma.recording.update({
        where: { id: recordingId },
        data: {
          storageType: 'R2',
          storagePath: r2Key,
        }
      });
      
      console.log(`[Recording Storage] Successfully uploaded recording ${recordingId} to R2`);
      
      // Optional: Delete local file after successful R2 upload to save disk space
      // Uncomment the following lines if you want to delete local files after R2 upload:
      // try {
      //   await unlink(localFilePath);
      //   console.log(`[Recording Storage] Deleted local file after successful R2 upload: ${localFilePath}`);
      // } catch (deleteError) {
      //   console.warn(`[Recording Storage] Failed to delete local file (keeping it as backup):`, deleteError);
      // }
      
      return true;
    } else {
      console.warn(`[Recording Storage] R2 upload failed for recording ${recordingId}, keeping local storage`);
      return false;
    }
  } catch (error) {
    console.error(`[Recording Storage] Error uploading recording ${recordingId} to R2:`, error);
    // Recording still available from local storage, so this is not a critical error
    return false;
  }
}

/**
 * Get recording file buffer from storage (R2 or local)
 */
export async function getRecordingFile(
  storageType: 'LOCAL' | 'R2',
  storagePath: string | null,
  localFilePath: string
): Promise<Buffer | null> {
  try {
    if (storageType === 'R2' && storagePath) {
      // Try to get from R2
      console.log(`[Recording Storage] Attempting to get file from R2: ${storagePath}`);
      const { downloadFile } = await import('./r2Storage');
      const fileBuffer = await downloadFile(storagePath);
      if (fileBuffer) {
        console.log(`[Recording Storage] ✅ Successfully retrieved file from R2: ${storagePath} (${fileBuffer.length} bytes)`);
        return fileBuffer;
      }
      // Fallback to local if R2 fails
      console.warn(`[Recording Storage] R2 file not found, falling back to local: ${storagePath}`);
    }
    
    // Fallback to local storage
    if (localFilePath) {
      console.log(`[Recording Storage] Attempting to get file from local: ${localFilePath}`);
      try {
        const fileBuffer = await readFile(localFilePath);
        console.log(`[Recording Storage] ✅ Successfully retrieved file from local: ${localFilePath} (${fileBuffer.length} bytes)`);
        return fileBuffer;
      } catch (localError: any) {
        if (localError.code === 'ENOENT') {
          console.warn(`[Recording Storage] Local file not found: ${localFilePath}`);
        } else {
          console.error(`[Recording Storage] Error reading local file: ${localError.message}`);
        }
      }
    }
    
    console.warn(`[Recording Storage] File not found in R2 or local storage`);
    return null;
  } catch (error) {
    console.error('[Recording Storage] Error getting recording file:', error);
    return null;
  }
}

