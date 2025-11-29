import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

// Initialize R2 client
let r2Client: S3Client | null = null;

function getR2Client(): S3Client | null {
  if (r2Client) {
    return r2Client;
  }

  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT;
  const bucketName = process.env.R2_BUCKET_NAME;
  const enabled = process.env.R2_ENABLED !== 'false'; // Default to true if not set

  // Check if R2 is enabled and all required config is present
  if (!enabled) {
    console.log('[R2] R2 is disabled (R2_ENABLED=false)');
    return null;
  }
  
  if (!accessKeyId) {
    console.warn('[R2] R2_ACCESS_KEY_ID is not set');
    return null;
  }
  
  if (!secretAccessKey) {
    console.warn('[R2] R2_SECRET_ACCESS_KEY is not set');
    return null;
  }
  
  if (!endpoint) {
    console.warn('[R2] R2_ENDPOINT is not set');
    return null;
  }
  
  if (!bucketName || bucketName === 'your-bucket-name') {
    console.warn('[R2] R2_BUCKET_NAME is not set or is still the placeholder value. Please set a valid bucket name.');
    return null;
  }

  try {
    r2Client = new S3Client({
      region: 'auto', // R2 uses 'auto' as region
      endpoint: endpoint,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
      forcePathStyle: true, // Required for R2
    });

    return r2Client;
  } catch (error) {
    console.error('[R2] Failed to initialize R2 client:', error);
    return null;
  }
}

function getBucketName(): string | null {
  return process.env.R2_BUCKET_NAME || null;
}

/**
 * Check if R2 is enabled and configured
 */
export function isR2Enabled(): boolean {
  const client = getR2Client();
  return client !== null;
}

/**
 * Upload a file to R2
 * @param key R2 object key (e.g., 'room-files/roomId/filename')
 * @param fileBuffer File buffer to upload
 * @param contentType MIME type of the file
 * @returns true if successful, false otherwise
 */
export async function uploadFile(
  key: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<boolean> {
  const client = getR2Client();
  const bucket = getBucketName();

  if (!client || !bucket) {
    return false;
  }

  try {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    });

    await client.send(command);
    console.log(`[R2] Successfully uploaded file ${key} to bucket ${bucket}`);
    return true;
  } catch (error: any) {
    console.error(`[R2] Failed to upload file ${key} to bucket ${bucket}:`, error);
    if (error.name) {
      console.error(`[R2] Error name: ${error.name}`);
    }
    if (error.message) {
      console.error(`[R2] Error message: ${error.message}`);
    }
    if (error.$metadata) {
      console.error(`[R2] HTTP status: ${error.$metadata.httpStatusCode}`);
    }
    return false;
  }
}

/**
 * Download a file from R2
 * @param key R2 object key
 * @returns File buffer if successful, null otherwise
 */
export async function downloadFile(key: string): Promise<Buffer | null> {
  const client = getR2Client();
  const bucket = getBucketName();

  if (!client || !bucket) {
    return null;
  }

  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await client.send(command);

    if (!response.Body) {
      return null;
    }

    // Convert stream to buffer
    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  } catch (error: any) {
    // Check if it's a 404 (file not found)
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return null;
    }
    console.error(`[R2] Failed to download file ${key}:`, error);
    return null;
  }
}

/**
 * Check if a file exists in R2
 * @param key R2 object key
 * @returns true if file exists, false otherwise
 */
export async function fileExists(key: string): Promise<boolean> {
  const client = getR2Client();
  const bucket = getBucketName();

  if (!client || !bucket) {
    return false;
  }

  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);
    return true;
  } catch (error: any) {
    // Check if it's a 404 (file not found)
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    console.error(`[R2] Failed to check file existence ${key}:`, error);
    return false;
  }
}

/**
 * Delete a file from R2
 * @param key R2 object key
 * @returns true if successful, false otherwise
 */
export async function deleteFile(key: string): Promise<boolean> {
  const client = getR2Client();
  const bucket = getBucketName();

  if (!client || !bucket) {
    return false;
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);
    return true;
  } catch (error: any) {
    // Check if it's a 404 (file not found) - consider it successful
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return true;
    }
    console.error(`[R2] Failed to delete file ${key}:`, error);
    return false;
  }
}

/**
 * Get a readable stream for a file from R2
 * Useful for streaming large files
 * @param key R2 object key
 * @returns Readable stream if successful, null otherwise
 */
export async function getFileStream(key: string): Promise<Readable | null> {
  const client = getR2Client();
  const bucket = getBucketName();

  if (!client || !bucket) {
    return null;
  }

  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await client.send(command);

    if (!response.Body) {
      return null;
    }

    return response.Body as Readable;
  } catch (error: any) {
    // Check if it's a 404 (file not found)
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return null;
    }
    console.error(`[R2] Failed to get file stream ${key}:`, error);
    return null;
  }
}

