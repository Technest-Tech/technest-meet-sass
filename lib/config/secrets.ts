/**
 * Centralized secrets management
 * Validates required environment variables on startup
 * Prevents accidental logging of secrets
 */

interface Secrets {
  livekitApiKey: string;
  livekitApiSecret: string;
  databaseUrl: string;
  jwtSecret?: string;
  r2AccessKeyId?: string;
  r2SecretAccessKey?: string;
  r2BucketName?: string;
  r2Endpoint?: string;
}

let cachedSecrets: Secrets | null = null;

/**
 * Get and validate all required secrets
 * Throws error if required secrets are missing
 */
export function getSecrets(): Secrets {
  if (cachedSecrets) {
    return cachedSecrets;
  }

  const required = ['LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'DATABASE_URL'];
  const missing = required.filter(key => !process.env[key] || process.env[key]!.trim() === '');
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  cachedSecrets = {
    livekitApiKey: process.env.LIVEKIT_API_KEY!,
    livekitApiSecret: process.env.LIVEKIT_API_SECRET!,
    databaseUrl: process.env.DATABASE_URL!,
    jwtSecret: process.env.JWT_SECRET,
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID,
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    r2BucketName: process.env.R2_BUCKET_NAME,
    r2Endpoint: process.env.R2_ENDPOINT,
  };

  return cachedSecrets;
}

/**
 * Get a specific secret by key
 * Returns undefined if not found (for optional secrets)
 */
export function getSecret(key: keyof Secrets): string | undefined {
  const secrets = getSecrets();
  return secrets[key];
}

/**
 * Validate secrets on application startup
 * Call this in your application entry point
 */
export function validateSecrets(): void {
  try {
    getSecrets();
    console.log('[Secrets] All required secrets validated');
  } catch (error) {
    console.error('[Secrets] Validation failed:', error);
    throw error;
  }
}
