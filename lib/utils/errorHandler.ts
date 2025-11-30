import { logger } from './logger';

export enum ErrorType {
  NETWORK = 'network',
  PERMISSION = 'permission',
  CONNECTION = 'connection',
  VALIDATION = 'validation',
  MEDIA_DEVICE = 'media_device',
  ENCRYPTION = 'encryption',
  UNKNOWN = 'unknown'
}

export interface ErrorInfo {
  type: ErrorType;
  message: string;
  originalError: unknown;
  userMessage: string;
  canRetry: boolean;
}

/**
 * Classifies an error and returns structured error information
 */
function classifyError(error: unknown): ErrorInfo {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorMessageLower = errorMessage.toLowerCase();
  
  // Network errors
  if (errorMessageLower.includes('network') || 
      errorMessageLower.includes('fetch') ||
      errorMessageLower.includes('timeout') ||
      errorMessageLower.includes('connection') && errorMessageLower.includes('failed')) {
    return {
      type: ErrorType.NETWORK,
      message: errorMessage,
      originalError: error,
      userMessage: 'Network connection issue. Please check your internet connection and try again.',
      canRetry: true
    };
  }
  
  // Permission errors
  if (errorMessageLower.includes('permission') || 
      errorMessageLower.includes('notallowed') ||
      errorMessageLower.includes('denied')) {
    return {
      type: ErrorType.PERMISSION,
      message: errorMessage,
      originalError: error,
      userMessage: 'Permission denied. Please allow access to your camera and microphone.',
      canRetry: true
    };
  }
  
  // Connection errors
  if (errorMessageLower.includes('webrtc') ||
      errorMessageLower.includes('ice') ||
      errorMessageLower.includes('rtcpeerconnection')) {
    return {
      type: ErrorType.CONNECTION,
      message: errorMessage,
      originalError: error,
      userMessage: 'Connection error. Please refresh the page and try again.',
      canRetry: true
    };
  }
  
  // Media device errors
  if (errorMessageLower.includes('camera') ||
      errorMessageLower.includes('microphone') ||
      errorMessageLower.includes('mediastream') ||
      errorMessageLower.includes('getusermedia')) {
    return {
      type: ErrorType.MEDIA_DEVICE,
      message: errorMessage,
      originalError: error,
      userMessage: 'Media device error. Please check your camera and microphone settings.',
      canRetry: true
    };
  }
  
  // Encryption errors
  if (errorMessageLower.includes('encryption') ||
      errorMessageLower.includes('e2ee')) {
    return {
      type: ErrorType.ENCRYPTION,
      message: errorMessage,
      originalError: error,
      userMessage: 'Encryption error. Your browser may not support encrypted meetings.',
      canRetry: false
    };
  }
  
  // Validation errors
  if (errorMessageLower.includes('validation') ||
      errorMessageLower.includes('invalid')) {
    return {
      type: ErrorType.VALIDATION,
      message: errorMessage,
      originalError: error,
      userMessage: 'Invalid request. Please check your input and try again.',
      canRetry: false
    };
  }
  
  // Unknown errors
  return {
    type: ErrorType.UNKNOWN,
    message: errorMessage,
    originalError: error,
    userMessage: 'An unexpected error occurred. Please try again later.',
    canRetry: true
  };
}

/**
 * Main error handler function
 * @param error The error to handle
 * @param context Context information about where the error occurred
 * @returns Structured error information
 */
export function handleError(error: unknown, context: string): ErrorInfo {
  const errorInfo = classifyError(error);
  
  // Log the error with context
  logger.error(`Error in ${context}:`, {
    type: errorInfo.type,
    message: errorInfo.message,
    canRetry: errorInfo.canRetry
  });
  
  return errorInfo;
}

/**
 * Handle API errors specifically
 */
export async function handleApiError(response: Response, context: string): Promise<ErrorInfo> {
  let errorMessage = `API error: ${response.status} ${response.statusText}`;
  
  try {
    const data = await response.json();
    errorMessage = data.message || data.error || errorMessage;
  } catch {
    // Response body is not JSON or already consumed
  }
  
  const error = new Error(errorMessage);
  return handleError(error, context);
}

/**
 * Create a user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  const errorInfo = classifyError(error);
  return errorInfo.userMessage;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  const errorInfo = classifyError(error);
  return errorInfo.canRetry;
}



















