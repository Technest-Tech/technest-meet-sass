/**
 * Input sanitization utilities to prevent command injection and path traversal
 */

// Characters that could be used for command injection
const DANGEROUS_CHARS = /[;&|$`()<>{}[\]\\]/g;

// Path traversal patterns
const PATH_TRAVERSAL = /\.\./g;

/**
 * Sanitize a string input to prevent command injection
 * Removes dangerous characters that could be used in shell commands
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remove dangerous characters
  return input.replace(DANGEROUS_CHARS, '').trim();
}

/**
 * Sanitize a string but allow certain characters (for names, etc.)
 * Only removes the most dangerous characters
 */
export function sanitizeStringLenient(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Only remove the most dangerous characters: ; | & ` $ ( )
  return input.replace(/[;|&`$()]/g, '').trim();
}

/**
 * Validate and sanitize a file path
 * Prevents path traversal attacks
 */
export function sanitizeFilePath(input: string): string {
  if (typeof input !== 'string') {
    throw new Error('File path must be a string');
  }
  
  // Remove path traversal patterns
  let sanitized = input.replace(PATH_TRAVERSAL, '');
  
  // Remove leading/trailing slashes
  sanitized = sanitized.replace(/^\/+|\/+$/g, '');
  
  // Remove dangerous characters
  sanitized = sanitized.replace(DANGEROUS_CHARS, '');
  
  // Ensure no absolute paths
  if (sanitized.startsWith('/') || sanitized.match(/^[a-zA-Z]:/)) {
    throw new Error('Absolute paths are not allowed');
  }
  
  return sanitized;
}

/**
 * Sanitize a filename
 * Removes dangerous characters and path traversal
 */
export function sanitizeFilename(input: string): string {
  if (typeof input !== 'string') {
    return 'unnamed';
  }
  
  // Remove path traversal
  let sanitized = input.replace(PATH_TRAVERSAL, '');
  
  // Remove dangerous characters
  sanitized = sanitized.replace(DANGEROUS_CHARS, '');
  
  // Remove leading dots and slashes
  sanitized = sanitized.replace(/^[.\/]+/, '');
  
  // Limit length
  if (sanitized.length > 255) {
    sanitized = sanitized.substring(0, 255);
  }
  
  return sanitized || 'unnamed';
}

/**
 * Validate a URL to prevent SSRF attacks
 */
export function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Block localhost and private IPs
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('172.17.') ||
      hostname.startsWith('172.18.') ||
      hostname.startsWith('172.19.') ||
      hostname.startsWith('172.20.') ||
      hostname.startsWith('172.21.') ||
      hostname.startsWith('172.22.') ||
      hostname.startsWith('172.23.') ||
      hostname.startsWith('172.24.') ||
      hostname.startsWith('172.25.') ||
      hostname.startsWith('172.26.') ||
      hostname.startsWith('172.27.') ||
      hostname.startsWith('172.28.') ||
      hostname.startsWith('172.29.') ||
      hostname.startsWith('172.30.') ||
      hostname.startsWith('172.31.')
    ) {
      return false;
    }
    
    // Only allow http and https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate input length
 */
export function validateLength(input: string, maxLength: number, minLength: number = 0): boolean {
  if (typeof input !== 'string') {
    return false;
  }
  
  const length = input.trim().length;
  return length >= minLength && length <= maxLength;
}

/**
 * Sanitize room identifier
 * Only allows alphanumeric characters, hyphens, and underscores
 */
export function sanitizeRoomIdentifier(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Only allow alphanumeric, hyphens, and underscores
  return input.replace(/[^a-zA-Z0-9_-]/g, '').trim();
}

/**
 * Sanitize email (basic validation)
 */
export function sanitizeEmail(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remove dangerous characters but keep email format
  return input.replace(/[;&|`$()<>]/g, '').trim().toLowerCase();
}

/**
 * Detect command injection patterns in input
 * Returns true if suspicious patterns are found
 */
export function detectCommandInjection(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }
  
  const patterns = [
    /wget\s+/i,
    /curl\s+/i,
    /bash\s+-c/i,
    /sh\s+-c/i,
    /\$\(.*\)/,
    /`.*`/,
    /;\s*(wget|curl|bash|sh|nc|netcat|python|perl|ruby|node)/i,
    /\|\s*(wget|curl|bash|sh|nc|netcat|python|perl|ruby|node)/i,
    /&&\s*(wget|curl|bash|sh|nc|netcat|python|perl|ruby|node)/i,
    /\|\|\s*(wget|curl|bash|sh|nc|netcat|python|perl|ruby|node)/i,
    /exec\s*\(/i,
    /eval\s*\(/i,
    /system\s*\(/i,
    /spawn\s*\(/i,
    /child_process/i,
    /\.exec\s*\(/i,
    /\.spawn\s*\(/i,
  ];
  
  return patterns.some(pattern => pattern.test(input));
}

/**
 * Sanitize and validate input, throwing error if command injection detected
 */
export function sanitizeWithInjectionCheck(input: string, fieldName: string = 'input'): string {
  if (detectCommandInjection(input)) {
    throw new Error(`Potential command injection detected in ${fieldName}`);
  }
  return sanitizeString(input);
}

