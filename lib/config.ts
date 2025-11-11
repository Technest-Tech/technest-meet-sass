// Type-safe configuration for the application

interface LiveKitConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
}

interface ConnectionConfig {
  maxRetries: number;
  timeout: number;
  reconnectDelay: number;
}

interface FeaturesConfig {
  maxParticipants: number;
  enableRecording: boolean;
  enableE2EE: boolean;
  enableSimulcast: boolean;
  enableAdaptiveStream: boolean;
}

interface Config {
  env: 'development' | 'production' | 'test';
  livekit: LiveKitConfig;
  connection: ConnectionConfig;
  features: FeaturesConfig;
}

// Validate required environment variables
function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export const config: Config = {
  env: (process.env.NEXT_PUBLIC_ENV || process.env.NODE_ENV || 'development') as Config['env'],
  
  livekit: {
    url: getOptionalEnv('NEXT_PUBLIC_LIVEKIT_URL', 'ws://localhost:7880'),
    apiKey: getOptionalEnv('LIVEKIT_API_KEY', ''),
    apiSecret: getOptionalEnv('LIVEKIT_API_SECRET', ''),
  },
  
  connection: {
    maxRetries: 3,
    timeout: 30000, // 30 seconds
    reconnectDelay: 2000, // 2 seconds
  },
  
  features: {
    maxParticipants: 50,
    enableRecording: true,
    enableE2EE: true,
    enableSimulcast: true,
    enableAdaptiveStream: true,
  }
} as const;

// Export individual configs for convenience
export const livekitConfig = config.livekit;
export const connectionConfig = config.connection;
export const featuresConfig = config.features;

// Helper to check if in development mode
export const isDevelopment = config.env === 'development';
export const isProduction = config.env === 'production';





